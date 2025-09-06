#!/usr/bin/env node

import pg from 'pg';
const { Pool } = pg;

const DATABASE_URL = 'postgresql://postgres:XUxXyCVTnFDkWmWalGPhfOrGpiULajla@tramway.proxy.rlwy.net:15505/railway';

async function testConnection() {
  console.log('🔍 Testing Railway PostgreSQL connection...');

  const pool = new Pool({
    connectionString: DATABASE_URL,
    connectionTimeoutMillis: 10000,
  });

  try {
    const result = await pool.query('SELECT version()');
    console.log('✅ Connected successfully!');
    console.log('📊 PostgreSQL version:', result.rows[0].version.split(' ')[1]);

    // Check existing tables
    const tables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('📋 Existing tables:', tables.rows.length);
    tables.rows.forEach(row => console.log('  -', row.table_name));

    await pool.end();
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    process.exit(1);
  }
}

async function createTables() {
  console.log('🔨 Creating IRLobby tables...');

  const pool = new Pool({
    connectionString: DATABASE_URL,
  });

  try {
    // Create tables one by one
    console.log('Creating users table...');
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
      )
    `);

    console.log('Creating activities table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS activities (
        id SERIAL PRIMARY KEY,
        host_id VARCHAR NOT NULL,
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
      )
    `);

    console.log('Creating activity_swipes table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS activity_swipes (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR NOT NULL,
        activity_id INTEGER NOT NULL,
        swipe_type VARCHAR NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    console.log('Creating activity_matches table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS activity_matches (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR NOT NULL,
        activity_id INTEGER NOT NULL,
        status VARCHAR DEFAULT 'pending',
        joined_at TIMESTAMP,
        left_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    console.log('Creating chat_rooms table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_rooms (
        id SERIAL PRIMARY KEY,
        activity_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    console.log('Creating chat_messages table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        chat_room_id INTEGER NOT NULL,
        sender_id VARCHAR NOT NULL,
        message TEXT NOT NULL,
        message_type VARCHAR DEFAULT 'text',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Add foreign key constraints
    console.log('Adding foreign key constraints...');
    await pool.query(`
      ALTER TABLE activities ADD CONSTRAINT fk_activities_host_id
      FOREIGN KEY (host_id) REFERENCES users(id) ON DELETE CASCADE;

      ALTER TABLE activity_swipes ADD CONSTRAINT fk_activity_swipes_user_id
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

      ALTER TABLE activity_swipes ADD CONSTRAINT fk_activity_swipes_activity_id
      FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE;

      ALTER TABLE activity_matches ADD CONSTRAINT fk_activity_matches_user_id
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

      ALTER TABLE activity_matches ADD CONSTRAINT fk_activity_matches_activity_id
      FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE;

      ALTER TABLE chat_rooms ADD CONSTRAINT fk_chat_rooms_activity_id
      FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE;

      ALTER TABLE chat_messages ADD CONSTRAINT fk_chat_messages_chat_room_id
      FOREIGN KEY (chat_room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE;

      ALTER TABLE chat_messages ADD CONSTRAINT fk_chat_messages_sender_id
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE;
    `);

    console.log('✅ All tables created successfully!');

    // Verify tables were created
    const verifyTables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('users', 'activities', 'activity_swipes', 'activity_matches', 'chat_rooms', 'chat_messages')
      ORDER BY table_name
    `);

    console.log('📊 Verification - Created tables:', verifyTables.rows.length);
    verifyTables.rows.forEach(row => console.log('  ✅', row.table_name));

    await pool.end();
  } catch (error) {
    console.error('❌ Table creation failed:', error.message);
    process.exit(1);
  }
}

// Run the appropriate function based on command line args
const command = process.argv[2];

if (command === 'create') {
  createTables();
} else {
  testConnection();
}
