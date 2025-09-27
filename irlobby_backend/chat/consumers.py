import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from .models import Conversation, Message
from activities.models import Activity, ActivityParticipant
from matches.models import Match

class ActivityChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # Check if user is authenticated
        user = self.scope.get('user', AnonymousUser())
        if user.is_anonymous:
            await self.close()
            return

        await self.accept()
        self.user = user
        self.activity_rooms = set()  # Track which activity rooms this user is in

    async def disconnect(self, close_code):
        # Leave all activity rooms
        for room in self.activity_rooms:
            await self.channel_layer.group_discard(
                room,
                self.channel_name
            )

    async def receive(self, text_data):
        try:
            text_data_json = json.loads(text_data)
            message_type = text_data_json.get('type')

            if message_type == 'join_activity':
                await self.join_activity(text_data_json)
            elif message_type == 'leave_activity':
                await self.leave_activity(text_data_json)
            elif message_type == 'send_message':
                await self.send_activity_message(text_data_json)

        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({
                'error': 'Invalid JSON format'
            }))
        except Exception as e:
            await self.send(text_data=json.dumps({
                'error': str(e)
            }))

    async def join_activity(self, data):
        activity_id = data.get('activityId')
        if not activity_id:
            await self.send(text_data=json.dumps({
                'error': 'activityId is required'
            }))
            return

        # Check if user is authorized to join this activity chat
        is_authorized = await self.check_activity_access(self.user, activity_id)
        if not is_authorized:
            await self.send(text_data=json.dumps({
                'error': 'Not authorized to join this activity chat'
            }))
            return

        room_group_name = f'activity_chat_{activity_id}'
        self.activity_rooms.add(room_group_name)

        # Join the activity chat room
        await self.channel_layer.group_add(
            room_group_name,
            self.channel_name
        )

        await self.send(text_data=json.dumps({
            'type': 'joined_activity',
            'activityId': activity_id,
            'message': f'Joined activity chat {activity_id}'
        }))

    async def leave_activity(self, data):
        activity_id = data.get('activityId')
        if not activity_id:
            return

        room_group_name = f'activity_chat_{activity_id}'
        if room_group_name in self.activity_rooms:
            self.activity_rooms.remove(room_group_name)
            await self.channel_layer.group_discard(
                room_group_name,
                self.channel_name
            )

    async def send_activity_message(self, data):
        activity_id = data.get('activityId')
        message_text = data.get('message')

        if not activity_id or not message_text:
            await self.send(text_data=json.dumps({
                'error': 'activityId and message are required'
            }))
            return

        # Check authorization
        is_authorized = await self.check_activity_access(self.user, activity_id)
        if not is_authorized:
            await self.send(text_data=json.dumps({
                'error': 'Not authorized to send messages'
            }))
            return

        # Save message to database
        saved_message = await self.save_activity_message(self.user, activity_id, message_text)

        if saved_message:
            # Send message to activity room
            room_group_name = f'activity_chat_{activity_id}'
            await self.channel_layer.group_send(
                room_group_name,
                {
                    'type': 'chat_message',
                    'data': {
                        'id': saved_message.id,
                        'message': saved_message.text,
                        'userId': saved_message.sender.id,
                        'user': {
                            'id': saved_message.sender.id,
                            'firstName': saved_message.sender.first_name,
                            'email': saved_message.sender.email
                        },
                        'createdAt': saved_message.created_at.isoformat(),
                    },
                    'activityId': activity_id
                }
            )

    async def chat_message(self, event):
        # Send message to WebSocket
        await self.send(text_data=json.dumps(event))

    @database_sync_to_async
    def check_activity_access(self, user, activity_id):
        try:
            activity = Activity.objects.get(id=activity_id)
            return ActivityParticipant.objects.filter(
                activity=activity,
                user=user,
                status='confirmed'
            ).exists()
        except Activity.DoesNotExist:
            return False

    @database_sync_to_async
    def save_activity_message(self, user, activity_id, message_text):
        try:
            activity = Activity.objects.get(id=activity_id)
            participants = ActivityParticipant.objects.filter(
                activity=activity,
                status='confirmed'
            ).select_related('user').order_by('joined_at', 'id')

            if participants.count() >= 2:
                # Create or get match for this activity with deterministic ordering
                user_a = participants.first().user
                user_b = participants.last().user

                match, created = Match.get_or_create_normalized(
                    activity=activity,
                    user_one=user_a,
                    user_two=user_b
                )

                # Create or get conversation
                conversation, created = Conversation.objects.get_or_create(match=match)

                # Save message
                message = Message.objects.create(
                    conversation=conversation,
                    sender=user,
                    text=message_text
                )
                return message
        except Exception as e:
            print(f"Error saving message: {e}")
            return None

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.conversation_id = self.scope['url_route']['kwargs']['conversation_id']
        self.room_group_name = f'chat_{self.conversation_id}'

        # Check if user is authenticated and authorized
        user = self.scope.get('user', AnonymousUser())
        if user.is_anonymous:
            await self.close()
            return

        # Check if user is part of this conversation
        is_authorized = await self.check_conversation_access(user, self.conversation_id)
        if not is_authorized:
            await self.close()
            return

        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()

    async def disconnect(self, close_code):
        # Leave room group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        text_data_json = json.loads(text_data)
        message = text_data_json['message']

        user = self.scope['user']

        # Save message to database
        saved_message = await self.save_message(user, self.conversation_id, message)

        # Send message to room group
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'chat_message',
                'message': saved_message.text,
                'sender': user.username,
                'timestamp': saved_message.created_at.isoformat(),
            }
        )

    async def chat_message(self, event):
        # Send message to WebSocket
        await self.send(text_data=json.dumps({
            'message': event['message'],
            'sender': event['sender'],
            'timestamp': event['timestamp'],
        }))

    @database_sync_to_async
    def check_conversation_access(self, user, conversation_id):
        try:
            conversation = Conversation.objects.get(id=conversation_id)
            return user in [conversation.match.user_a, conversation.match.user_b]
        except Conversation.DoesNotExist:
            return False

    @database_sync_to_async
    def save_message(self, user, conversation_id, message_text):
        conversation = Conversation.objects.get(id=conversation_id)
        message = Message.objects.create(
            conversation=conversation,
            sender=user,
            text=message_text
        )
        return message
