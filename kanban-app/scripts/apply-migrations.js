#!/usr/bin/env node

/**
 * Apply Database Migrations to Supabase
 * 
 * This script reads migration files and applies them to Supabase using the REST API.
 * It works around the IPv6 connection issue by using Supabase's Management API.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const SUPABASE_PROJECT_REF = 'sytznaqoznsazavumnry';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in environment variables');
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

// Execute SQL via Supabase REST API
async function executeSql(sql) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query: sql });
    
    const options = {
      hostname: 'api.supabase.com',
      port: 443,
      path: `/v1/projects/${SUPABASE_PROJECT_REF}/database/query`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(responseData));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(data);
    req.end();
  });
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

  for (const file of pendingMigrations) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');

    console.log(`⏳ Applying migration: ${file}...`);

    try {
      await executeSql(sql);
      markMigrationApplied(file);
      console.log(`✅ Successfully applied: ${file}\n`);
    } catch (error) {
      console.error(`❌ Failed to apply migration: ${file}`);
      console.error(`   Error: ${error.message}\n`);
      
      // Ask if we should continue or abort
      console.error('⚠️  Migration failed! Aborting deployment.\n');
      process.exit(1);
    }
  }

  console.log('🎉 All migrations applied successfully!\n');
}

// Run migrations
applyMigrations().catch(error => {
  console.error('❌ Migration process failed:', error);
  process.exit(1);
});

