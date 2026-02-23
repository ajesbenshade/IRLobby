import json

from activities.models import Activity, ActivityParticipant
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from matches.models import Match
from redis.asyncio import Redis

from .models import Conversation, Message

PRESENCE_TTL_SECONDS = 120
TYPING_TTL_SECONDS = 10
READ_RECEIPT_TTL_SECONDS = 60 * 60 * 24 * 7

_redis_client = None


async def get_redis_client():
    global _redis_client
    if _redis_client is None:
        _redis_client = Redis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis_client


async def set_user_online(user_id):
    redis = await get_redis_client()
    await redis.setex(f"user_online:{user_id}", PRESENCE_TTL_SECONDS, "1")


async def clear_user_online(user_id):
    redis = await get_redis_client()
    await redis.delete(f"user_online:{user_id}")


class ActivityChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # Check if user is authenticated
        user = self.scope.get("user", AnonymousUser())
        if user.is_anonymous:
            await self.close()
            return

        await self.accept()
        self.user = user
        self.activity_rooms = set()  # Track which activity rooms this user is in
        await set_user_online(self.user.id)

    async def disconnect(self, close_code):
        # Leave all activity rooms
        for room in self.activity_rooms:
            await self.channel_layer.group_discard(room, self.channel_name)
            await self.channel_layer.group_send(
                room,
                {
                    "type": "presence_update",
                    "payload": {
                        "userId": self.user.id,
                        "isOnline": False,
                    },
                },
            )
        if hasattr(self, "user") and self.user and not self.user.is_anonymous:
            await clear_user_online(self.user.id)

    async def receive(self, text_data):
        try:
            text_data_json = json.loads(text_data)
            message_type = text_data_json.get("type")

            if message_type == "join_activity":
                await self.join_activity(text_data_json)
            elif message_type == "leave_activity":
                await self.leave_activity(text_data_json)
            elif message_type == "send_message":
                await self.send_activity_message(text_data_json)
            elif message_type == "typing":
                await self.handle_typing(text_data_json)
            elif message_type == "read_message":
                await self.handle_read_receipt(text_data_json)

        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({"error": "Invalid JSON format"}))
        except Exception as e:
            await self.send(text_data=json.dumps({"error": str(e)}))
        else:
            if hasattr(self, "user") and self.user and not self.user.is_anonymous:
                await set_user_online(self.user.id)

    async def join_activity(self, data):
        activity_id = data.get("activityId")
        if not activity_id:
            await self.send(text_data=json.dumps({"error": "activityId is required"}))
            return

        # Check if user is authorized to join this activity chat
        is_authorized = await self.check_activity_access(self.user, activity_id)
        if not is_authorized:
            await self.send(
                text_data=json.dumps({"error": "Not authorized to join this activity chat"})
            )
            return

        room_group_name = f"activity_chat_{activity_id}"
        self.activity_rooms.add(room_group_name)

        # Join the activity chat room
        await self.channel_layer.group_add(room_group_name, self.channel_name)

        await self.send(
            text_data=json.dumps(
                {
                    "type": "joined_activity",
                    "activityId": activity_id,
                    "message": f"Joined activity chat {activity_id}",
                }
            )
        )

        await self.channel_layer.group_send(
            room_group_name,
            {
                "type": "presence_update",
                "payload": {
                    "userId": self.user.id,
                    "isOnline": True,
                },
            },
        )

    async def leave_activity(self, data):
        activity_id = data.get("activityId")
        if not activity_id:
            return

        room_group_name = f"activity_chat_{activity_id}"
        if room_group_name in self.activity_rooms:
            self.activity_rooms.remove(room_group_name)
            await self.channel_layer.group_discard(room_group_name, self.channel_name)

    async def send_activity_message(self, data):
        activity_id = data.get("activityId")
        message_text = data.get("message")

        if not activity_id or not message_text:
            await self.send(text_data=json.dumps({"error": "activityId and message are required"}))
            return

        # Check authorization
        is_authorized = await self.check_activity_access(self.user, activity_id)
        if not is_authorized:
            await self.send(text_data=json.dumps({"error": "Not authorized to send messages"}))
            return

        # Save message to database
        saved_message = await self.save_activity_message(self.user, activity_id, message_text)

        if saved_message:
            # Send message to activity room
            room_group_name = f"activity_chat_{activity_id}"
            await self.channel_layer.group_send(
                room_group_name,
                {
                    "type": "chat_message",
                    "data": {
                        "id": saved_message.id,
                        "message": saved_message.text,
                        "userId": saved_message.sender.id,
                        "user": {
                            "id": saved_message.sender.id,
                            "firstName": saved_message.sender.first_name,
                            "email": saved_message.sender.email,
                        },
                        "createdAt": saved_message.created_at.isoformat(),
                    },
                    "activityId": activity_id,
                },
            )

    async def chat_message(self, event):
        # Send message to WebSocket
        await self.send(text_data=json.dumps(event))

    async def handle_typing(self, data):
        activity_id = data.get("activityId")
        if not activity_id:
            return

        is_typing = bool(data.get("isTyping", True))
        redis = await get_redis_client()
        key = f"typing:activity:{activity_id}:{self.user.id}"
        if is_typing:
            await redis.setex(key, TYPING_TTL_SECONDS, "1")
        else:
            await redis.delete(key)

        room_group_name = f"activity_chat_{activity_id}"
        await self.channel_layer.group_send(
            room_group_name,
            {
                "type": "typing_indicator",
                "payload": {
                    "activityId": int(activity_id),
                    "userId": self.user.id,
                    "isTyping": is_typing,
                },
            },
        )

    async def handle_read_receipt(self, data):
        activity_id = data.get("activityId")
        message_id = data.get("messageId")
        if not activity_id or not message_id:
            return

        redis = await get_redis_client()
        key = f"read:activity:{activity_id}:{self.user.id}"
        await redis.setex(key, READ_RECEIPT_TTL_SECONDS, str(message_id))

        room_group_name = f"activity_chat_{activity_id}"
        await self.channel_layer.group_send(
            room_group_name,
            {
                "type": "read_receipt",
                "payload": {
                    "activityId": int(activity_id),
                    "userId": self.user.id,
                    "messageId": int(message_id),
                },
            },
        )

    async def typing_indicator(self, event):
        await self.send(text_data=json.dumps(event))

    async def read_receipt(self, event):
        await self.send(text_data=json.dumps(event))

    async def presence_update(self, event):
        await self.send(text_data=json.dumps(event))

    @database_sync_to_async
    def check_activity_access(self, user, activity_id):
        try:
            activity = Activity.objects.get(id=activity_id)
            return ActivityParticipant.objects.filter(
                activity=activity, user=user, status="confirmed"
            ).exists()
        except Activity.DoesNotExist:
            return False

    @database_sync_to_async
    def save_activity_message(self, user, activity_id, message_text):
        try:
            activity = Activity.objects.get(id=activity_id)
            participants = (
                ActivityParticipant.objects.filter(activity=activity, status="confirmed")
                .select_related("user")
                .order_by("joined_at", "id")
            )

            if participants.count() >= 2:
                # Create or get match for this activity with deterministic ordering
                user_a = participants.first().user
                user_b = participants.last().user

                match, created = Match.get_or_create_normalized(
                    activity=activity, user_one=user_a, user_two=user_b
                )

                # Create or get conversation
                conversation, created = Conversation.objects.get_or_create(match=match)

                # Save message
                message = Message.objects.create(
                    conversation=conversation, sender=user, text=message_text
                )
                return message
        except Exception as e:
            print(f"Error saving message: {e}")
            return None


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.conversation_id = self.scope["url_route"]["kwargs"]["conversation_id"]
        self.room_group_name = f"chat_{self.conversation_id}"

        # Check if user is authenticated and authorized
        user = self.scope.get("user", AnonymousUser())
        if user.is_anonymous:
            await self.close()
            return

        # Check if user is part of this conversation
        is_authorized = await self.check_conversation_access(user, self.conversation_id)
        if not is_authorized:
            await self.close()
            return

        # Join room group
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)

        await self.accept()
        await set_user_online(user.id)
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "presence_update",
                "payload": {
                    "conversationId": int(self.conversation_id),
                    "userId": user.id,
                    "isOnline": True,
                },
            },
        )

    async def disconnect(self, close_code):
        # Leave room group
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)
        user = self.scope.get("user", AnonymousUser())
        if user and not user.is_anonymous:
            await clear_user_online(user.id)
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "presence_update",
                    "payload": {
                        "conversationId": int(self.conversation_id),
                        "userId": user.id,
                        "isOnline": False,
                    },
                },
            )

    async def receive(self, text_data):
        try:
            text_data_json = json.loads(text_data)
        except json.JSONDecodeError:
            await self.send(
                text_data=json.dumps({"type": "error", "message": "Invalid JSON payload."})
            )
            return

        message_type = text_data_json.get("type")
        if message_type == "typing":
            await self.handle_typing(text_data_json)
            await set_user_online(self.scope["user"].id)
            return
        if message_type == "read_message":
            await self.handle_read_receipt(text_data_json)
            await set_user_online(self.scope["user"].id)
            return

        message = str(text_data_json.get("message", "")).strip()
        if not message:
            await self.send(
                text_data=json.dumps({"type": "error", "message": "Message is required."})
            )
            return

        user = self.scope["user"]

        # Save message to database
        saved_message = await self.save_message(user, self.conversation_id, message)

        # Send message to room group
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "chat_message",
                "payload": {
                    "type": "chat.message",
                    "conversationId": int(self.conversation_id),
                    "id": saved_message.id,
                    "message": saved_message.text,
                    "userId": saved_message.sender.id,
                    "user": {
                        "id": saved_message.sender.id,
                        "firstName": saved_message.sender.first_name,
                        "email": saved_message.sender.email,
                    },
                    "createdAt": saved_message.created_at.isoformat(),
                },
            },
        )
        await set_user_online(user.id)

    async def chat_message(self, event):
        # Send message to WebSocket
        await self.send(text_data=json.dumps(event["payload"]))

    async def handle_typing(self, data):
        is_typing = bool(data.get("isTyping", True))
        user = self.scope["user"]
        redis = await get_redis_client()
        key = f"typing:chat:{self.conversation_id}:{user.id}"
        if is_typing:
            await redis.setex(key, TYPING_TTL_SECONDS, "1")
        else:
            await redis.delete(key)

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "typing_indicator",
                "payload": {
                    "conversationId": int(self.conversation_id),
                    "userId": user.id,
                    "isTyping": is_typing,
                },
            },
        )

    async def handle_read_receipt(self, data):
        message_id = data.get("messageId")
        if not message_id:
            return

        user = self.scope["user"]
        redis = await get_redis_client()
        key = f"read:chat:{self.conversation_id}:{user.id}"
        await redis.setex(key, READ_RECEIPT_TTL_SECONDS, str(message_id))

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "read_receipt",
                "payload": {
                    "conversationId": int(self.conversation_id),
                    "userId": user.id,
                    "messageId": int(message_id),
                },
            },
        )

    async def typing_indicator(self, event):
        await self.send(text_data=json.dumps(event["payload"]))

    async def read_receipt(self, event):
        await self.send(text_data=json.dumps(event["payload"]))

    async def presence_update(self, event):
        await self.send(text_data=json.dumps(event["payload"]))

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
        message = Message.objects.create(conversation=conversation, sender=user, text=message_text)
        return message
