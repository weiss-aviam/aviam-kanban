#!/bin/bash

# Aviam Kanban Deployment Script
# This script handles database migrations and application deployment

set -e  # Exit on any error

echo "🚀 Starting Aviam Kanban deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from the kanban-app directory."
    exit 1
fi

# Load environment variables
# Try .env first (production), then .env.local (development)
if [ -f ".env" ]; then
    print_info "Loading environment variables from .env..."
    export $(cat .env | grep -v '^#' | xargs)
    print_success "Environment variables loaded from .env"
elif [ -f ".env.local" ]; then
    print_info "Loading environment variables from .env.local..."
    export $(cat .env.local | grep -v '^#' | xargs)
    print_success "Environment variables loaded from .env.local"
else
    print_error "No .env or .env.local file found!"
    exit 1
fi

# Step 1: Install dependencies
print_info "Installing dependencies..."
pnpm install --frozen-lockfile
print_success "Dependencies installed"

# Step 2: Apply database migrations
print_info "Checking for database migrations..."

# Check if there are pending migrations
if [ -d "src/db/migrations" ] && [ "$(ls -A src/db/migrations)" ]; then
    print_info "Found migrations directory with files"
    
    # Generate SQL from Drizzle schema
    print_info "Generating migration SQL from Drizzle schema..."
    pnpm db:generate
    
    # Check if there are new migration files
    MIGRATION_FILES=$(ls -t src/db/migrations/*.sql 2>/dev/null | head -1)
    
    if [ -n "$MIGRATION_FILES" ]; then
        print_info "Latest migration file: $MIGRATION_FILES"
        print_info "Applying migrations to Supabase..."
        
        # Apply migrations using a custom script
        node scripts/apply-migrations.js
        
        print_success "Database migrations applied"
    else
        print_info "No new migrations to apply"
    fi
else
    print_info "No migrations directory found, skipping migration step"
fi

# Step 3: Build the application
print_info "Building Next.js application..."
pnpm build
print_success "Application built successfully"

# Step 4: Deploy with PM2
print_info "Deploying with PM2..."

# Check if PM2 process is already running
if pm2 describe kanban-app > /dev/null 2>&1; then
    print_info "Reloading existing PM2 process..."
    pm2 reload ecosystem.config.js --update-env
    print_success "PM2 process reloaded"
else
    print_info "Starting new PM2 process..."
    pm2 start ecosystem.config.js
    print_success "PM2 process started"
fi

# Save PM2 process list
pm2 save

# Step 5: Show status
print_info "Deployment status:"
pm2 status

print_success "🎉 Deployment completed successfully!"
print_info "Application is running on port 8777"
print_info "View logs with: pm2 logs kanban-app"

