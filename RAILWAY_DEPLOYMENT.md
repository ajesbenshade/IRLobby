# IRLobby Railway Deployment Guide

## 🚀 Deploy to Railway

### Prerequisites
- GitHub account
- Railway account (sign up at railway.app)

### Step 1: Push Code to GitHub
```bash
git add .
git commit -m "Ready for Railway deployment"
git push origin main
```

### Step 2: Connect to Railway
1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click "New Project"
3. Choose "Deploy from GitHub repo"
4. Select your IRLobby repository
5. Click "Deploy"

### Step 3: Configure Environment Variables
In Railway dashboard, go to your project settings and add:

```
SESSION_SECRET=your-secure-random-session-secret
JWT_SECRET=your-secure-random-jwt-secret
GOOGLE_MAPS_API_KEY=your-google-maps-api-key
VITE_GOOGLE_MAPS_API_KEY=your-google-maps-api-key
```

### Step 4: Database Setup
Railway will automatically:
- ✅ Detect your Dockerfile
- ✅ Create a PostgreSQL database
- ✅ Set DATABASE_URL environment variable
- ✅ Run database migrations

### Step 5: Access Your App
Once deployment is complete, Railway will provide a URL like:
`https://irlobby-production.up.railway.app`

## 🔧 Troubleshooting

### Build Issues
- Check Railway build logs
- Ensure Dockerfile is in root directory
- Verify package.json scripts are correct

### Database Issues
- Railway automatically provides DATABASE_URL
- Check database connection in Railway logs
- Run migrations manually if needed

### Environment Variables
- All env vars must be set in Railway dashboard
- Don't commit secrets to GitHub
- Use Railway's environment variable management

## 📊 Railway Features Used
- ✅ Docker deployment
- ✅ PostgreSQL database
- ✅ Automatic SSL
- ✅ Environment variables
- ✅ Build logs
- ✅ Deployment previews

## 🎯 What's Included
- Full-stack React + Node.js app
- PostgreSQL database with Drizzle ORM
- Docker containerization
- Production-ready configuration
- Health checks and monitoring

Your IRLobby app will be live and accessible worldwide! 🌍
