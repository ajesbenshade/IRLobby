#!/usr/bin/env node

import { execSync } from 'child_process';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('🚀 Starting database migration...');
console.log('DATABASE_URL available:', !!process.env.DATABASE_URL);

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not found. Please set it in your environment variables.');
  process.exit(1);
}

try {
  console.log('📋 Running drizzle-kit push...');
  const result = execSync('npx drizzle-kit push', {
    stdio: 'inherit',
    env: { ...process.env },
    cwd: process.cwd()
  });

  console.log('✅ Migration completed successfully!');
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  process.exit(1);
}
