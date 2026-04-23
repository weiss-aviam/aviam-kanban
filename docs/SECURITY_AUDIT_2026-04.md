# Security audit — April 2026

This document records the Supabase hosted-linter audit run on
2026-04-22/23, the corrective forward migrations applied, and the two
remaining items that must be completed in the Supabase dashboard.

## Findings and remediation

The Supabase hosted security advisor reported 20 findings across four
classes. All in-database findings were closed by additive forward
migrations (`src/db/migrations/41–44`).

| #   | Finding (lint code)                                          | Tables / objects                                                                                                                                                                                          | Fixed by                               |
| --- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| 1   | RLS disabled on tables in public schema                      | `cards`, `comments`, `labels`, `card_labels`, `column_templates`, `template_columns`, `_drizzle_migrations`                                                                                               | `41_restore_rls_on_dropped_tables.sql` |
| 2   | View has SECURITY DEFINER semantics                          | `invitation_status_view`                                                                                                                                                                                  | `41_restore_rls_on_dropped_tables.sql` |
| 3   | Function search_path mutable (lint 0011)                     | `handle_new_user`, `is_board_member` (text and uuid overloads), `record_user_login`, `create_board_changeset`, `expire_old_invitations`, `propagate_board_activity`, `update_user_invitations_updated_at` | `42_pin_function_search_path.sql`      |
| 4   | Public bucket allows listing (lint 0025)                     | `storage.objects` policies on `card-attachments` and `avatars`                                                                                                                                            | `43_drop_broad_storage_policies.sql`   |
| 5   | RLS-enabled table with zero policies (collateral from #1)    | `cards`, `comments`, `labels`, `card_labels`, `column_templates`, `template_columns`                                                                                                                      | `44_restore_lost_table_policies.sql`   |
| 6   | HIBP leaked-password protection disabled                     | Supabase Auth                                                                                                                                                                                             | **dashboard — pending**                |
| 7   | Postgres version `17.4.1.075` has security patches available | Postgres                                                                                                                                                                                                  | **dashboard — pending**                |

## Why the in-database findings happened

`06_convert_cards_to_uuid.sql` converts `cards`, `labels`, `card_labels`,
`comments` (and later `column_templates`) from serial → UUID using:

```sql
DROP TABLE IF EXISTS cards CASCADE;
ALTER TABLE cards_new RENAME TO cards;
```

`DROP TABLE … CASCADE` destroys both the RLS _configuration_ on the
table and every _policy_ attached to it. The `*_new` tables created by
`06` were neither `ENABLE ROW LEVEL SECURITY` nor re-policed, so all six
tables ended up with RLS off and no policies — a regression that stayed
silent because the application's primary read path (admin client +
service role) bypasses RLS.

The view finding is structurally similar: Postgres views default to
`security_invoker = false`, which means they execute with the **view
owner's** privileges instead of the caller's. From an RLS perspective
that is equivalent to SECURITY DEFINER. The standard fix is `ALTER VIEW
… SET (security_invoker = true)`.

The function search_path findings are independent: any
`SECURITY DEFINER` function with no pinned `search_path` inherits the
caller's session search_path and can be coerced into resolving
unqualified identifiers against an attacker-controlled schema. The fix
is to pin the search_path at function-definition time.

The storage finding closes a real privesc: three broad
`attachments_auth_*_v1` policies on `storage.objects` granted any
authenticated session SELECT/INSERT/DELETE on the entire
`card-attachments` bucket. Postgres ORs same-command policies, so the
narrow board-member-scoped policies that were also defined had no
effect — anyone authenticated could enumerate, upload, and delete any
card's attachments. Dropping the broad policies activates the scoped
ones.

## Migration details

### `41_restore_rls_on_dropped_tables.sql`

`ALTER TABLE … ENABLE ROW LEVEL SECURITY` plus
`ALTER TABLE … FORCE ROW LEVEL SECURITY` on all seven tables, and
`ALTER VIEW invitation_status_view SET (security_invoker = true)`.

`FORCE` makes the table owner subject to RLS too. The admin client uses
service_role, which carries `BYPASSRLS` and is therefore unaffected.

`_drizzle_migrations` gets RLS with **no policies** — default-deny is
the correct posture for an internal metadata table the application never
reads through PostgREST.

### `42_pin_function_search_path.sql`

`ALTER FUNCTION … SET search_path = public, pg_catalog` on every
flagged function. We chose `public, pg_catalog` over `''` because the
existing function bodies reference unqualified table names like
`board_members`, `boards`, `cards`. The empty-string variant from
Supabase's docs would require rewriting every reference as
`public.<table>`; pinning to `public, pg_catalog` satisfies the linter
without touching bodies.

### `43_drop_broad_storage_policies.sql`

Drops:

- `attachments_auth_select_v1 ew4foz_0`
- `attachments_auth_insert_v1 ew4foz_0`
- `attachments_auth_delete_v1 ew4foz_0`
- `Authenticated users can read avatars`

The board-member-scoped policies (`Board members can read/upload/delete
card attachments`) remain in place and become effective the moment the
broad ORs go away.

For `avatars`, the bucket is public so direct GETs serve files via URL
without any storage.objects policy check. The dropped policy only
mattered for `.list()` calls, which the application never makes against
avatars; removing it prevents enumeration of avatar filenames.

### `44_restore_lost_table_policies.sql`

Restores the 18 policies that `06`'s `DROP TABLE … CASCADE` destroyed:

- `cards`: 4 policies (SELECT viewer, INSERT member, UPDATE member,
  DELETE admin)
- `labels`: 2 (SELECT viewer, ALL member)
- `card_labels`: 2 (SELECT viewer, ALL member — both gated through the
  parent `cards` row)
- `comments`: 4 (SELECT viewer, INSERT member, UPDATE author,
  DELETE author or board admin)
- `column_templates`: 4 (SELECT own/public, INSERT own, UPDATE own,
  DELETE own)
- `template_columns`: 2 (SELECT through parent template, ALL through
  own template)

Idempotent: each policy is dropped first via `DROP POLICY IF EXISTS`
before being recreated.

## Why migration 44 was necessary on top of migration 41

Migration 41 was written under the assumption that the policies created
in `04_*` and `05_*` still existed in the database. They did not. The
`DROP TABLE … CASCADE` in `06_*` had also dropped them. Enabling RLS on
a table with no policies means default-deny — every read from a
user-scoped Supabase client returns zero rows. After 41 was applied,
production paths like `GET /api/cards/[id]`, comment lists, dashboard
stats, and the calendar were silently broken for non-service-role
callers.

The lesson: when re-enabling RLS on a table after a long history of
schema rewrites, query `pg_policy` first to confirm the policies you
expect actually exist.

## Remaining dashboard items

The two findings below cannot be closed with a SQL migration. They
require action in the Supabase dashboard.

### HIBP leaked password protection

- **Where:** Authentication → Sign In / Providers → Email →
  "Leaked password protection"
- **Why:** Blocks signup with any password that appears in the Have I
  Been Pwned breach corpus.
- **How:** flip the toggle to enabled. No application changes needed —
  Supabase Auth handles the check on signup and password change.

### Postgres version upgrade

- **Where:** Project Settings → Infrastructure → Database
- **Why:** the running Postgres image (`17.4.1.075`) has security
  patches available in newer point releases.
- **How:** schedule the upgrade in the dashboard. Plan for ~2 minutes
  of read-write downtime during the version swap.

## Verifying the in-database fixes

After applying all four migrations:

```sql
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class
WHERE relname IN (
  'cards', 'comments', 'labels', 'card_labels',
  'column_templates', 'template_columns', '_drizzle_migrations'
)
ORDER BY relname;
-- expect every row: t / t

SELECT polrelid::regclass AS table, count(*) AS policy_count
FROM pg_policy
WHERE polrelid::regclass::text IN (
  'cards','comments','labels','card_labels',
  'column_templates','template_columns'
)
GROUP BY 1
ORDER BY 1;
-- expect: cards 4, card_labels 2, column_templates 4, comments 4,
--         labels 2, template_columns 2  (total 18)

SELECT proname, prosrc IS NOT NULL,
       (SELECT proconfig FROM pg_proc WHERE oid = p.oid) AS settings
FROM pg_proc p
WHERE proname IN (
  'handle_new_user','is_board_member','record_user_login',
  'create_board_changeset','expire_old_invitations',
  'propagate_board_activity','update_user_invitations_updated_at'
);
-- expect every row's settings to contain 'search_path=public, pg_catalog'

SELECT polname FROM pg_policy
WHERE polrelid = 'storage.objects'::regclass
  AND polname IN (
    'attachments_auth_select_v1 ew4foz_0',
    'attachments_auth_insert_v1 ew4foz_0',
    'attachments_auth_delete_v1 ew4foz_0',
    'Authenticated users can read avatars'
  );
-- expect: zero rows
```

Then re-run the Supabase advisor and confirm only the two
dashboard-only findings remain.
