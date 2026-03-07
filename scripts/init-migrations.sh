#!/bin/bash

set -euo pipefail

# Initialize Migration Tracker
# This script marks all existing migrations as applied
# Use this when setting up the deployment system on an existing database

echo "🔧 Initializing migration tracker..."
echo ""

MIGRATIONS_DIR="src/db/migrations"
TRACKER_FILE=".migrations-applied.json"

if [ ! -d "$MIGRATIONS_DIR" ]; then
    echo "❌ Migrations directory not found: $MIGRATIONS_DIR"
    exit 1
fi

MIGRATION_FILES=$(find "$MIGRATIONS_DIR" -maxdepth 1 -type f -name "*.sql" -exec basename {} \; | sort)

if [ -z "$MIGRATION_FILES" ]; then
    echo "ℹ️  No migration files found"
    exit 0
fi

echo "📋 Found migrations:"
echo "$MIGRATION_FILES" | sed 's/^/   - /'
echo ""

node <<'NODE'
const path = require("path");
const { initializeMigrationTracker } = require("./scripts/migration-tracker");

const tracker = initializeMigrationTracker(
  path.join(process.cwd(), ".migrations-applied.json"),
  path.join(process.cwd(), "src/db/migrations"),
);

console.log(`✅ Migration tracker initialized with ${tracker.migrations.length} migration(s)`);
NODE

echo "✅ Migration tracker initialized: $TRACKER_FILE"
echo ""
echo "All existing migrations have been marked as applied."
echo "Future migrations will be applied automatically during deployment."

