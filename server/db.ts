import { Pool as PgPool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";
import dotenv from "dotenv";
import type { DrizzleType } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

// Ensure environment variables are loaded
dotenv.config({ path: process.cwd() + '/.env' });

console.log("DATABASE_URL:", process.env.DATABASE_URL ? "Set" : "Not set");
console.log("PORT:", process.env.PORT || "Not set (defaulting to 4001)");
console.log("NODE_ENV:", process.env.NODE_ENV || "Not set");

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Determine if we're using a local database or Neon
const isLocalDatabase = process.env.DATABASE_URL.includes('localhost') || 
                        process.env.DATABASE_URL.includes('127.0.0.1');

let pool;
let db: NodePgDatabase<typeof schema>;

if (isLocalDatabase) {
  console.log("Using local PostgreSQL database");
  // Use standard pg Pool for local PostgreSQL with trust authentication
  const url = new URL(process.env.DATABASE_URL);
  pool = new PgPool({ 
    host: url.hostname,
    port: parseInt(url.port),
    database: url.pathname.slice(1),
    user: url.username,
    password: undefined, // Use undefined for trust authentication
    ssl: false
  });
  db = drizzle(pool, { schema });
} else {
  console.log("Using Neon serverless PostgreSQL database");
  // Use Neon serverless for cloud deployment
  neonConfig.webSocketConstructor = ws;
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzleNeon({ client: pool, schema });
}

export { pool, db };