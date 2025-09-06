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

### 🚀 Deploy for FREE with Supabase + Vercel (Easiest)
1. **Set up Supabase**: Free PostgreSQL database
2. **Deploy backend to Vercel**: Free Node.js hosting
3. **Deploy frontend to Vercel**: Free React hosting
4. **Your app is live!** 🎉

See [SUPABASE_VERCEL_DEPLOYMENT.md](SUPABASE_VERCEL_DEPLOYMENT.md) for detailed instructions.

### 🏗️ Deploy to Railway (Recommended for Full Control)
1. **Sign up for Railway**: [railway.app](https://railway.app)
2. **Push code to GitHub**
3. **Connect Railway to your repo**
4. **Railway auto-deploys with Docker + PostgreSQL**
5. **Your app is live!** 🎉

See [RAILWAY_DEPLOYMENT.md](RAILWAY_DEPLOYMENT.md) for detailed instructions.

### 🐳 Deploy to VULTR (Self-hosted)
1. **Get VULTR VPS**: $6/month Ubuntu server
2. **Run deployment scripts**: Automated Docker setup
3. **SSL certificates**: Free Let's Encrypt
4. **Full control** over your infrastructure

See [VULTR_DEPLOYMENT.md](VULTR_DEPLOYMENT.md) for detailed instructions.

## Deployment

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
