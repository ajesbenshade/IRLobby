// Use a single pg client for both local and production to avoid import-time runtime deps
import { Pool as PgPool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
// Removed Neon serverless imports to simplify runtime in Railway
// import { Pool, neonConfig } from '@neondatabase/serverless';
// import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
// import ws from "ws";
import * as schema from "@shared/schema";
import dotenv from "dotenv";
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

// Ensure environment variables are loaded
if (process.env.NODE_ENV !== 'production' || !process.env.RAILWAY_ENVIRONMENT) {
  dotenv.config({ path: process.cwd() + '/.env' });
}

console.log("DATABASE_URL:", process.env.DATABASE_URL ? "Set" : "Not set");
console.log("PORT:", process.env.PORT || "Not set (defaulting to 4001)");
console.log("NODE_ENV:", process.env.NODE_ENV || "Not set");
console.log("RAILWAY_ENVIRONMENT:", process.env.RAILWAY_ENVIRONMENT || "Not set");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

let pool: PgPool;
let db: NodePgDatabase<typeof schema>;

// Always use pg with connection string
pool = new PgPool({ connectionString: process.env.DATABASE_URL, ssl: false });
db = drizzle(pool, { schema });

export { pool, db };