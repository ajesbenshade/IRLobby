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
    
    const { execSync } = await import('child_process');
    const result = execSync('npx drizzle-kit push', { 
      stdio: 'pipe', 
      env: { ...process.env },
      encoding: 'utf8'
    });
    
    console.log("Migration output:", result);
    console.log("✅ Database migrations completed successfully");
  } catch (error) {
    console.error("❌ Database migration failed:", error);
    console.error("Migration error details:", error.message);
    console.error("Migration stderr:", error.stderr);
    
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
