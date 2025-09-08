# IRLobby - Your Lobby for IRL Meetups

**IRLobby** is a social activity matching app that combines Tinder-style swiping with event hosting. Connect with people in real life through shared activities and experiences.

## Tagline
"Your Lobby for IRL Meetups"

## Features
- **Activity Discovery**: Swipe through activities in your area
- **Event Hosting**: Create and host your own activities
- **Smart Matching**: Get matched with activities that fit your interests
- **Real-time Chat**: Connect with hosts and participants
- **Location-based**: Find activities near you
- **Comprehensive Settings**: Customize your experience with detailed privacy and notification controls

## Technology Stack
- **Frontend**: React, TypeScript, Tailwind CSS, Vite
- **Backend**: Django, Django REST Framework, Django Channels
- **Database**: SQLite (development) / PostgreSQL (production)
- **Real-time**: WebSocket for chat functionality
- **UI Components**: Radix UI with custom styling
- **Authentication**: JWT tokens

## Getting Started

### Prerequisites
- Python 3.8+
- Node.js 16+
- Git

### Local Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd IRLobby
   ```

2. **Set up the Django backend**
   ```bash
   cd irlobby_backend

   # Create virtual environment
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate

   # Install dependencies
   pip install -r requirements.txt

   # Run migrations
   python manage.py migrate

   # Create superuser (optional)
   python manage.py createsuperuser

   # Start Django server
   python manage.py runserver
   ```

3. **Set up the React frontend**
   ```bash
   cd ../client

   # Install dependencies
   npm install

   # Start development server
   npm run dev
   ```

4. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8000
   - Django Admin: http://localhost:8000/admin

## 🚀 Production Deployment

### Frontend (Vercel)
The React frontend is configured for Vercel deployment:

1. **Deploy to Vercel**
   ```bash
   cd client
   npm install -g vercel
   vercel login
   vercel --prod
   ```

2. **Environment Variables** (set in Vercel dashboard):
   ```
   VITE_API_BASE_URL=https://your-backend-url.onrender.com
   ```

### Backend (Render)
The Django backend is configured for Render with PostgreSQL:

1. **Connect Repository to Render**
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New" → "Blueprint"
   - Connect your GitHub repository
   - Render will detect `render.yaml` automatically

2. **Environment Variables** (Render will prompt for these):
   ```bash
   DEBUG=False
   SECRET_KEY=your-secret-key-here
   ALLOWED_HOSTS=your-render-app-name.onrender.com
   CORS_ALLOWED_ORIGINS=https://your-vercel-frontend-url.vercel.app
   ```

3. **Services Created**:
   - **Web Service**: Django application with Gunicorn
   - **Worker Service**: Daphne for WebSocket connections
   - **PostgreSQL Database**: Production database

### Deployment Architecture
```
Frontend (Vercel)
    ↓ API calls
Backend (Render - Django + DRF)
    ↓ Database queries
PostgreSQL (Render)
    ↓ Real-time communication
WebSocket Worker (Render - Daphne)
```

## Environment Variables

### Development
Copy `.env.example` to `.env` and configure:

```bash
# Django Configuration
SECRET_KEY=your_django_secret_key_here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# Database Configuration
DATABASE_URL=sqlite:///db.sqlite3
```

### Production
Set these in your deployment platform:

```bash
# Django Configuration
DEBUG=False
SECRET_KEY=your-production-secret-key
ALLOWED_HOSTS=your-backend-domain.onrender.com

# Database Configuration (auto-set by Render)
DATABASE_URL=postgresql://...

# CORS Configuration
CORS_ALLOWED_ORIGINS=https://your-frontend-domain.vercel.app

# Frontend Configuration
VITE_API_BASE_URL=https://your-backend-domain.onrender.com
```

## Project Structure

```
IRLobby/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── lib/           # Utilities and helpers
│   │   ├── pages/         # Page components
│   │   └── types/         # TypeScript types
│   ├── vite.config.ts     # Vite configuration
│   └── package.json
├── irlobby_backend/        # Django backend
│   ├── activities/         # Activities app
│   ├── users/             # User management app
│   ├── matches/           # Matching system app
│   ├── chat/              # Chat functionality app
│   ├── swipes/            # Swipe system app
│   └── reviews/           # Review system app
├── django_env/            # Python virtual environment
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/auth/token/` - Login
- `POST /api/users/register/` - Register
- `POST /api/auth/token/refresh/` - Refresh token

### Activities
- `GET /api/activities/` - List activities
- `POST /api/activities/` - Create activity
- `GET /api/activities/{id}/` - Get activity details
- `PUT /api/activities/{id}/` - Update activity
- `DELETE /api/activities/{id}/` - Delete activity
- `POST /api/activities/{id}/join/` - Join activity
- `POST /api/activities/{id}/leave/` - Leave activity
- `GET /api/activities/{id}/chat/` - Get chat messages
- `POST /api/activities/{id}/chat/` - Send chat message

### Users
- `GET /api/users/profile/` - Get user profile
- `PUT /api/users/profile/` - Update user profile

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

See RAILWAY_DEPLOYMENT.md for Railway specific steps.

### DigitalOcean App Platform

To avoid a double build (Node autodetect + Docker), force App Platform to use the Dockerfile:

- Ensure `Dockerfile` exists at the repo root.
- Use the App Spec under `.do/app.yaml` or `.do/deploy.template.yaml` which sets `dockerfile_path: ./Dockerfile`.
- In the App creation wizard, choose “Use existing app spec” and point to `.do/app.yaml`, or select Dockerfile when prompted.

Environment variables:

- `NODE_ENV=production`
- `DATABASE_URL` (append `?sslmode=require` for DO PostgreSQL or set `PGSSLMODE=require`)
- Any required app secrets (SESSION_SECRET, JWT_SECRET, etc.)

Build/Run inside Docker:

- Build: `npm run build` (builds client to `dist/public` and server to `dist/index.js`)
- Start: `npm start` (uses PORT provided by DO)

### Quick Start with Docker (Recommended)

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd irlobby
   ```

2. **Start with Docker Compose**
   ```bash
   # For development
   docker-compose -f docker-compose.dev.yml up --build

   # For production
   docker-compose up --build -d
   ```

3. **Access the application**
   - Frontend: http://localhost:4001
   - Database: localhost:5432

### Manual Setup

#### Prerequisites
- Node.js 18+
- PostgreSQL 13+

#### Installation
1. Clone the repository
2. Install dependencies: `npm install`
3. Set up your database in `.env`
4. Push database schema: `npm run db:push`
5. Start development server: `npm run dev`

#### Environment Variables
```
DATABASE_URL=postgresql://username:password@localhost:port/irlobby_app
```

## Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run db:push` - Push database schema changes
- `npm run db:seed` - Seed database with sample data

## Contributing
IRLobby is designed to bring people together through shared activities and real-world connections.

---
*IRLobby - Where digital connections become real-world experiences*
