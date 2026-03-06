# Aviam Kanban Setup Guide

This project now uses a **flat repo structure**. There is no nested `kanban-app/` directory.

## Prerequisites

- Node.js 18+
- `pnpm`
- a Supabase project

Install `pnpm` if needed:

```bash
npm install -g pnpm
```

## 1. Install dependencies

From the repository root:

```bash
pnpm install
```

## 2. Configure environment variables

Create `.env.local` in the **repository root**:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.your-project-id.supabase.co:5432/postgres
APP_URL=http://localhost:3000
```

`drizzle.config.ts` and the migration scripts read `DATABASE_URL` from the environment.

## 3. Database setup

The repo contains two relevant database sources:

- Drizzle schema: `src/db/schema/index.ts`
- SQL migrations: `src/db/migrations/*.sql`

Useful commands:

```bash
pnpm run db:push
pnpm run db:generate
pnpm run db:check
pnpm run db:migrate:apply
```

Notes:

- `pnpm run db:push` syncs the current Drizzle schema to the database.
- `pnpm run db:migrate:apply` runs the SQL files in `src/db/migrations/` using `scripts/apply-migrations.js`.
- The user-management/invitation additions for update-1 live in `src/db/migrations/add_user_management_tables.sql`.
- `schema.sql` also contains broader SQL/RLS reference material used by this project.

## 4. Supabase auth settings

In the Supabase dashboard:

1. set **Site URL** to `http://localhost:3000`
2. add redirect URLs such as:
   - `http://localhost:3000/auth/callback`
   - `http://localhost:3000/dashboard`

## 5. Optional seed/reset commands

```bash
pnpm run db:seed
pnpm run db:reset
```

Use these only when appropriate for your environment.

## 6. Start the app

```bash
pnpm run dev
```

Open `http://localhost:3000`.

## 7. Verification commands

Before committing or after significant changes, run:

```bash
pnpm run type-check
pnpm run lint
pnpm run build
```

For the focused update-1 regression suite, see `docs/TESTING.md`.

## Troubleshooting

### Database connection problems

- verify `DATABASE_URL`
- make sure `.env.local` is in the repo root
- restart commands after changing env vars

### Auth problems

- verify `NEXT_PUBLIC_SUPABASE_URL`
- verify `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- re-check Supabase Site URL and redirect URLs

### Migration problems

- check that `DATABASE_URL` is available to Drizzle/migration commands
- review `src/db/migrations/` for pending SQL files
- if using the SQL migration runner, check `.migrations-applied.json`

## Production deployment

### Vercel

- set the Vercel project root to the **repository root**
- add the same environment variables used locally
- update Supabase Site URL / redirects for the production domain

Example production env values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_URL=your-database-url
APP_URL=https://your-domain.vercel.app
```
