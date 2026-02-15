#!/usr/bin/env python
"""
IRLobby Database Query Script
Run database queries against the database configured by DATABASE_URL.
"""

import os
import django

# Set up Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'irlobby_backend.settings')
django.setup()

from users.models import User
from activities.models import Activity, ActivityParticipant
from django.db.models import Count

def show_database_summary():
    """Show basic database statistics"""
    print("=== IRLobby Database Summary ===")
    print(f"Total Users: {User.objects.count()}")
    print(f"Total Activities: {Activity.objects.count()}")
    print(f"Total Activity Participants: {ActivityParticipant.objects.count()}")

def show_recent_activities():
    """Show recent activities"""
    print("\n=== Recent Activities ===")
    activities = Activity.objects.order_by('-created_at')[:5]
    for activity in activities:
        print(f"- {activity.title}")
        print(f"  Host: {activity.host.username}")
        print(f"  Location: {activity.location}")
        print(f"  Participants: {activity.participants.count()}/{activity.capacity}")
        print(f"  Time: {activity.time}")
        print()

def show_user_activity():
    """Show user activity statistics"""
    print("=== User Activity Stats ===")
    users = User.objects.annotate(
        hosted_count=Count('hosted_activities'),
        participated_count=Count('participating_activities')
    ).order_by('-hosted_count')[:5]

    for user in users:
        print(f"{user.username}: {user.hosted_count} hosted, {user.participated_count} participated")

def show_popular_tags():
    """Show most popular activity tags"""
    print("\n=== Popular Activity Tags ===")
    activities = Activity.objects.all()
    tag_counts = {}

    for activity in activities:
        for tag in activity.tags:
            tag_counts[tag] = tag_counts.get(tag, 0) + 1

    for tag, count in sorted(tag_counts.items(), key=lambda x: x[1], reverse=True)[:10]:
        print(f"{tag}: {count} activities")

if __name__ == "__main__":
    if not os.environ.get('DATABASE_URL'):
        raise RuntimeError('DATABASE_URL is required to run query_db.py')

    show_database_summary()
    show_recent_activities()
    show_user_activity()
    show_popular_tags()