# Project Rules

## Migrations

- Migrations must never alter the database in a way that causes data loss. No `DROP COLUMN`, `DROP TABLE`, `TRUNCATE`, or destructive type changes on existing data. Use additive migrations only (new columns, new tables, `ALTER COLUMN ... SET DEFAULT`, etc.). If a column must be removed, deprecate it first in a separate migration and only drop it once confirmed safe.

## CI / Build integrity

- Every commit to `main` must result in a passing production build (`pnpm build`) and a working UI. Never merge if the build is broken. The pre-commit hook already validates this locally — do not bypass it with `--no-verify`.

## Testing with Vitest

- Vitest is the project's test runner. New logic, especially API helpers, store actions, and utility functions, must be covered by Vitest unit tests. Run tests with `pnpm test` before committing. Tests must pass on `main` at all times.
