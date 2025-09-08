#!/bin/bash
# Build script for IRLobby Django backend

# Install dependencies
pip install -r requirements.txt

# Run database migrations
python manage.py migrate

# Collect static files
python manage.py collectstatic --noinput

echo "Build completed successfully"
