import dotenv from "dotenv";
// Load environment variables before importing any other modules
dotenv.config({ path: process.cwd() + '/.env' });

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { getSession } from "./auth"; // Import session middleware from our new auth system
import cookieParser from "cookie-parser"; // Import cookie-parser for handling cookies

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

// Run database migrations on startup
async function runMigrations() {
  try {
    console.log("🔄 Running database migrations...");
    console.log("DATABASE_URL available:", !!process.env.DATABASE_URL);
    console.log("DATABASE_URL starts with:", process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 20) + "..." : "Not set");
    console.log("NODE_ENV:", process.env.NODE_ENV);
    console.log("RAILWAY_ENVIRONMENT:", process.env.RAILWAY_ENVIRONMENT);
    
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is not set");
    }

    // Import required modules
    const { Pool } = await import('pg');
    
    console.log("📋 Connecting to database...");
    // Add connection options for Railway
    const pool = new Pool({ 
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 10000, // 10 second timeout
      query_timeout: 10000,
      ssl: false // Railway internal connections don't need SSL
    });
    
    // Wait a bit for database to be fully ready
    console.log("⏳ Waiting for database to be ready...");
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Test the connection first
    console.log("🔍 Testing database connection...");
    let testResult;
    try {
      testResult = await pool.query('SELECT 1 as test');
      console.log("✅ Database connection successful:", testResult.rows[0]);
    } catch (connError) {
      console.error("❌ Database connection test failed:", connError instanceof Error ? connError.message : String(connError));
      // Try one more time after a longer wait
      console.log("⏳ Retrying connection in 5 seconds...");
      await new Promise(resolve => setTimeout(resolve, 5000));
      testResult = await pool.query('SELECT 1 as test');
      console.log("✅ Database connection successful on retry:", testResult.rows[0]);
    }
    
    console.log("📋 Creating tables...");
    // First check if tables already exist
    const existingTables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'activities', 'activity_swipes', 'activity_matches')
    `);
    console.log("📊 Existing tables:", existingTables.rows.map(r => r.table_name));
    
    if (existingTables.rows.length >= 4) {
      console.log("✅ All tables already exist, skipping migration");
      await pool.end();
      return;
    }
    
    // Create tables manually using raw SQL
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR PRIMARY KEY,
        email VARCHAR UNIQUE,
        first_name VARCHAR,
        last_name VARCHAR,
        password_hash VARCHAR,
        profile_image_url VARCHAR,
        bio TEXT,
        interests JSONB DEFAULT '[]'::jsonb,
        photo_album JSONB DEFAULT '[]'::jsonb,
        location VARCHAR,
        latitude REAL,
        longitude REAL,
        rating REAL DEFAULT 5.0,
        total_ratings INTEGER DEFAULT 0,
        events_hosted INTEGER DEFAULT 0,
        events_attended INTEGER DEFAULT 0,
        is_verified BOOLEAN DEFAULT false,
        verification_level VARCHAR DEFAULT 'none',
        push_notifications BOOLEAN DEFAULT true,
        email_notifications BOOLEAN DEFAULT true,
        activity_reminders BOOLEAN DEFAULT true,
        new_match_notifications BOOLEAN DEFAULT true,
        message_notifications BOOLEAN DEFAULT true,
        profile_visibility VARCHAR DEFAULT 'public',
        location_sharing BOOLEAN DEFAULT true,
        show_age BOOLEAN DEFAULT true,
        show_email BOOLEAN DEFAULT false,
        theme VARCHAR DEFAULT 'system',
        language VARCHAR DEFAULT 'en',
        distance_unit VARCHAR DEFAULT 'miles',
        max_distance INTEGER DEFAULT 25,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS activities (
        id SERIAL PRIMARY KEY,
        host_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR NOT NULL,
        description TEXT,
        category VARCHAR NOT NULL,
        location VARCHAR NOT NULL,
        latitude REAL,
        longitude REAL,
        date_time TIMESTAMP NOT NULL,
        end_date_time TIMESTAMP,
        max_participants INTEGER NOT NULL,
        current_participants INTEGER DEFAULT 0,
        waitlist_count INTEGER DEFAULT 0,
        is_private BOOLEAN DEFAULT false,
        tags JSONB DEFAULT '[]'::jsonb,
        image_url VARCHAR,
        image_urls JSONB DEFAULT '[]'::jsonb,
        price REAL DEFAULT 0,
        currency VARCHAR DEFAULT 'USD',
        requires_approval BOOLEAN DEFAULT false,
        age_restriction VARCHAR,
        skill_level VARCHAR,
        equipment_provided BOOLEAN DEFAULT false,
        equipment_required TEXT,
        weather_dependent BOOLEAN DEFAULT false,
        status VARCHAR DEFAULT 'active',
        cancellation_reason TEXT,
        recurring_pattern VARCHAR,
        reminder_sent BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS activity_swipes (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
        swipe_type VARCHAR NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS activity_matches (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
        status VARCHAR DEFAULT 'pending',
        joined_at TIMESTAMP,
        left_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS chat_rooms (
        id SERIAL PRIMARY KEY,
        activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        chat_room_id INTEGER NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
        sender_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        message TEXT NOT NULL,
        message_type VARCHAR DEFAULT 'text',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    console.log("✅ Database tables created successfully");
    await pool.end();
  } catch (error) {
    console.error("❌ Database migration failed:", error);
    console.error("Migration error details:", error instanceof Error ? error.message : String(error));
    
    // Try a simple database connection test
    try {
      console.log("🔍 Testing database connection...");
      const { db } = await import('./db');
      await db.execute('SELECT 1');
      console.log("✅ Database connection successful");
    } catch (dbError) {
      console.error("❌ Database connection failed:", dbError instanceof Error ? dbError.message : String(dbError));
    }
    
    // Don't exit process, just log the error
    // The app might still work if tables already exist
  }
}

(async () => {
  try {
    // Run database migrations first
    await runMigrations();
    
    const server = await registerRoutes(app);

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
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // Serve on Railway's provided port or default to 4001
    const port = process.env.PORT ? parseInt(process.env.PORT) : 4001;
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
    process.exit(1);
  }
})();
