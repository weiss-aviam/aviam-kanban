# Deployment Guide

This guide explains how to deploy the Aviam Kanban application with automated database migrations.

## First-Time Setup

If you're setting up the deployment system on an existing database, initialize the migration tracker first:

```bash
cd kanban-app
bash scripts/init-migrations.sh
```

This marks all existing migrations as applied so they won't be re-run.

## Quick Deploy

To deploy the application with automatic database migrations:

```bash
cd kanban-app
pnpm deploy:prod
```

This single command will:
1. ✅ Install dependencies
2. ✅ Generate and apply database migrations
3. ✅ Build the Next.js application
4. ✅ Deploy/reload with PM2

## Manual Steps

### 1. Database Migrations Only

To apply database migrations without deploying:

```bash
# Generate migration SQL from Drizzle schema
pnpm db:generate

# Apply migrations to Supabase
pnpm db:migrate:apply
```

### 2. Deploy Application Only

To deploy without running migrations:

```bash
# Build the application
pnpm build

# Deploy with PM2
pnpm deploy:pm2
```

## How It Works

### Database Migrations

The deployment system uses a hybrid approach that works around Supabase's IPv6 connection issues:

1. **Drizzle generates SQL** from your TypeScript schema (`src/db/schema/`)
2. **Migration files** are created in `src/db/migrations/`
3. **Supabase Management API** applies the SQL via HTTPS (no direct database connection needed)
4. **Migration tracking** prevents re-applying the same migrations (`.migrations-applied.json`)

### PM2 Deployment

The application is deployed using PM2 with the configuration in `ecosystem.config.js`:

- **Port**: 8777
- **Mode**: Cluster mode (can scale to multiple instances)
- **Auto-restart**: Enabled
- **Logs**: Stored in `.pm2/out.log` and `.pm2/error.log`

## Environment Variables

Make sure your environment file contains the required variables:

**For production** - Create `.env` file:
```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://sytznaqoznsazavumnry.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Database (pooler connection - port 6543)
DATABASE_URL=postgresql://postgres.sytznaqoznsazavumnry:password@aws-1-eu-north-1.pooler.supabase.com:6543/postgres?sslmode=require

# Environment
NODE_ENV=production
APP_URL=https://your-domain.com
```

**For development** - Use `.env.local` file (same variables as above)

The deployment scripts automatically detect which file to use:
- `.env` is used if it exists (production)
- `.env.local` is used as fallback (development)

**Test your environment setup:**
```bash
bash scripts/test-env.sh
```

This will verify that all required environment variables are set and that drizzle-kit can access them.

## PM2 Commands

```bash
# View application status
pm2 status

# View logs
pm2 logs kanban-app

# Restart application
pm2 restart kanban-app

# Stop application
pm2 stop kanban-app

# Delete from PM2
pm2 delete kanban-app

# Save PM2 process list (survives reboots)
pm2 save

# Setup PM2 to start on system boot
pm2 startup
```

## Making Schema Changes

When you need to change the database schema:

1. **Edit the Drizzle schema** in `src/db/schema/`
2. **Generate migration**:
   ```bash
   pnpm db:generate
   ```
3. **Review the generated SQL** in `src/db/migrations/`
4. **Deploy** (migrations will be applied automatically):
   ```bash
   pnpm deploy:prod
   ```

## Troubleshooting

### Migration Fails

If a migration fails:

1. Check the error message in the deployment output
2. Review the migration SQL in `src/db/migrations/`
3. Manually fix the issue in Supabase SQL Editor if needed
4. Mark the migration as applied:
   ```bash
   # Edit .migrations-applied.json and add the filename
   ```

### PM2 Process Won't Start

```bash
# Check PM2 logs
pm2 logs kanban-app --lines 100

# Check if port 8777 is already in use
lsof -i :8777

# Delete and restart
pm2 delete kanban-app
pnpm deploy:prod
```

### Build Fails

```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules
pnpm install

# Try building again
pnpm build
```

## Rollback

If you need to rollback a deployment:

1. **Revert code changes** using git
2. **Rebuild and redeploy**:
   ```bash
   git checkout previous-commit
   pnpm deploy:prod
   ```
3. **Database rollback** must be done manually in Supabase SQL Editor

## Production Checklist

Before deploying to production:

- [ ] Environment variables are set correctly
- [ ] Database migrations have been tested
- [ ] Application builds without errors
- [ ] PM2 is configured correctly
- [ ] Logs directory exists (`.pm2/`)
- [ ] SSL/HTTPS is configured (if applicable)
- [ ] Backup database before major schema changes

## Monitoring

Monitor your application:

```bash
# Real-time logs
pm2 logs kanban-app --lines 100

# Monitor CPU/Memory
pm2 monit

# Web-based monitoring (optional)
pm2 plus
```

