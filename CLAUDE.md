# Project Rules

## Database — HARD LIMITS (never override these)

Production and development share the **same single Supabase database**. Any command that touches the database is immediately live. The following commands must **never** be executed by Claude under any circumstances, without explicit written confirmation from the user in the same conversation turn:

| Forbidden command                                               | Why                                                                        |
| --------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `node scripts/apply-migrations.js` / `pnpm db:migrate:apply`    | Runs SQL migrations against the live database                              |
| `pnpm db:generate`                                              | Generates new migration files — must only happen when explicitly requested |
| `pnpm db:push`                                                  | Bypasses migrations and applies schema directly — destructive              |
| `pnpm db:reset`                                                 | Wipes and recreates the database                                           |
| `pnpm db:seed`                                                  | Inserts seed data into the live database                                   |
| Any raw SQL `DROP`, `DELETE`, `TRUNCATE`, `ALTER … DROP COLUMN` | Directly destructive                                                       |

If a task seems to require any of these, **stop and ask** rather than running them.

## Migrations

- Migrations are written as numbered SQL files in `src/db/migrations/` and applied **manually** by the developer, never automatically.
- Migrations must be additive only: new columns, new tables, new indexes, `SET DEFAULT`, `ADD CONSTRAINT`. No destructive changes to existing data.
- `scripts/check-migrations.js` lints migration files for destructive operations and is the only automated migration tooling that may run in CI or pre-commit.
- The escape hatch `-- safe: <reason>` on a flagged line requires explicit user approval before Claude adds it.

## Deployment

- Deployment (`pnpm deploy:prod` / `scripts/deploy.sh`) must **never** run migrations. The deploy script builds the app and reloads PM2 only.
- The database is always current because the developer applies migrations manually before deploying.

## CI / Build integrity

- Every commit to `main` must result in a passing production build (`pnpm build`). Never bypass the pre-commit hook with `--no-verify`.

## Testing with Vitest

- Vitest is the project's test runner. New logic must be covered by unit tests. Run `pnpm test` before committing. Tests must pass on `main` at all times.
