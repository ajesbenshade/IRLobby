import dotenv from "dotenv";
dotenv.config({ path: process.cwd() + '/.env' });

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { getSession } from "./auth";
import cookieParser from "cookie-parser";
import fs from 'fs';
import path from 'path';
import { db } from './db';

let setupVite: (app: any, server: any) => Promise<void> = async () => {};
let serveStatic: (app: any) => void = () => {};
let log: (message: string, source?: string) => void = console.log;

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(getSession());

app.use((req, res, next) => {
  const start = Date.now();
  const p = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;
  const originalResJson = res.json as any;
  (res as any).json = function (bodyJson: any, ...args: any[]) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (p.startsWith("/api")) {
      let logLine = `${req.method} ${p} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      if (logLine.length > 80) logLine = logLine.slice(0, 79) + "…";
      log(logLine);
    }
  });
  next();
});

app.get('/api/health', (_req, res) => {
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
  res.status(200).json({ status: 'ok', phase: 'pre-init', timestamp: new Date().toISOString(), buildStatus });
});

app.get('/api/health/post-init', (_req, res) => {
  res.status(200).json({ status: 'ok', phase: 'post-init', timestamp: new Date().toISOString() });
});

function serveStaticProd(app: any) {
  const distPath = path.resolve(process.cwd(), "dist", "public");
  console.log(`Looking for static files in: ${distPath}`);
  if (!fs.existsSync(distPath)) {
    console.error(`Could not find the build directory: ${distPath}`);
    throw new Error(`Could not find the build directory: ${distPath}, make sure to build the client first`);
  }
  console.log(`Serving static files from: ${distPath}`);
  app.use(express.static(distPath));
  app.use("*", (_req: any, res: any) => {
    const indexPath = path.resolve(distPath, "index.html");
    res.sendFile(indexPath);
  });
}

async function runMigrations() {
  try {
    if (!process.env.DATABASE_URL) {
      console.log("⚠️ No DATABASE_URL found, skipping migration");
      return;
    }
    const { migrate } = await import('drizzle-orm/node-postgres/migrator');
    const migrationsFolder = path.resolve(process.cwd(), 'migrations');
    console.log('📁 Migrations folder:', migrationsFolder);
    await migrate(db as any, { migrationsFolder });
    console.log('✅ Migrations completed');
  } catch (error) {
    console.error('❌ Database migration error:', error instanceof Error ? error.message : String(error));
    console.log('⚠️ Continuing without migration - tables may already exist');
  }
}

(async () => {
  console.log('� Starting IRLobby server initialization...');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('PORT:', process.env.PORT);
  console.log('DATABASE_URL available:', !!process.env.DATABASE_URL);
  console.log('Current working directory:', process.cwd());
  console.log('Directory contents:', fs.readdirSync(process.cwd()));

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
    console.log('� Production mode - using static file serving');
    serveStatic = serveStaticProd as any;
  }

  try {
    await runMigrations();

    const server = await registerRoutes(app);

    if (app.get("env") === "development") {
      console.log('� Setting up Vite development server...');
      await setupVite(app, server);
      console.log('✅ Vite development server ready');
    } else {
      console.log('📦 Setting up static file serving...');
      serveStatic(app);
      console.log('✅ Static file serving ready');
    }

    const port = process.env.PORT ? parseInt(process.env.PORT) : 4001;
    console.log(`🌐 Starting server on port ${port}...`);

    server.listen({
      port,
      host: "0.0.0.0",
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
 
