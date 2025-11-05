#!/bin/bash

# Test Environment Variable Loading
# This script tests if environment variables are properly loaded

echo "🧪 Testing environment variable loading..."
echo ""

# Try .env first (production), then .env.local (development)
if [ -f ".env" ]; then
    echo "✓ Found .env file"
    set -a
    source .env
    set +a
    ENV_FILE=".env"
elif [ -f ".env.local" ]; then
    echo "✓ Found .env.local file"
    set -a
    source .env.local
    set +a
    ENV_FILE=".env.local"
else
    echo "❌ No .env or .env.local file found!"
    exit 1
fi

echo "✓ Loaded environment from: $ENV_FILE"
echo ""

# Check critical variables
echo "Checking critical environment variables:"
echo ""

if [ -n "$DATABASE_URL" ]; then
    echo "✓ DATABASE_URL is set: ${DATABASE_URL:0:50}..."
else
    echo "❌ DATABASE_URL is NOT set"
fi

if [ -n "$NEXT_PUBLIC_SUPABASE_URL" ]; then
    echo "✓ NEXT_PUBLIC_SUPABASE_URL is set: $NEXT_PUBLIC_SUPABASE_URL"
else
    echo "❌ NEXT_PUBLIC_SUPABASE_URL is NOT set"
fi

if [ -n "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "✓ SUPABASE_SERVICE_ROLE_KEY is set: ${SUPABASE_SERVICE_ROLE_KEY:0:20}..."
else
    echo "❌ SUPABASE_SERVICE_ROLE_KEY is NOT set"
fi

echo ""
echo "Testing drizzle-kit with loaded environment..."
pnpm db:check

echo ""
echo "✅ Environment test complete!"

