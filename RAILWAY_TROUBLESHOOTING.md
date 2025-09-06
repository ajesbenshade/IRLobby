# Railway Deployment Troubleshooting

## "Failed to get private network endpoint" Error

### Quick Fix Options:

#### Option 1: Redeploy the Project
1. Go to Railway dashboard
2. Click on your IRLobby project
3. Go to "Settings" tab
4. Click "Redeploy" button

#### Option 2: Check Build Logs
1. In Railway dashboard, click on your project
2. Go to "Deployments" tab
3. Click on the latest deployment
4. Check the build logs for specific errors

#### Option 3: Environment Variables
Make sure these are set in Railway:
```
SESSION_SECRET=your-secure-session-secret
JWT_SECRET=your-secure-jwt-secret
GOOGLE_MAPS_API_KEY=your-google-maps-api-key
VITE_GOOGLE_MAPS_API_KEY=your-google-maps-api-key
```

#### Option 4: Database Connection
Railway should automatically create a PostgreSQL database. If not:
1. Go to your project
2. Click "Add" → "Database" → "PostgreSQL"
3. Railway will set DATABASE_URL automatically

#### Option 5: Force Rebuild
If the above don't work, try:
1. Delete the current deployment
2. Push a small change to GitHub to trigger new build
3. Or use Railway's "Redeploy" feature

### Alternative: Manual Database Setup
If Railway database is having issues:
1. Remove the PostgreSQL service from Railway
2. Add it again
3. Wait for it to fully initialize
4. Then redeploy the app

### Check Railway Status
Sometimes Railway has temporary issues:
- Check https://railway.app/incidents for service status
- Try again in 10-15 minutes if there are incidents
