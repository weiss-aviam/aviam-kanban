# 🚀 Quick Deployment Reference

## One-Command Deploy

```bash
pnpm deploy:prod
```

This does everything:
- ✅ Installs dependencies
- ✅ Applies database migrations
- ✅ Builds the app
- ✅ Deploys with PM2

---

## Common Commands

### Deploy & Manage

```bash
# Full deployment (recommended)
pnpm deploy:prod

# Check deployment status
pnpm deploy:status

# Just reload PM2 (after manual build)
pnpm deploy:pm2

# View application status
pm2 status

# View logs
pm2 logs kanban-app

# Restart app
pm2 restart kanban-app
```

### Database Migrations

```bash
# Generate migration from schema changes
pnpm db:generate

# Apply migrations to Supabase
pnpm db:migrate:apply

# Check migration status
cat .migrations-applied.json
```

### Development

```bash
# Run dev server
pnpm dev

# Build only
pnpm build

# Type check
pnpm type-check

# Run tests
pnpm test
```

---

## Workflow: Making Schema Changes

1. **Edit schema** in `src/db/schema/`
2. **Generate migration**: `pnpm db:generate`
3. **Review SQL** in `src/db/migrations/`
4. **Deploy**: `pnpm deploy:prod`

---

## Troubleshooting

### Migration failed?
```bash
# Check the error in deployment output
# Fix manually in Supabase SQL Editor if needed
# Then mark as applied in .migrations-applied.json
```

### PM2 won't start?
```bash
pm2 logs kanban-app --lines 100
pm2 delete kanban-app
pnpm deploy:prod
```

### Build errors?
```bash
rm -rf .next node_modules
pnpm install
pnpm build
```

---

## Important Files

- `scripts/deploy.sh` - Main deployment script
- `scripts/apply-migrations.js` - Migration application logic
- `ecosystem.config.js` - PM2 configuration
- `.migrations-applied.json` - Tracks applied migrations (auto-generated)
- `DEPLOYMENT.md` - Full deployment documentation

