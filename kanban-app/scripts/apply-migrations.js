#!/usr/bin/env node

/**
 * Apply Database Migrations to Supabase
 *
 * This script reads migration files and applies them to Supabase.
 * Since direct connection has IPv6 issues, we use the pooler connection.
 */

const fs = require('fs');
const path = require('path');
const postgres = require('postgres');

// Load environment variables
// Try .env first (production), then .env.local (development)
const envFile = fs.existsSync('.env') ? '.env' : '.env.local';
require('dotenv').config({ path: envFile });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in environment variables');
  process.exit(1);
}

// Read migration tracking file
const MIGRATION_TRACKER_FILE = path.join(__dirname, '../.migrations-applied.json');

function getAppliedMigrations() {
  if (fs.existsSync(MIGRATION_TRACKER_FILE)) {
    return JSON.parse(fs.readFileSync(MIGRATION_TRACKER_FILE, 'utf8'));
  }
  return { migrations: [] };
}

function markMigrationApplied(filename) {
  const tracker = getAppliedMigrations();
  if (!tracker.migrations.includes(filename)) {
    tracker.migrations.push(filename);
    tracker.lastApplied = new Date().toISOString();
    fs.writeFileSync(MIGRATION_TRACKER_FILE, JSON.stringify(tracker, null, 2));
  }
}

// Main migration function
async function applyMigrations() {
  console.log('🔍 Checking for pending migrations...\n');

  const migrationsDir = path.join(__dirname, '../src/db/migrations');

  if (!fs.existsSync(migrationsDir)) {
    console.log('ℹ️  No migrations directory found');
    return;
  }

  const appliedMigrations = getAppliedMigrations();
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort(); // Apply in alphabetical order

  const pendingMigrations = migrationFiles.filter(
    file => !appliedMigrations.migrations.includes(file)
  );

  if (pendingMigrations.length === 0) {
    console.log('✅ No pending migrations to apply\n');
    return;
  }

  console.log(`📋 Found ${pendingMigrations.length} pending migration(s):\n`);
  pendingMigrations.forEach(file => console.log(`   - ${file}`));
  console.log('');

  // Connect to database
  const sql = postgres(DATABASE_URL, {
    max: 1,
    ssl: 'require',
    connection: {
      application_name: 'kanban_migrations'
    }
  });

  try {
    for (const file of pendingMigrations) {
      const filePath = path.join(migrationsDir, file);
      const migrationSql = fs.readFileSync(filePath, 'utf8');

      console.log(`⏳ Applying migration: ${file}...`);

      try {
        // Execute the migration SQL
        await sql.unsafe(migrationSql);
        markMigrationApplied(file);
        console.log(`✅ Successfully applied: ${file}\n`);
      } catch (error) {
        console.error(`❌ Failed to apply migration: ${file}`);
        console.error(`   Error: ${error.message}\n`);
        console.error('⚠️  Migration failed! Aborting deployment.\n');
        await sql.end();
        process.exit(1);
      }
    }

    console.log('🎉 All migrations applied successfully!\n');
  } finally {
    await sql.end();
  }
}

// Run migrations
applyMigrations().catch(error => {
  console.error('❌ Migration process failed:', error);
  process.exit(1);
});

