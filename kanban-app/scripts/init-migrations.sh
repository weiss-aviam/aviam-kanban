#!/bin/bash

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

# Get all SQL migration files
MIGRATION_FILES=$(ls -1 "$MIGRATIONS_DIR"/*.sql 2>/dev/null | xargs -n 1 basename)

if [ -z "$MIGRATION_FILES" ]; then
    echo "ℹ️  No migration files found"
    exit 0
fi

echo "📋 Found migrations:"
echo "$MIGRATION_FILES" | sed 's/^/   - /'
echo ""

# Create JSON array
JSON_MIGRATIONS=$(echo "$MIGRATION_FILES" | jq -R -s -c 'split("\n") | map(select(length > 0))')

# Create tracker file
cat > "$TRACKER_FILE" <<EOF
{
  "migrations": $JSON_MIGRATIONS,
  "lastApplied": "$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")"
}
EOF

echo "✅ Migration tracker initialized: $TRACKER_FILE"
echo ""
echo "All existing migrations have been marked as applied."
echo "Future migrations will be applied automatically during deployment."

