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
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Real-time**: WebSocket for chat functionality
- **UI Components**: Radix UI with custom styling

## Getting Started

### 🚀 Deploy to Railway (Recommended)
1. **Sign up for Railway**: [railway.app](https://railway.app)
2. **Push code to GitHub**
3. **Connect Railway to your repo**
4. **Railway auto-deploys with Docker + PostgreSQL**
5. **Your app is live!** 🎉

See [RAILWAY_DEPLOYMENT.md](RAILWAY_DEPLOYMENT.md) for detailed instructions.

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
