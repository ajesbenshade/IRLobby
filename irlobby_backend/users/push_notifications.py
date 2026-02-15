import logging

import requests
from django.conf import settings

from .models import PushDeviceToken

logger = logging.getLogger(__name__)
INVALID_TOKEN_ERRORS = {'DeviceNotRegistered'}


def _is_push_enabled_for_user(user):
    preferences = user.preferences or {}
    notification_settings = preferences.get('notifications', {})
    return bool(notification_settings.get('pushNotifications', True))


def _active_tokens_for_user(user):
    return list(
        PushDeviceToken.objects.filter(user=user, is_active=True)
        .values_list('token', flat=True)
    )


def _deactivate_invalid_tokens(tokens, ticket_data):
    invalid_tokens = []
    for index, ticket in enumerate(ticket_data):
        if index >= len(tokens):
            break

        if not isinstance(ticket, dict):
            continue

        details = ticket.get('details') or {}
        error_code = details.get('error')
        if ticket.get('status') == 'error' and error_code in INVALID_TOKEN_ERRORS:
            invalid_tokens.append(tokens[index])

    if not invalid_tokens:
        return

    PushDeviceToken.objects.filter(token__in=invalid_tokens, is_active=True).update(is_active=False)
    logger.info('Deactivated %s invalid Expo push token(s)', len(invalid_tokens))


def send_push_to_user(user, title, body, data=None):
    if not _is_push_enabled_for_user(user):
        return

    tokens = _active_tokens_for_user(user)
    if not tokens:
        return

    payload = [
        {
            'to': token,
            'title': title,
            'body': body,
            'data': data or {},
            'sound': 'default',
        }
        for token in tokens
    ]

    headers = {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
    }

    if settings.EXPO_PUSH_ACCESS_TOKEN:
        headers['Authorization'] = f"Bearer {settings.EXPO_PUSH_ACCESS_TOKEN}"

    try:
        response = requests.post(
            settings.EXPO_PUSH_API_URL,
            json=payload,
            headers=headers,
            timeout=5,
        )

        if not response.ok:
            return

        response_data = response.json()
        ticket_data = response_data.get('data', []) if isinstance(response_data, dict) else []
        if isinstance(ticket_data, list):
            _deactivate_invalid_tokens(tokens, ticket_data)
    except Exception:
        logger.exception('Failed to send Expo push notification to user_id=%s', user.id)


def send_new_match_notifications(match):
    activity_title = match.activity.title if match.activity else 'an activity'
    payload = {
        'type': 'new_match',
        'matchId': match.id,
        'activityId': match.activity_id,
    }

    send_push_to_user(
        match.user_a,
        'New match confirmed',
        f'You matched with {match.user_b.username} for {activity_title}.',
        payload,
    )
    send_push_to_user(
        match.user_b,
        'New match confirmed',
        f'You matched with {match.user_a.username} for {activity_title}.',
        payload,
    )


def send_new_message_notification(message):
    conversation = message.conversation
    match = conversation.match
    recipient = match.user_b if message.sender_id == match.user_a_id else match.user_a

    sender_label = message.sender.first_name.strip() or message.sender.username
    payload = {
        'type': 'new_message',
        'conversationId': conversation.id,
        'matchId': match.id,
        'activityId': match.activity_id,
    }

    send_push_to_user(
        recipient,
        f'New message from {sender_label}',
        message.text[:120],
        payload,
    )
