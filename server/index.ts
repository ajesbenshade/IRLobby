import dotenv from "dotenv";
// Load environment variables before importing any other modules
dotenv.config({ path: process.cwd() + '/.env' });

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { getSession } from "./auth"; // Import session middleware from our new auth system
import cookieParser from "cookie-parser"; // Import cookie-parser for handling cookies

// Define vite functions with proper type signatures
let setupVite: (app: any, server: any) => Promise<void> = async () => {};
let serveStatic: (app: any) => void = () => {};
let log: (message: string, source?: string) => void = console.log;

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser()); // Add cookie-parser middleware
app.use(getSession()); // Add session middleware

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Early health check endpoint - BEFORE any middleware
app.get('/api/health', (_req, res) => {
  const fs = require('fs');
  const path = require('path');
  const distPath = path.resolve(process.cwd(), "dist", "public");
  
  const buildStatus = {
    cwd: process.cwd(),
    distExists: fs.existsSync(path.resolve(process.cwd(), "dist")),
    publicExists: fs.existsSync(distPath),
    indexExists: fs.existsSync(path.resolve(distPath, "index.html")),
    directoryContents: fs.existsSync(process.cwd()) ? fs.readdirSync(process.cwd()) : [],
    distContents: fs.existsSync(path.resolve(process.cwd(), "dist")) ? fs.readdirSync(path.resolve(process.cwd(), "dist")) : [],
    publicContents: fs.existsSync(distPath) ? fs.readdirSync(distPath) : []
  };
  
  console.log('Build status check:', JSON.stringify(buildStatus, null, 2));
  
  res.status(200).json({ 
    status: 'ok', 
    phase: 'pre-init', 
    timestamp: new Date().toISOString(),
    buildStatus: buildStatus
  });
});

// Add another health check after middleware setup
app.get('/api/health/post-init', (_req, res) => {
  console.log('Post-init health check requested at', new Date().toISOString());
  res.status(200).json({ status: 'ok', phase: 'post-init', timestamp: new Date().toISOString() });
});

// Debug endpoint to check if build files exist
app.get('/api/debug/build-status', (_req, res) => {
  const fs = require('fs');
  const path = require('path');
  const distPath = path.resolve(process.cwd(), "dist", "public");
  
  const debugInfo = {
    cwd: process.cwd(),
    distExists: fs.existsSync(path.resolve(process.cwd(), "dist")),
    publicExists: fs.existsSync(distPath),
    indexExists: fs.existsSync(path.resolve(distPath, "index.html")),
    directoryContents: fs.existsSync(process.cwd()) ? fs.readdirSync(process.cwd()) : [],
    distContents: fs.existsSync(path.resolve(process.cwd(), "dist")) ? fs.readdirSync(path.resolve(process.cwd(), "dist")) : [],
    publicContents: fs.existsSync(distPath) ? fs.readdirSync(distPath) : [],
    timestamp: new Date().toISOString()
  };
  
  console.log('Build status debug:', JSON.stringify(debugInfo, null, 2));
  res.json(debugInfo);
});

// Run database migrations on startup
async function runMigrations() {
  try {
    console.log("🔄 Running database migrations...");
    console.log("DATABASE_URL available:", !!process.env.DATABASE_URL);
    console.log("DATABASE_URL preview:", process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 30) + "..." : "Not set");
    console.log("NODE_ENV:", process.env.NODE_ENV);
    console.log("RAILWAY_ENVIRONMENT:", process.env.RAILWAY_ENVIRONMENT);

    if (!process.env.DATABASE_URL) {
      console.log("⚠️ No DATABASE_URL found, skipping migration");
      return;
    }

    // Handle Railway's internal vs external DATABASE_URL
    let dbUrl = process.env.DATABASE_URL;
    if (process.env.RAILWAY_ENVIRONMENT && dbUrl.includes('postgres.railway.internal')) {
      console.log("🔄 Using Railway internal connection");
    } else if (dbUrl.includes('tramway.proxy.rlwy.net')) {
      console.log("🔄 Using Railway external connection");
    } else {
      console.log("🔄 Using custom database connection");
    }

    // Import required modules
    const { Pool } = await import('pg');

    console.log("📋 Connecting to database...");
    // Add connection options for Railway
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 5000, // 5 second timeout
      query_timeout: 5000,
      ssl: false // Railway internal connections don't need SSL
    });

    // Test the connection first
    console.log("🔍 Testing database connection...");
    const testResult = await pool.query('SELECT 1 as test');
    console.log("✅ Database connection successful:", testResult.rows[0]);

    // Check if tables already exist
    const existingTables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('users', 'activities', 'activity_swipes', 'activity_matches', 'chat_rooms', 'chat_messages')
    `);
    console.log("📊 Existing tables:", existingTables.rows.length);

    if (existingTables.rows.length >= 6) {
      console.log("✅ All tables already exist, skipping migration");
      await pool.end();
      return;
    }

    console.log("⚠️ Tables missing, but skipping creation (created manually)");
    await pool.end();

  } catch (error) {
    console.error("❌ Database migration error:", error instanceof Error ? error.message : String(error));
    console.log("⚠️ Continuing without migration - tables may already exist");
    // Don't exit process, just log the error
  }
}

(async () => {
  console.log('🚀 Starting IRLobby server initialization...');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('PORT:', process.env.PORT);
  console.log('DATABASE_URL available:', !!process.env.DATABASE_URL);
  console.log('Current working directory:', process.cwd());
  console.log('Directory contents:', (await import('fs')).readdirSync(process.cwd()));

  // Conditionally import vite functions only in development
  if (process.env.NODE_ENV !== 'production') {
    try {
      const viteModule = await import("./vite");
      setupVite = viteModule.setupVite;
      serveStatic = viteModule.serveStatic;
      log = viteModule.log;
      console.log('✅ Vite functions loaded for development');
    } catch (error) {
      console.warn('⚠️ Failed to load vite functions:', error);
    }
  } else {
    console.log('📦 Production mode - using static file serving');
  }

  try {
    // Run database migrations first
    await runMigrations();
    
    console.log('📋 Registering routes...');
    const server = await registerRoutes(app);
    console.log('✅ Routes registered successfully');

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      res.status(status).json({ message });
      throw err;
    });

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (app.get("env") === "development") {
      console.log('🔧 Setting up Vite development server...');
      await setupVite(app, server);
      console.log('✅ Vite development server ready');
    } else {
      console.log('📦 Setting up static file serving...');
      // Never import client vite config in production to avoid __dirname issues
      serveStatic(app);
      console.log('✅ Static file serving ready');
    }

    // Serve on Railway's provided port or default to 4001
    const port = process.env.PORT ? parseInt(process.env.PORT) : 4001;
    console.log(`🌐 Starting server on port ${port}...`);
    
    server.listen({
      port,
      host: "0.0.0.0", // Use 0.0.0.0 for Railway
    }, () => {
      console.log(`🚀 IRLobby server started successfully on port ${port}`);
      console.log(`📊 Health check available at http://localhost:${port}/api/health`);
      log(`serving on port ${port}`);
    });
  } catch (error) {
    console.error('❌ Failed to start IRLobby server:', error);
    console.error('Error details:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
})();
