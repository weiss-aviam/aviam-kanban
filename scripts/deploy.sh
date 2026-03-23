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
    set -a  # Automatically export all variables
    source .env
    set +a
    print_success "Environment variables loaded from .env"
elif [ -f ".env.local" ]; then
    print_info "Loading environment variables from .env.local..."
    set -a  # Automatically export all variables
    source .env.local
    set +a
    print_success "Environment variables loaded from .env.local"
else
    print_error "No .env or .env.local file found!"
    exit 1
fi

# Step 1: Install dependencies
# NODE_ENV is forced to 'development' here so pnpm installs devDependencies
# (TypeScript, ESLint, etc.) even when the .env file sets NODE_ENV=production.
# The production NODE_ENV is restored for the build step below.
print_info "Installing dependencies (including devDependencies for build)..."
NODE_ENV=development pnpm install --frozen-lockfile
print_success "Dependencies installed"

# Step 2: Build the application
# NOTE: Migrations are intentionally NOT run here.
# Production and development share the same database. Migrations must be
# applied manually by the developer BEFORE deploying using:
#   node scripts/apply-migrations.js
# Running them automatically during deployment risks data loss on a live DB.
print_info "Building Next.js application..."
pnpm build
print_success "Application built successfully"

# Step 3: Deploy with PM2
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

# Step 4: Show status
print_info "Deployment status:"
pm2 status

print_success "🎉 Deployment completed successfully!"
print_info "Application is running on port 8777"
print_info "View logs with: pm2 logs kanban-app"

