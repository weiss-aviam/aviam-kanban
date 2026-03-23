#!/usr/bin/env node

/**
 * Apply Database Migrations to Supabase
 *
 * This script reads migration files and applies them to Supabase.
 * Since direct connection has IPv6 issues, we use the pooler connection.
 */

const fs = require("fs");
const path = require("path");
const postgres = require("postgres");
const {
  listMigrationFiles,
  readMigrationTracker,
  writeMigrationTracker,
} = require("./migration-tracker");
const { checkMigrationsDir } = require("./check-migrations");

// Load environment variables
// Try .env first (production), then .env.local (development)
const envFile = fs.existsSync(".env") ? ".env" : ".env.local";
require("dotenv").config({ path: envFile });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL not found in environment variables");
  process.exit(1);
}

// Read migration tracking file
const MIGRATION_TRACKER_FILE = path.join(
  __dirname,
  "../.migrations-applied.json",
);

function getAppliedMigrations() {
  const { tracker, recovered } = readMigrationTracker(MIGRATION_TRACKER_FILE);

  if (recovered) {
    writeMigrationTracker(MIGRATION_TRACKER_FILE, tracker);
    console.warn(
      "⚠️  Rewrote a malformed migration tracker file using recovered migration entries.",
    );
  }

  return tracker;
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
  // ── Safety check: block any migration that would destroy user data ─────────
  const migrationsDir = path.join(__dirname, "../src/db/migrations");
  const violations = checkMigrationsDir(migrationsDir);
  if (violations.length > 0) {
    console.error("❌ Deployment blocked by migration safety check.\n");
    console.error(
      "   Run `node scripts/check-migrations.js` for full details.\n",
    );
    process.exit(1);
  }
  // ──────────────────────────────────────────────────────────────────────────

  console.log("🔍 Checking for pending migrations...\n");

  if (!fs.existsSync(migrationsDir)) {
    console.log("ℹ️  No migrations directory found");
    return;
  }

  const appliedMigrations = getAppliedMigrations();
  const migrationFiles = listMigrationFiles(migrationsDir);

  const pendingMigrations = migrationFiles.filter(
    (file) => !appliedMigrations.migrations.includes(file),
  );

  if (pendingMigrations.length === 0) {
    console.log("✅ No pending migrations to apply\n");
    return;
  }

  console.log(`📋 Found ${pendingMigrations.length} pending migration(s):\n`);
  pendingMigrations.forEach((file) => console.log(`   - ${file}`));
  console.log("");

  // Connect to database
  const sql = postgres(DATABASE_URL, {
    max: 1,
    ssl: "require",
    connection: {
      application_name: "kanban_migrations",
    },
  });

  try {
    for (const file of pendingMigrations) {
      const filePath = path.join(migrationsDir, file);
      const migrationSql = fs.readFileSync(filePath, "utf8");

      console.log(`⏳ Applying migration: ${file}...`);

      try {
        // Execute the migration SQL
        await sql.unsafe(migrationSql);
        markMigrationApplied(file);
        console.log(`✅ Successfully applied: ${file}\n`);
      } catch (error) {
        console.error(`❌ Failed to apply migration: ${file}`);
        console.error(`   Error: ${error.message}\n`);
        console.error("⚠️  Migration failed! Aborting deployment.\n");
        await sql.end();
        process.exit(1);
      }
    }

    console.log("🎉 All migrations applied successfully!\n");
  } finally {
    await sql.end();
  }
}

// Run migrations
applyMigrations().catch((error) => {
  console.error("❌ Migration process failed:", error);
  process.exit(1);
});
