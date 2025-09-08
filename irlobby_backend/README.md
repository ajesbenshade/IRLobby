# IRLobby Django Backend

A Django REST API backend for the IRLobby social activity matching platform, built with Django 5.2, Django REST Framework, and Django Channels for real-time features.

## Features

- **User Authentication**: JWT-based authentication with registration and login
- **Activity Management**: Create, join, and manage social activities
- **Swipe System**: Tinder-like swiping for activity discovery
- **Matching System**: Automatic matching based on mutual interest
- **Real-time Chat**: WebSocket-based messaging between matched users
- **Reviews & Ratings**: User feedback system for completed activities
- **Location-based Discovery**: Find activities near you

## Tech Stack

- **Django 5.2**: Web framework
- **Django REST Framework**: API development
- **Django Channels**: WebSocket support for real-time features
- **PostgreSQL/SQLite**: Database (configurable)
- **JWT Authentication**: Secure token-based auth
- **Daphne**: ASGI server for WebSockets

## Quick Start

### Prerequisites

- Python 3.8+
- pip (Python package manager)

### Installation

1. **Clone and navigate to the backend directory:**
   ```bash
   cd irlobby_backend
   ```

2. **Create and activate virtual environment:**
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. **Run migrations:**
   ```bash
   python manage.py migrate
   ```

6. **Create superuser:**
   ```bash
   python manage.py createsuperuser
   ```

7. **Run the development server:**
   ```bash
   python manage.py runserver
   ```

The API will be available at `http://localhost:8000`

## API Endpoints

### Authentication
- `POST /api/auth/token/` - Obtain JWT token pair
- `POST /api/auth/token/refresh/` - Refresh access token
- `POST /api/users/register/` - User registration
- `POST /api/users/login/` - User login
- `GET /api/users/profile/` - Get current user profile
- `PATCH /api/users/profile/` - Update user profile

### Activities
- `GET /api/activities/` - List activities (with location filtering)
- `POST /api/activities/` - Create new activity
- `GET /api/activities/{id}/` - Get activity details
- `PATCH /api/activities/{id}/` - Update activity
- `DELETE /api/activities/{id}/` - Delete activity
- `GET /api/activities/hosted/` - Get user's hosted activities
- `POST /api/activities/{id}/join/` - Join an activity
- `POST /api/activities/{id}/leave/` - Leave an activity

### Swipes
- `GET /api/swipes/` - List user's swipes
- `POST /api/swipes/{id}/swipe/` - Swipe on an activity (left/right)

### Matches
- `GET /api/matches/` - List user's matches

### Chat
- `GET /api/messages/conversations/` - List user's conversations
- `GET /api/messages/conversations/{id}/messages/` - Get conversation messages
- `POST /api/messages/conversations/{id}/messages/` - Send message
- `WebSocket ws://localhost:8000/ws/chat/{conversation_id}/` - Real-time chat

### Reviews
- `GET /api/reviews/` - List user's reviews
- `POST /api/reviews/` - Create review

## WebSocket Usage

Connect to chat rooms using WebSockets:

```javascript
const ws = new WebSocket('ws://localhost:8000/ws/chat/1/');

// Send message
ws.send(JSON.stringify({
    'message': 'Hello!'
}));

// Receive messages
ws.onmessage = function(event) {
    const data = JSON.parse(event.data);
    console.log(data.sender, data.message, data.timestamp);
};
```

## Database Models

### User
- Custom user model with bio, avatar, location, preferences
- Latitude/longitude for location-based features

### Activity
- Title, description, location, time, capacity
- Tags and images support
- Host relationship

### ActivityParticipant
- Links users to activities with status (pending/confirmed/declined)

### Swipe
- User swipes on activities (left = pass, right = interested)
- Unique constraint prevents duplicate swipes

### Match
- Created when two users mutually swipe right
- Links to activity and both users

### Conversation & Message
- Conversation per match
- Real-time messaging with WebSocket support

### Review
- Users can review each other after activities
- Rating (1-5) with optional comments

## Development

### Running Tests
```bash
python manage.py test
```

### Code Formatting
```bash
# Install black and isort
pip install black isort

# Format code
black .
isort .
```

### API Documentation
The API is documented using Django REST Framework's browsable API. Visit `http://localhost:8000/api/` for interactive documentation.

## Deployment

### Production Settings
- Set `DEBUG=False`
- Use PostgreSQL database
- Configure proper `SECRET_KEY`
- Set up static file serving
- Configure CORS settings

### Using Daphne for Production
```bash
pip install daphne
daphne irlobby_backend.asgi:application
```

### Using Gunicorn
```bash
gunicorn irlobby_backend.wsgi:application --bind 0.0.0.0:8000
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SECRET_KEY` | Django secret key | Required |
| `DEBUG` | Debug mode | `True` |
| `DATABASE_URL` | Database connection URL | `sqlite:///db.sqlite3` |
| `ALLOWED_HOSTS` | Comma-separated allowed hosts | `localhost,127.0.0.1` |
| `CORS_ALLOWED_ORIGINS` | CORS allowed origins | |

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

## License

This project is licensed under the MIT License.
