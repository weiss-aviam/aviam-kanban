# Claude Code API Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a documented REST + Personal Access Token surface that lets Claude Code (and similar agents) propose-and-apply Kanban content (boards, groups, columns, cards, subtasks, attachments) for opted-in users only, with atomic batch creation and a transparent "via API" audit trail.

**Architecture:** Bearer-token middleware sits next to the existing cookie-session helper; on a hit it loads the token's user, enforces a master opt-in flag, mints a short-lived JWT for the same user, and lets every existing RLS policy (`auth.uid() = …`) keep working unchanged. A new `POST /api/changesets/board` endpoint validates a zod payload, then dispatches to a PL/pgSQL RPC that performs the entire board-create transactionally. Idempotency is keyed on a 24h table; rate-limiting is in-memory per PM2 process.

**Tech Stack:** Next.js 16 App Router, React 19, Supabase (Postgres + RLS), Drizzle ORM, zod, argon2 (`argon2` npm package, argon2id), SWR for client fetching (no `useEffect` for data), Vitest for tests, i18n via `t()` from `src/lib/i18n`.

**Spec:** `docs/superpowers/specs/2026-04-21-claude-code-api-design.md`

---

## File Structure

### New files

| Path                                                            | Purpose                                                                                            |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `scripts/check-column-duplicates.js`                            | Pre-migration script: scans `columns` for `(board_id, title)` duplicates; exits non-zero if found. |
| `scripts/__tests__/check-column-duplicates.test.js`             | Vitest for the script using a mocked Supabase client.                                              |
| `src/db/migrations/33_api_access_enabled.sql`                   | `users.api_access_enabled BOOLEAN NOT NULL DEFAULT false`.                                         |
| `src/db/migrations/34_api_tokens.sql`                           | `api_tokens` table + indexes + RLS.                                                                |
| `src/db/migrations/35_created_via.sql`                          | `created_via TEXT NOT NULL DEFAULT 'ui'` on `boards`, `cards`, `subtasks`, `attachments`.          |
| `src/db/migrations/36_columns_unique_title_per_board.sql`       | `UNIQUE (board_id, title)` constraint.                                                             |
| `src/db/migrations/37_api_idempotency_keys.sql`                 | `api_idempotency_keys` table for replay protection.                                                |
| `src/db/migrations/38_create_board_changeset_rpc.sql`           | PL/pgSQL function `create_board_changeset(payload jsonb) RETURNS jsonb`.                           |
| `src/lib/api-tokens/format.ts`                                  | `generateToken()`, `parsePrefix()` — base62 token format helpers.                                  |
| `src/lib/api-tokens/hash.ts`                                    | `hashToken(plain)`, `verifyToken(plain, hash)` — argon2id wrappers.                                |
| `src/lib/api-tokens/mint.ts`                                    | `mintToken({ userId, name })` — DB insert orchestration.                                           |
| `src/lib/api-tokens/verify.ts`                                  | `authenticateBearerToken(plain)` — lookup by prefix + verify hash + load user.                     |
| `src/lib/api-tokens/__tests__/format.test.ts`                   | Format helper tests.                                                                               |
| `src/lib/api-tokens/__tests__/hash.test.ts`                     | Hash round-trip + tamper test.                                                                     |
| `src/lib/api-tokens/__tests__/mint.test.ts`                     | Mint helper test (mocked supabase admin client).                                                   |
| `src/lib/api-tokens/__tests__/verify.test.ts`                   | Verify happy/revoked/master-off paths.                                                             |
| `src/lib/api/changeset-schema.ts`                               | `TitleSchema` + `ChangesetSchema` (exported).                                                      |
| `src/lib/api/__tests__/changeset-schema.test.ts`                | Validation tests (forbidden chars, NFC, columnRef bounds).                                         |
| `src/lib/api/idempotency.ts`                                    | `withIdempotency(req, tokenId, handler)` middleware.                                               |
| `src/lib/api/__tests__/idempotency.test.ts`                     | Replay returns same response, 24h expiry.                                                          |
| `src/lib/api/rate-limit.ts`                                     | In-memory token-bucket per token (60 req/min).                                                     |
| `src/lib/api/__tests__/rate-limit.test.ts`                      | Allows 60, blocks 61, resets after window.                                                         |
| `src/app/api/changesets/board/route.ts`                         | `POST` handler.                                                                                    |
| `src/__tests__/api/changesets-board.test.ts`                    | Unit + integration (RPC error path = no partial writes).                                           |
| `src/app/api/api-tokens/route.ts`                               | `GET` (list), `POST` (mint).                                                                       |
| `src/app/api/api-tokens/[id]/route.ts`                          | `DELETE` (soft revoke).                                                                            |
| `src/app/api/users/api-access/route.ts`                         | `PATCH` master toggle.                                                                             |
| `src/__tests__/api/api-tokens.test.ts`                          | List/create/revoke + master-off behaviour.                                                         |
| `src/app/(app)/profile/api-access/page.tsx`                     | Server component shell.                                                                            |
| `src/components/api-access/ApiAccessContent.tsx`                | Client component (SWR-based) — master toggle + token list + dialog.                                |
| `src/components/api-access/CreateTokenDialog.tsx`               | Dialog: name input → reveals plaintext once.                                                       |
| `src/components/api-access/__tests__/ApiAccessContent.test.tsx` | RTL test (toggle disables list, copy-once flow).                                                   |
| `src/components/ui/ViaApiBadge.tsx`                             | Tiny "via API" badge.                                                                              |
| `docs/api/README.md`                                            | Overview, base URL, versioning.                                                                    |
| `docs/api/authentication.md`                                    | Token lifecycle + curl example.                                                                    |
| `docs/api/changesets.md`                                        | `POST /api/changesets/board` with full examples.                                                   |
| `docs/api/boards.md`                                            | Boards CRUD reference.                                                                             |
| `docs/api/cards.md`                                             | Cards + subtasks.                                                                                  |
| `docs/api/attachments.md`                                       | Multipart example.                                                                                 |
| `docs/api/groups.md`                                            | Board-groups CRUD.                                                                                 |
| `docs/api/errors.md`                                            | Error schema + codes.                                                                              |
| `docs/api/CLAUDE.md`                                            | Drop-in snippet for users' Claude Code projects.                                                   |

### Modified files

| Path                                                                | Change                                                                                                                             |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `src/db/schema.ts` (Drizzle)                                        | Add `apiAccessEnabled`, `apiTokens`, `apiIdempotencyKeys`, `createdVia` on the relevant tables, and the unique index on `columns`. |
| `src/lib/supabase/server.ts`                                        | Add `getAuthorizedUser()` next to `getSessionUser()`.                                                                              |
| All `src/app/api/**/route.ts` that currently call `getSessionUser`  | Replace with `getAuthorizedUser`.                                                                                                  |
| `src/lib/locales/de.ts`                                             | Add `apiAccess.*` and `viaApiBadge` strings.                                                                                       |
| `src/components/boards/BoardCard.tsx`                               | Render `<ViaApiBadge>` when `board.createdVia === 'api'`.                                                                          |
| `src/components/kanban/KanbanCard.tsx` (or equivalent card display) | Same for cards.                                                                                                                    |
| `package.json`                                                      | Add `argon2` dependency.                                                                                                           |

### Build sequence note

Migrations 33–38 are written in this plan but applied **manually** by the developer (CLAUDE.md DB rules). Each migration task ends with the explicit instruction _"Ask the user to run the migration before continuing"_ — never run `pnpm db:migrate:apply` from the agent.

---

## Task 1: Pre-migration column-duplicate checker

**Files:**

- Create: `scripts/check-column-duplicates.js`
- Create: `scripts/__tests__/check-column-duplicates.test.js`

- [ ] **Step 1: Write the failing test**

```js
// scripts/__tests__/check-column-duplicates.test.js
import { describe, it, expect } from "vitest";
import { findDuplicates } from "../check-column-duplicates.js";

describe("findDuplicates", () => {
  it("returns empty array when all (board_id, title) pairs are unique", () => {
    const rows = [
      { board_id: "b1", title: "Backlog" },
      { board_id: "b1", title: "Doing" },
      { board_id: "b2", title: "Backlog" },
    ];
    expect(findDuplicates(rows)).toEqual([]);
  });

  it("groups duplicates by (board_id, NFC-normalized title)", () => {
    const rows = [
      { board_id: "b1", title: "Backlog" },
      { board_id: "b1", title: "backlog" }, // case-different — NOT a duplicate
      { board_id: "b1", title: "Backlog" }, // exact dup
      { board_id: "b2", title: "Café" }, // composed
      { board_id: "b2", title: "Cafe\u0301" }, // decomposed — same after NFC
    ];
    expect(findDuplicates(rows)).toEqual([
      { board_id: "b1", title: "Backlog", count: 2 },
      { board_id: "b2", title: "Café", count: 2 },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run scripts/__tests__/check-column-duplicates.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the script**

```js
// scripts/check-column-duplicates.js
#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";

export function findDuplicates(rows) {
  const counts = new Map();
  for (const r of rows) {
    const key = `${r.board_id}\u0000${r.title.normalize("NFC")}`;
    const e = counts.get(key) ?? { board_id: r.board_id, title: r.title.normalize("NFC"), count: 0 };
    e.count += 1;
    counts.set(key, e);
  }
  return [...counts.values()].filter((e) => e.count > 1);
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );
  const { data, error } = await supabase
    .from("columns")
    .select("board_id, title");
  if (error) {
    console.error("Query failed:", error.message);
    process.exit(2);
  }
  const dups = findDuplicates(data);
  if (dups.length === 0) {
    console.log("✅ No duplicate column titles per board — safe to add UNIQUE constraint.");
    process.exit(0);
  }
  console.error(`❌ Found ${dups.length} duplicate column-title group(s):`);
  for (const d of dups) {
    console.error(`  board ${d.board_id}: "${d.title}" appears ${d.count}×`);
  }
  console.error("\nRename or delete duplicates manually before applying migration 36.");
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run scripts/__tests__/check-column-duplicates.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/check-column-duplicates.js scripts/__tests__/check-column-duplicates.test.js
git commit -m "feat(api): add pre-migration column-duplicate checker"
```

---

## Task 2: Migration 33 — `users.api_access_enabled`

**Files:**

- Create: `src/db/migrations/33_api_access_enabled.sql`
- Modify: `src/db/schema.ts`

- [ ] **Step 1: Write the migration**

```sql
-- Migration 33: master opt-in flag for Claude API access.
-- Default false → no token can authenticate until the user explicitly toggles
-- this on in /profile/api-access. Toggling off makes existing tokens inert
-- without deleting them.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS api_access_enabled BOOLEAN NOT NULL DEFAULT false;
```

- [ ] **Step 2: Run the migration safety checker**

Run: `node scripts/check-migrations.js src/db/migrations/33_api_access_enabled.sql`
Expected: `✅ Migration safety check passed`.

- [ ] **Step 3: Update Drizzle schema**

In `src/db/schema.ts`, find the `users` table definition and add:

```ts
apiAccessEnabled: boolean("api_access_enabled").notNull().default(false),
```

(Place next to the existing user fields. Leave column order matching the SQL.)

- [ ] **Step 4: Verify build still types**

Run: `pnpm tsc --noEmit`
Expected: clean, no new errors.

- [ ] **Step 5: STOP — ask the user to apply the migration**

Per CLAUDE.md, never run `pnpm db:migrate:apply`. Print:

> "Migration 33 written. Please run `pnpm db:migrate:apply` (or `node scripts/apply-migrations.js`) and confirm success before I continue."

Wait for user confirmation.

- [ ] **Step 6: Commit**

```bash
git add src/db/migrations/33_api_access_enabled.sql src/db/schema.ts
git commit -m "feat(api): add users.api_access_enabled opt-in flag"
```

---

## Task 3: Migration 34 — `api_tokens` table

**Files:**

- Create: `src/db/migrations/34_api_tokens.sql`
- Modify: `src/db/schema.ts`

- [ ] **Step 1: Write the migration**

```sql
-- Migration 34: personal access tokens for Claude Code API.
-- One user → many tokens (multiple devices/projects).
-- token_hash is argon2id; the plaintext is shown to the user once at creation.
-- prefix is the first 8 chars of the full token (e.g. "avk_a1b2"); used for
-- O(1) lookup before the constant-time argon2 verify.
-- Soft revoke (revoked_at) — never DELETE rows, so audit history persists.

CREATE TABLE IF NOT EXISTS public.api_tokens (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       VARCHAR      NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name          TEXT         NOT NULL,
  token_hash    TEXT         NOT NULL,
  prefix        VARCHAR(8)   NOT NULL,
  last_used_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  revoked_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS api_tokens_prefix_idx
  ON public.api_tokens(prefix)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS api_tokens_user_active_idx
  ON public.api_tokens(user_id, revoked_at);

ALTER TABLE public.api_tokens ENABLE ROW LEVEL SECURITY;

-- Owner-only read; the verify path uses the service role to bypass RLS for the
-- prefix lookup (constant-time hash compare happens in Node).
CREATE POLICY "Users can read their own tokens"
  ON public.api_tokens FOR SELECT
  USING (user_id = auth.uid()::text);

-- Inserts go through the API (POST /api/api-tokens) which is server-only and
-- uses the service role client. We still allow the owner to insert for
-- defense-in-depth in case the route ever switches to user-context.
CREATE POLICY "Users can mint their own tokens"
  ON public.api_tokens FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

-- Updates are limited to setting revoked_at (soft revoke). Owner only.
CREATE POLICY "Users can revoke their own tokens"
  ON public.api_tokens FOR UPDATE
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);
```

- [ ] **Step 2: Run safety checker**

Run: `node scripts/check-migrations.js src/db/migrations/34_api_tokens.sql`
Expected: pass.

- [ ] **Step 3: Update Drizzle schema**

In `src/db/schema.ts`, after the `users` table, add:

```ts
export const apiTokens = pgTable(
  "api_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull(),
    prefix: varchar("prefix", { length: 8 }).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => ({
    prefixIdx: index("api_tokens_prefix_idx").on(t.prefix),
    userActiveIdx: index("api_tokens_user_active_idx").on(
      t.userId,
      t.revokedAt,
    ),
  }),
);

export type ApiToken = typeof apiTokens.$inferSelect;
export type NewApiToken = typeof apiTokens.$inferInsert;
```

(Add `varchar`, `text`, `index` to the imports at the top of the file if not already present.)

- [ ] **Step 4: Type-check**

Run: `pnpm tsc --noEmit`
Expected: clean.

- [ ] **Step 5: STOP — ask the user to apply the migration**

Wait for confirmation.

- [ ] **Step 6: Commit**

```bash
git add src/db/migrations/34_api_tokens.sql src/db/schema.ts
git commit -m "feat(api): add api_tokens table with RLS and indexes"
```

---

## Task 4: Migration 35 — `created_via` audit column

**Files:**

- Create: `src/db/migrations/35_created_via.sql`
- Modify: `src/db/schema.ts`

- [ ] **Step 1: Write the migration**

```sql
-- Migration 35: audit which surface created each piece of content.
-- Existing rows get the default 'ui'. New rows from the API set 'api'.
-- The Kanban UI shows a "via API" badge when this is 'api'.

ALTER TABLE public.boards
  ADD COLUMN IF NOT EXISTS created_via TEXT NOT NULL DEFAULT 'ui'
  CHECK (created_via IN ('ui', 'api'));

ALTER TABLE public.cards
  ADD COLUMN IF NOT EXISTS created_via TEXT NOT NULL DEFAULT 'ui'
  CHECK (created_via IN ('ui', 'api'));

ALTER TABLE public.subtasks
  ADD COLUMN IF NOT EXISTS created_via TEXT NOT NULL DEFAULT 'ui'
  CHECK (created_via IN ('ui', 'api'));

ALTER TABLE public.attachments
  ADD COLUMN IF NOT EXISTS created_via TEXT NOT NULL DEFAULT 'ui'
  CHECK (created_via IN ('ui', 'api'));
```

- [ ] **Step 2: Safety check**

Run: `node scripts/check-migrations.js src/db/migrations/35_created_via.sql`
Expected: pass.

- [ ] **Step 3: Update Drizzle schema**

In each of the four tables in `src/db/schema.ts`, add:

```ts
createdVia: text("created_via", { enum: ["ui", "api"] }).notNull().default("ui"),
```

- [ ] **Step 4: Type-check**

Run: `pnpm tsc --noEmit`
Expected: clean.

- [ ] **Step 5: STOP — ask the user to apply the migration**

- [ ] **Step 6: Commit**

```bash
git add src/db/migrations/35_created_via.sql src/db/schema.ts
git commit -m "feat(api): add created_via audit column to boards, cards, subtasks, attachments"
```

---

## Task 5: Run column-duplicate check, then migration 36 — UNIQUE constraint

**Files:**

- Create: `src/db/migrations/36_columns_unique_title_per_board.sql`
- Modify: `src/db/schema.ts`

- [ ] **Step 1: Run the duplicate check against production**

Run: `node scripts/check-column-duplicates.js`
Expected outcome: `✅ No duplicate column titles per board`.
**If duplicates are reported:** STOP, hand the list to the user, wait for them to rename/delete the duplicates manually before continuing.

- [ ] **Step 2: Write the migration**

```sql
-- Migration 36: enforce unique column title per board.
-- Required so the changesets API can resolve `columnRef` (title-based) to a
-- single column unambiguously. Run scripts/check-column-duplicates.js before
-- applying — the migration will fail otherwise.
ALTER TABLE public.columns
  ADD CONSTRAINT columns_board_title_unique UNIQUE (board_id, title);
```

- [ ] **Step 3: Safety check**

Run: `node scripts/check-migrations.js src/db/migrations/36_columns_unique_title_per_board.sql`
Expected: pass.

- [ ] **Step 4: Update Drizzle schema**

In `src/db/schema.ts`, in the `columns` table options object, add:

```ts
boardTitleUnique: unique("columns_board_title_unique").on(t.boardId, t.title),
```

(Add `unique` to drizzle-orm/pg-core imports.)

- [ ] **Step 5: Type-check**

Run: `pnpm tsc --noEmit`
Expected: clean.

- [ ] **Step 6: STOP — ask the user to apply the migration**

- [ ] **Step 7: Commit**

```bash
git add src/db/migrations/36_columns_unique_title_per_board.sql src/db/schema.ts
git commit -m "feat(api): enforce unique column title per board"
```

---

## Task 6: Migration 37 — `api_idempotency_keys` table

**Files:**

- Create: `src/db/migrations/37_api_idempotency_keys.sql`
- Modify: `src/db/schema.ts`

- [ ] **Step 1: Write the migration**

```sql
-- Migration 37: idempotency-key store for replay protection on the
-- changesets endpoint. Rows older than 24h are pruned by the server's
-- middleware on read; nothing automated runs in the DB itself.

CREATE TABLE IF NOT EXISTS public.api_idempotency_keys (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id    UUID         NOT NULL REFERENCES public.api_tokens(id) ON DELETE CASCADE,
  key         TEXT         NOT NULL,
  status      INTEGER      NOT NULL,
  response    JSONB        NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT  api_idempotency_keys_unique UNIQUE (token_id, key)
);

CREATE INDEX IF NOT EXISTS api_idempotency_keys_created_idx
  ON public.api_idempotency_keys(created_at);

ALTER TABLE public.api_idempotency_keys ENABLE ROW LEVEL SECURITY;

-- Server-side only — no user-facing select policy needed; service role bypasses.
```

- [ ] **Step 2: Safety check + Drizzle update**

Run: `node scripts/check-migrations.js src/db/migrations/37_api_idempotency_keys.sql` (expect pass).

In `src/db/schema.ts`:

```ts
export const apiIdempotencyKeys = pgTable(
  "api_idempotency_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenId: uuid("token_id")
      .notNull()
      .references(() => apiTokens.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    status: integer("status").notNull(),
    response: jsonb("response").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    unique: unique("api_idempotency_keys_unique").on(t.tokenId, t.key),
    createdIdx: index("api_idempotency_keys_created_idx").on(t.createdAt),
  }),
);
```

- [ ] **Step 3: Type-check + STOP for user to apply**

Run: `pnpm tsc --noEmit`. Then ask user to apply migration 37.

- [ ] **Step 4: Commit**

```bash
git add src/db/migrations/37_api_idempotency_keys.sql src/db/schema.ts
git commit -m "feat(api): add api_idempotency_keys table"
```

---

## Task 7: Install argon2 dependency

**Files:**

- Modify: `package.json`, `pnpm-lock.yaml`

- [ ] **Step 1: Install**

Run: `pnpm add argon2`
Expected: package added, no errors. (Note: `argon2` has a native binding — confirm it built on darwin.)

- [ ] **Step 2: Verify import works**

Create a throwaway script `/tmp/argon2-smoke.mjs`:

```js
import argon2 from "argon2";
const h = await argon2.hash("test", { type: argon2.argon2id });
console.log(await argon2.verify(h, "test"));
```

Run: `node /tmp/argon2-smoke.mjs`
Expected: prints `true`. Then delete the smoke file.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add argon2 for API token hashing"
```

---

## Task 8: Token format helpers

**Files:**

- Create: `src/lib/api-tokens/format.ts`
- Create: `src/lib/api-tokens/__tests__/format.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { generateToken, parsePrefix, BEARER_PREFIX } from "../format";

describe("generateToken", () => {
  it("produces a token of exactly 36 chars starting with avk_", () => {
    const t = generateToken();
    expect(t).toMatch(/^avk_[A-Za-z0-9]{32}$/);
    expect(t).toHaveLength(36);
  });

  it("returns unique tokens across many calls (smoke)", () => {
    const set = new Set(Array.from({ length: 1000 }, generateToken));
    expect(set.size).toBe(1000);
  });
});

describe("parsePrefix", () => {
  it("returns the first 8 chars of the full token", () => {
    expect(parsePrefix("avk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6")).toBe(
      "avk_a1b2",
    );
  });

  it("returns null for malformed input", () => {
    expect(parsePrefix("nope")).toBeNull();
    expect(parsePrefix("avk_short")).toBeNull();
  });
});

describe("BEARER_PREFIX", () => {
  it("equals 'avk_'", () => {
    expect(BEARER_PREFIX).toBe("avk_");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/api-tokens/__tests__/format.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/api-tokens/format.ts
import { randomBytes } from "node:crypto";

export const BEARER_PREFIX = "avk_";
const BODY_LENGTH = 32;
const ALPHABET =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function generateToken(): string {
  // Pull more bytes than we need so rejection sampling stays uniform.
  const bytes = randomBytes(BODY_LENGTH * 2);
  let out = "";
  let i = 0;
  while (out.length < BODY_LENGTH && i < bytes.length) {
    const b = bytes[i++];
    if (b < 248) out += ALPHABET[b % 62]; // 248 = 4 * 62; rest is uniform
  }
  if (out.length < BODY_LENGTH) {
    // Astronomically unlikely; recurse to be safe.
    return generateToken();
  }
  return BEARER_PREFIX + out;
}

export function parsePrefix(token: string): string | null {
  if (!token.startsWith(BEARER_PREFIX)) return null;
  if (token.length < 12) return null; // avk_ + at least 8 body chars
  return token.slice(0, 8);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/api-tokens/__tests__/format.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/api-tokens/format.ts src/lib/api-tokens/__tests__/format.test.ts
git commit -m "feat(api): add API token format helpers (avk_ + 32-char base62)"
```

---

## Task 9: Token hashing wrapper

**Files:**

- Create: `src/lib/api-tokens/hash.ts`
- Create: `src/lib/api-tokens/__tests__/hash.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { hashToken, verifyToken } from "../hash";

describe(
  "hashToken / verifyToken",
  () => {
    it("verifies a freshly hashed token", async () => {
      const hash = await hashToken("avk_secret123");
      expect(hash).toMatch(/^\$argon2id\$/);
      expect(await verifyToken("avk_secret123", hash)).toBe(true);
    });

    it("rejects a tampered token", async () => {
      const hash = await hashToken("avk_secret123");
      expect(await verifyToken("avk_secret124", hash)).toBe(false);
    });

    it("rejects empty input", async () => {
      const hash = await hashToken("avk_secret123");
      expect(await verifyToken("", hash)).toBe(false);
    });
  },
  { timeout: 10_000 },
); // argon2 is slow on first run
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/api-tokens/__tests__/hash.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/api-tokens/hash.ts
import argon2 from "argon2";

const OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 2 ** 16, // 64 MiB
  timeCost: 3,
  parallelism: 1,
};

export async function hashToken(plain: string): Promise<string> {
  return await argon2.hash(plain, OPTIONS);
}

export async function verifyToken(
  plain: string,
  hash: string,
): Promise<boolean> {
  if (!plain) return false;
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/api-tokens/__tests__/hash.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/api-tokens/hash.ts src/lib/api-tokens/__tests__/hash.test.ts
git commit -m "feat(api): add argon2id hash/verify wrappers for tokens"
```

---

## Task 10: Token mint helper

**Files:**

- Create: `src/lib/api-tokens/mint.ts`
- Create: `src/lib/api-tokens/__tests__/mint.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import { mintToken } from "../mint";

vi.mock("../hash", () => ({
  hashToken: vi.fn(async (p: string) => `hashed:${p}`),
}));

describe("mintToken", () => {
  it("inserts a hashed token, returns plaintext + row metadata", async () => {
    const insertSpy = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: {
            id: "11111111-1111-4111-8111-111111111111",
            user_id: "user-1",
            name: "Laptop",
            prefix: "avk_a1b2",
            created_at: "2026-04-21T00:00:00Z",
          },
          error: null,
        }),
      })),
    }));
    const supabase = { from: vi.fn(() => ({ insert: insertSpy })) };

    const result = await mintToken({
      userId: "user-1",
      name: "Laptop",
      supabase: supabase as never,
    });

    expect(result.token).toMatch(/^avk_[A-Za-z0-9]{32}$/);
    expect(result.row.prefix).toBe(result.token.slice(0, 8));
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        name: "Laptop",
        prefix: result.token.slice(0, 8),
        token_hash: `hashed:${result.token}`,
      }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/api-tokens/__tests__/mint.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// src/lib/api-tokens/mint.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateToken } from "./format";
import { hashToken } from "./hash";

export interface MintResult {
  token: string; // plaintext, shown once
  row: {
    id: string;
    name: string;
    prefix: string;
    createdAt: string;
  };
}

export async function mintToken(args: {
  userId: string;
  name: string;
  supabase: SupabaseClient;
}): Promise<MintResult> {
  const token = generateToken();
  const prefix = token.slice(0, 8);
  const tokenHash = await hashToken(token);

  const { data, error } = await args.supabase
    .from("api_tokens")
    .insert({
      user_id: args.userId,
      name: args.name,
      token_hash: tokenHash,
      prefix,
    })
    .select("id, name, prefix, created_at")
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to mint token: ${error?.message ?? "no row returned"}`,
    );
  }

  return {
    token,
    row: {
      id: data.id,
      name: data.name,
      prefix: data.prefix,
      createdAt: data.created_at,
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/api-tokens/__tests__/mint.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api-tokens/mint.ts src/lib/api-tokens/__tests__/mint.test.ts
git commit -m "feat(api): add token mint helper"
```

---

## Task 11: Token verify / authentication helper

**Files:**

- Create: `src/lib/api-tokens/verify.ts`
- Create: `src/lib/api-tokens/__tests__/verify.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { authenticateBearerToken } from "../verify";

vi.mock("../hash", () => ({
  verifyToken: vi.fn(
    async (plain: string, hash: string) => hash === `hashed:${plain}`,
  ),
}));

const FULL_TOKEN = "avk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6";
const PREFIX = "avk_a1b2";

const adminClient = (rows: unknown[]) => ({
  from: vi.fn((table: string) => {
    if (table === "api_tokens") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            is: vi.fn().mockResolvedValue({ data: rows, error: null }),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      };
    }
    if (table === "users") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: rows[0]
                ? {
                    id: (rows[0] as { user_id: string }).user_id,
                    api_access_enabled: true,
                  }
                : null,
              error: null,
            }),
          })),
        })),
      };
    }
    throw new Error(`unexpected ${table}`);
  }),
});

describe("authenticateBearerToken", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns user when prefix + hash + master flag all match", async () => {
    const result = await authenticateBearerToken(FULL_TOKEN, {
      adminClient: adminClient([
        { id: "tok-1", user_id: "user-1", token_hash: `hashed:${FULL_TOKEN}` },
      ]) as never,
    });
    expect(result).toEqual({ tokenId: "tok-1", userId: "user-1" });
  });

  it("returns null when no row matches the prefix", async () => {
    const result = await authenticateBearerToken(FULL_TOKEN, {
      adminClient: adminClient([]) as never,
    });
    expect(result).toBeNull();
  });

  it("returns null when hash does not verify", async () => {
    const result = await authenticateBearerToken(FULL_TOKEN, {
      adminClient: adminClient([
        { id: "tok-1", user_id: "user-1", token_hash: "hashed:different" },
      ]) as never,
    });
    expect(result).toBeNull();
  });

  it("returns null when the master flag is off", async () => {
    const ac = adminClient([
      { id: "tok-1", user_id: "user-1", token_hash: `hashed:${FULL_TOKEN}` },
    ]);
    // Override users lookup
    ac.from = vi.fn((table: string) => {
      if (table === "api_tokens") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              is: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: "tok-1",
                    user_id: "user-1",
                    token_hash: `hashed:${FULL_TOKEN}`,
                  },
                ],
                error: null,
              }),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          })),
        };
      }
      if (table === "users") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: { id: "user-1", api_access_enabled: false },
                error: null,
              }),
            })),
          })),
        };
      }
      throw new Error(`unexpected ${table}`);
    });

    const result = await authenticateBearerToken(FULL_TOKEN, {
      adminClient: ac as never,
    });
    expect(result).toBeNull();
  });

  it("returns null for malformed token (no avk_ prefix)", async () => {
    const result = await authenticateBearerToken("nope", {
      adminClient: adminClient([]) as never,
    });
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/api-tokens/__tests__/verify.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// src/lib/api-tokens/verify.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { parsePrefix } from "./format";
import { verifyToken } from "./hash";

export interface AuthenticatedToken {
  tokenId: string;
  userId: string;
}

interface Args {
  adminClient: SupabaseClient;
}

export async function authenticateBearerToken(
  plain: string,
  args: Args,
): Promise<AuthenticatedToken | null> {
  const prefix = parsePrefix(plain);
  if (!prefix) return null;

  const { data: candidates } = await args.adminClient
    .from("api_tokens")
    .select("id, user_id, token_hash")
    .eq("prefix", prefix)
    .is("revoked_at", null);

  if (!candidates || candidates.length === 0) return null;

  let matched: { id: string; user_id: string } | null = null;
  for (const c of candidates) {
    if (await verifyToken(plain, c.token_hash)) {
      matched = { id: c.id, user_id: c.user_id };
      break;
    }
  }
  if (!matched) return null;

  const { data: user } = await args.adminClient
    .from("users")
    .select("id, api_access_enabled")
    .eq("id", matched.user_id)
    .single();

  if (!user || !user.api_access_enabled) return null;

  // Fire-and-forget last_used_at update; ignore errors.
  void args.adminClient
    .from("api_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", matched.id);

  return { tokenId: matched.id, userId: matched.user_id };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/api-tokens/__tests__/verify.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/api-tokens/verify.ts src/lib/api-tokens/__tests__/verify.test.ts
git commit -m "feat(api): add bearer-token authentication helper"
```

---

## Task 12: `getAuthorizedUser` middleware

**Files:**

- Modify: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/__tests__/getAuthorizedUser.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({
  headers: vi.fn(),
  cookies: vi.fn(async () => ({
    getAll: () => [],
    set: () => {},
  })),
}));
vi.mock("@/lib/api-tokens/verify", () => ({
  authenticateBearerToken: vi.fn(),
}));

import { headers } from "next/headers";
import { authenticateBearerToken } from "@/lib/api-tokens/verify";
import { getAuthorizedUser } from "../server";

const mockHeaders = vi.mocked(headers);
const mockAuth = vi.mocked(authenticateBearerToken);

describe("getAuthorizedUser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("falls back to session when no Authorization header", async () => {
    mockHeaders.mockReturnValue({ get: () => null } as never);
    const result = await getAuthorizedUser();
    expect(mockAuth).not.toHaveBeenCalled();
    // Falls through to getSessionUser; the actual user depends on env, so just
    // assert we didn't take the bearer branch.
    expect(result).toHaveProperty("user");
  });

  it("uses bearer token when Authorization: Bearer avk_… is present", async () => {
    mockHeaders.mockReturnValue({
      get: (k: string) =>
        k.toLowerCase() === "authorization" ? "Bearer avk_xxx" : null,
    } as never);
    mockAuth.mockResolvedValue({ tokenId: "t1", userId: "u1" });

    const result = await getAuthorizedUser();
    expect(mockAuth).toHaveBeenCalledWith("avk_xxx", expect.any(Object));
    expect(result.user).toEqual(expect.objectContaining({ id: "u1" }));
  });

  it("returns { user: null } when bearer auth fails", async () => {
    mockHeaders.mockReturnValue({
      get: (k: string) =>
        k.toLowerCase() === "authorization" ? "Bearer avk_bad" : null,
    } as never);
    mockAuth.mockResolvedValue(null);

    const result = await getAuthorizedUser();
    expect(result.user).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/supabase/__tests__/getAuthorizedUser.test.ts`
Expected: FAIL — `getAuthorizedUser` not exported.

- [ ] **Step 3: Install `jsonwebtoken`**

The bearer path mints a short-lived Supabase JWT for the token's user so RLS policies keep working unchanged. `jsonwebtoken` signs with the project's `SUPABASE_JWT_SECRET`.

Run:

```bash
pnpm add jsonwebtoken
pnpm add -D @types/jsonwebtoken
```

- [ ] **Step 4: Implement**

Append to `src/lib/supabase/server.ts`:

```ts
import { headers } from "next/headers";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import { authenticateBearerToken } from "@/lib/api-tokens/verify";

function adminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

function signSupabaseJwt(userId: string): string {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      sub: userId,
      role: "authenticated",
      aud: "authenticated",
      iat: now,
      exp: now + 60, // 60s — request lifetime, no caching
    },
    process.env.SUPABASE_JWT_SECRET!,
  );
}

/**
 * Resolves the caller from either an `Authorization: Bearer avk_…` header
 * (Claude Code API tokens) or the existing cookie session. When a bearer
 * token authenticates, returns a Supabase client whose requests carry a
 * short-lived JWT for the token's user so existing RLS policies
 * (`auth.uid() = …`) keep working unchanged.
 */
export async function getAuthorizedUser() {
  const h = await headers();
  const authHeader = h.get("authorization") ?? h.get("Authorization");

  if (authHeader?.toLowerCase().startsWith("bearer avk_")) {
    const plain = authHeader.slice(7); // strip "Bearer "
    const result = await authenticateBearerToken(plain, {
      adminClient: adminClient(),
    });
    if (!result) {
      return { supabase: await createClient(), user: null };
    }
    const accessToken = signSupabaseJwt(result.userId);
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
      },
    );
    return {
      supabase,
      user: { id: result.userId, tokenId: result.tokenId } as never,
    };
  }

  return await getSessionUser();
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run src/lib/supabase/__tests__/getAuthorizedUser.test.ts`
Expected: PASS (3 tests). The test mocks `authenticateBearerToken` so the JWT details don't matter for the unit test.

- [ ] **Step 6: Commit**

```bash
git add src/lib/supabase/server.ts src/lib/supabase/__tests__/getAuthorizedUser.test.ts package.json pnpm-lock.yaml
git commit -m "feat(api): add getAuthorizedUser middleware (bearer + session fallback)"
```

---

## Task 13: Wire `getAuthorizedUser` into all `/api/*` routes

**Files:**

- Modify: every file under `src/app/api/**/route.ts` that currently imports `getSessionUser`.

This task is mechanical but must be careful: routes that intentionally use the session-only path (e.g. password reset triggered from cookies) stay on `getSessionUser`. The rule: **swap to `getAuthorizedUser` only on routes that operate on user-owned content** (boards, cards, columns, subtasks, attachments, comments, labels, board-groups, calendar, dashboard).

- [ ] **Step 1: Inventory the call sites**

Run: `grep -rln "getSessionUser" src/app/api/`
Record the list. Skip:

- `src/app/api/auth/**` — auth flow itself, never bearer.
- `src/app/api/admin/**` — admin tools, cookie-only by policy.
- `src/app/api/profile/**` — settings, cookie-only.

Apply to everything else.

- [ ] **Step 2: Replace import + call site in each route file**

For each affected file, swap:

```diff
-import { getSessionUser } from "@/lib/supabase/server";
+import { getAuthorizedUser } from "@/lib/supabase/server";
…
-  const { supabase, user } = await getSessionUser();
+  const { supabase, user } = await getAuthorizedUser();
```

- [ ] **Step 3: Run the existing API test suite**

Run: `pnpm vitest run src/__tests__/api/`
Expected: all existing tests still pass — the helpers' return shape is identical.

If any test fails because it mocks `getSessionUser` directly, update the mock to `getAuthorizedUser` (the test pattern at `src/__tests__/api/board-groups.test.ts` shows the form).

- [ ] **Step 4: Add one Bearer-auth integration test**

Create `src/__tests__/api/bearer-auth.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as listBoards } from "@/app/api/boards/route";
import { getAuthorizedUser } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  getAuthorizedUser: vi.fn(),
  getSessionUser: vi.fn(),
}));

const mockAuth = vi.mocked(getAuthorizedUser);

describe("Bearer auth on /api/boards", () => {
  it("uses bearer-token user identity when Authorization header is present", async () => {
    mockAuth.mockResolvedValue({
      supabase: {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          })),
        })),
      } as never,
      user: { id: "user-from-token" } as never,
    });

    const req = new NextRequest("http://localhost/api/boards", {
      headers: { authorization: "Bearer avk_xxx" },
    });
    const res = await listBoards(req as never);
    expect(res.status).toBe(200);
    expect(mockAuth).toHaveBeenCalled();
  });
});
```

Run: `pnpm vitest run src/__tests__/api/bearer-auth.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api src/__tests__/api/bearer-auth.test.ts
git commit -m "refactor(api): switch user-content routes to getAuthorizedUser"
```

---

## Task 14: TitleSchema + ChangesetSchema (zod)

**Files:**

- Create: `src/lib/api/changeset-schema.ts`
- Create: `src/lib/api/__tests__/changeset-schema.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { ChangesetSchema, TitleSchema } from "../changeset-schema";

describe("TitleSchema", () => {
  it("accepts a normal title", () => {
    expect(TitleSchema.parse("My Board")).toBe("My Board");
  });

  it("trims whitespace", () => {
    expect(TitleSchema.parse("  Hi  ")).toBe("Hi");
  });

  it("normalizes to NFC", () => {
    // Decomposed Café → composed Café
    const decomposed = "Cafe\u0301";
    const composed = "Café";
    expect(TitleSchema.parse(decomposed)).toBe(composed);
  });

  it("rejects empty", () => {
    expect(() => TitleSchema.parse("   ")).toThrow();
  });

  it("rejects forbidden control / emoji-only", () => {
    expect(() => TitleSchema.parse("\u0007bell")).toThrow();
    expect(() => TitleSchema.parse("\uD83D\uDE00")).toThrow(); // 😀 — symbol class, not L/N/P/Zs
  });

  it("rejects > 80 chars", () => {
    expect(() => TitleSchema.parse("x".repeat(81))).toThrow();
  });
});

describe("ChangesetSchema", () => {
  const valid = {
    board: { name: "Q3 Roadmap" },
    columns: [
      { title: "Backlog", position: 1 },
      { title: "Doing", position: 2 },
      { title: "Done", position: 3 },
    ],
    cards: [{ columnRef: "Backlog", title: "Pick metrics", priority: "high" }],
  };

  it("parses a valid payload", () => {
    expect(() => ChangesetSchema.parse(valid)).not.toThrow();
  });

  it("rejects when columnRef does not match any column title", () => {
    const bad = { ...valid, cards: [{ columnRef: "Nope", title: "x" }] };
    expect(() => ChangesetSchema.parse(bad)).toThrow(/columnRef/);
  });

  it("rejects empty columns array", () => {
    expect(() => ChangesetSchema.parse({ ...valid, columns: [] })).toThrow();
  });

  it("rejects > 200 cards", () => {
    expect(() =>
      ChangesetSchema.parse({
        ...valid,
        cards: Array.from({ length: 201 }, (_, i) => ({
          columnRef: "Backlog",
          title: `c${i}`,
        })),
      }),
    ).toThrow();
  });

  it("defaults priority to medium", () => {
    const r = ChangesetSchema.parse({
      ...valid,
      cards: [{ columnRef: "Backlog", title: "x" }],
    });
    expect(r.cards?.[0]?.priority).toBe("medium");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/api/__tests__/changeset-schema.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// src/lib/api/changeset-schema.ts
import { z } from "zod";

export const TitleSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[\p{L}\p{N}\p{P}\p{Zs}]+$/u, "title contains forbidden characters")
  .transform((s) => s.normalize("NFC"));

const PrioritySchema = z.enum(["high", "medium", "low"]).default("medium");

export const ChangesetSchema = z
  .object({
    board: z.object({
      name: TitleSchema,
      description: z.string().max(2000).optional(),
      groupId: z.string().uuid().optional(),
    }),
    columns: z
      .array(
        z.object({
          title: TitleSchema,
          position: z.number().int().positive(),
        }),
      )
      .min(1)
      .max(20),
    cards: z
      .array(
        z.object({
          columnRef: TitleSchema,
          title: TitleSchema,
          description: z.string().max(8000).optional(),
          priority: PrioritySchema,
          dueDate: z.string().datetime().optional(),
          subtasks: z
            .array(z.object({ title: TitleSchema }))
            .max(50)
            .optional(),
        }),
      )
      .max(200)
      .optional(),
  })
  .superRefine((data, ctx) => {
    const titles = new Set(data.columns.map((c) => c.title));
    // Within-request uniqueness
    if (titles.size !== data.columns.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["columns"],
        message: "duplicate column titles in request",
      });
    }
    // columnRef resolution
    if (data.cards) {
      data.cards.forEach((card, i) => {
        if (!titles.has(card.columnRef)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["cards", i, "columnRef"],
            message: `columnRef "${card.columnRef}" does not match any column title`,
          });
        }
      });
    }
  });

export type Changeset = z.infer<typeof ChangesetSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/api/__tests__/changeset-schema.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/api/changeset-schema.ts src/lib/api/__tests__/changeset-schema.test.ts
git commit -m "feat(api): add ChangesetSchema with NFC titles and columnRef validation"
```

---

## Task 15: Migration 38 — `create_board_changeset` PL/pgSQL RPC

**Files:**

- Create: `src/db/migrations/38_create_board_changeset_rpc.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Migration 38: atomic board-changeset creation.
-- Wraps board + columns + cards + subtasks insert in a single transaction
-- so a partial failure leaves no orphans. Caller passes a JSONB payload
-- already validated by ChangesetSchema on the Node side. Inserts run with
-- the caller's JWT (SECURITY INVOKER) so all existing RLS policies apply.

CREATE OR REPLACE FUNCTION public.create_board_changeset(payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_user_id    TEXT := auth.uid()::text;
  v_board      JSONB;
  v_board_id   UUID;
  v_group_id   UUID;
  v_columns    JSONB := payload->'columns';
  v_cards      JSONB := COALESCE(payload->'cards', '[]'::jsonb);
  v_col        JSONB;
  v_card       JSONB;
  v_sub        JSONB;
  v_col_id     INTEGER;
  v_card_id    UUID;
  v_col_ids    JSONB := '{}'::jsonb;  -- title → column id map
  v_inserted_columns JSONB := '[]'::jsonb;
  v_inserted_cards   JSONB := '[]'::jsonb;
  v_subtasks   JSONB;
  v_inserted_subs JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth.uid() is null — caller must be authenticated';
  END IF;

  v_board := payload->'board';
  IF v_board->>'groupId' IS NOT NULL THEN
    v_group_id := (v_board->>'groupId')::uuid;
  END IF;

  -- 1. Insert the board (RLS: any authenticated user; owner_id = caller)
  INSERT INTO public.boards (name, description, owner_id, group_id, created_via)
  VALUES (
    v_board->>'name',
    v_board->>'description',
    v_user_id,
    v_group_id,
    'api'
  )
  RETURNING id INTO v_board_id;

  -- Add the caller as owner board_member (mirrors UI flow)
  INSERT INTO public.board_members (board_id, user_id, role)
  VALUES (v_board_id, v_user_id, 'owner');

  -- 2. Insert columns; build title → id map
  FOR v_col IN SELECT * FROM jsonb_array_elements(v_columns) LOOP
    INSERT INTO public.columns (board_id, title, position)
    VALUES (v_board_id, v_col->>'title', (v_col->>'position')::int)
    RETURNING id INTO v_col_id;
    v_col_ids := v_col_ids || jsonb_build_object(v_col->>'title', v_col_id);
    v_inserted_columns := v_inserted_columns || jsonb_build_object(
      'id', v_col_id,
      'title', v_col->>'title',
      'position', (v_col->>'position')::int
    );
  END LOOP;

  -- 3. Insert cards + subtasks
  FOR v_card IN SELECT * FROM jsonb_array_elements(v_cards) LOOP
    v_col_id := (v_col_ids->>(v_card->>'columnRef'))::int;
    IF v_col_id IS NULL THEN
      RAISE EXCEPTION 'columnRef "%" did not resolve', v_card->>'columnRef';
    END IF;

    INSERT INTO public.cards (
      column_id, title, description, priority, due_date, created_by, created_via
    )
    VALUES (
      v_col_id,
      v_card->>'title',
      v_card->>'description',
      COALESCE(v_card->>'priority', 'medium'),
      NULLIF(v_card->>'dueDate', '')::timestamptz,
      v_user_id,
      'api'
    )
    RETURNING id INTO v_card_id;

    v_subtasks := COALESCE(v_card->'subtasks', '[]'::jsonb);
    v_inserted_subs := '[]'::jsonb;
    FOR v_sub IN SELECT * FROM jsonb_array_elements(v_subtasks) LOOP
      DECLARE v_sub_id INTEGER;
      BEGIN
        INSERT INTO public.subtasks (card_id, title, created_via)
        VALUES (v_card_id, v_sub->>'title', 'api')
        RETURNING id INTO v_sub_id;
        v_inserted_subs := v_inserted_subs || jsonb_build_object(
          'id', v_sub_id, 'title', v_sub->>'title'
        );
      END;
    END LOOP;

    v_inserted_cards := v_inserted_cards || jsonb_build_object(
      'id', v_card_id,
      'title', v_card->>'title',
      'columnId', v_col_id,
      'subtasks', v_inserted_subs
    );
  END LOOP;

  RETURN jsonb_build_object(
    'board', jsonb_build_object(
      'id', v_board_id,
      'name', v_board->>'name',
      'groupId', v_group_id
    ),
    'columns', v_inserted_columns,
    'cards', v_inserted_cards
  );
END;
$$;

-- Grant execute to the authenticated role (RLS handles per-row authorization)
GRANT EXECUTE ON FUNCTION public.create_board_changeset(JSONB) TO authenticated;
```

- [ ] **Step 2: Safety check**

Run: `node scripts/check-migrations.js src/db/migrations/38_create_board_changeset_rpc.sql`
Expected: pass — no DROP/DELETE/TRUNCATE.

- [ ] **Step 3: STOP — ask the user to apply the migration**

- [ ] **Step 4: Commit**

```bash
git add src/db/migrations/38_create_board_changeset_rpc.sql
git commit -m "feat(api): add create_board_changeset PL/pgSQL RPC"
```

---

## Task 16: `POST /api/changesets/board` route

**Files:**

- Create: `src/app/api/changesets/board/route.ts`
- Create: `src/__tests__/api/changesets-board.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/changesets/board/route";
import { getAuthorizedUser } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  getAuthorizedUser: vi.fn(),
}));

const mockAuth = vi.mocked(getAuthorizedUser);

const validPayload = {
  board: { name: "Q3" },
  columns: [
    { title: "Backlog", position: 1 },
    { title: "Done", position: 2 },
  ],
  cards: [{ columnRef: "Backlog", title: "Plan" }],
};

const buildReq = (body: unknown, headers: Record<string, string> = {}) =>
  new NextRequest("http://localhost/api/changesets/board", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json", ...headers },
  });

describe("POST /api/changesets/board", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ supabase: {} as never, user: null as never });
    const res = await POST(buildReq(validPayload));
    expect(res.status).toBe(401);
  });

  it("returns 400 on invalid payload", async () => {
    mockAuth.mockResolvedValue({
      supabase: { rpc: vi.fn() } as never,
      user: { id: "u1" } as never,
    });
    const res = await POST(buildReq({ board: { name: "" }, columns: [] }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
    expect(body.at).toBeDefined();
  });

  it("calls RPC and returns 201 on success", async () => {
    const rpcResult = {
      board: { id: "b1", name: "Q3", groupId: null },
      columns: [
        { id: 1, title: "Backlog", position: 1 },
        { id: 2, title: "Done", position: 2 },
      ],
      cards: [{ id: "c1", title: "Plan", columnId: 1, subtasks: [] }],
    };
    const rpcSpy = vi.fn().mockResolvedValue({ data: rpcResult, error: null });
    mockAuth.mockResolvedValue({
      supabase: { rpc: rpcSpy } as never,
      user: { id: "u1" } as never,
    });

    const res = await POST(buildReq(validPayload));
    expect(res.status).toBe(201);
    expect(rpcSpy).toHaveBeenCalledWith(
      "create_board_changeset",
      expect.objectContaining({ payload: expect.any(Object) }),
    );
    expect(await res.json()).toEqual(rpcResult);
  });

  it("returns 500 with error envelope when RPC errors", async () => {
    const rpcSpy = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "boom" } });
    mockAuth.mockResolvedValue({
      supabase: { rpc: rpcSpy } as never,
      user: { id: "u1" } as never,
    });
    const res = await POST(buildReq(validPayload));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/boom/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/__tests__/api/changesets-board.test.ts`
Expected: FAIL — route not implemented.

- [ ] **Step 3: Implement**

```ts
// src/app/api/changesets/board/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { getAuthorizedUser } from "@/lib/supabase/server";
import { ChangesetSchema } from "@/lib/api/changeset-schema";

export async function POST(req: NextRequest) {
  const { supabase, user } = await getAuthorizedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let parsed;
  try {
    const body = await req.json();
    parsed = ChangesetSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      const first = e.issues[0];
      return NextResponse.json(
        {
          error: first.message,
          at: first.path.join("."),
          details: e.issues,
        },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("create_board_changeset", {
    payload: parsed,
  });

  if (error) {
    return NextResponse.json(
      { error: error.message, details: error },
      { status: 500 },
    );
  }

  return NextResponse.json(data, { status: 201 });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/__tests__/api/changesets-board.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/changesets/board/route.ts src/__tests__/api/changesets-board.test.ts
git commit -m "feat(api): add POST /api/changesets/board"
```

---

## Task 17: Idempotency middleware

**Files:**

- Create: `src/lib/api/idempotency.ts`
- Create: `src/lib/api/__tests__/idempotency.test.ts`
- Modify: `src/app/api/changesets/board/route.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { withIdempotency } from "../idempotency";

const supabaseMock = (
  existing: { status: number; response: unknown } | null,
) => ({
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          gt: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: existing
                ? { status: existing.status, response: existing.response }
                : null,
              error: null,
            }),
          })),
        })),
      })),
    })),
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
  })),
});

describe("withIdempotency", () => {
  beforeEach(() => vi.clearAllMocks());

  it("runs handler and stores result on first call", async () => {
    const supabase = supabaseMock(null);
    const handler = vi
      .fn()
      .mockResolvedValue({ status: 201, body: { ok: true } });

    const out = await withIdempotency(
      { tokenId: "t1", key: "k1", supabase: supabase as never },
      handler,
    );

    expect(handler).toHaveBeenCalledOnce();
    expect(out).toEqual({ status: 201, body: { ok: true } });
    expect(supabase.from).toHaveBeenCalledWith("api_idempotency_keys");
  });

  it("returns stored response and skips handler on replay", async () => {
    const supabase = supabaseMock({
      status: 201,
      response: { ok: true, replayed: true },
    });
    const handler = vi.fn();

    const out = await withIdempotency(
      { tokenId: "t1", key: "k1", supabase: supabase as never },
      handler,
    );

    expect(handler).not.toHaveBeenCalled();
    expect(out).toEqual({ status: 201, body: { ok: true, replayed: true } });
  });

  it("does nothing when no key is provided", async () => {
    const supabase = supabaseMock(null);
    const handler = vi
      .fn()
      .mockResolvedValue({ status: 201, body: { ok: true } });

    const out = await withIdempotency(
      { tokenId: "t1", key: null, supabase: supabase as never },
      handler,
    );

    expect(handler).toHaveBeenCalledOnce();
    expect(supabase.from).not.toHaveBeenCalled();
    expect(out).toEqual({ status: 201, body: { ok: true } });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/api/__tests__/idempotency.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// src/lib/api/idempotency.ts
import type { SupabaseClient } from "@supabase/supabase-js";

const TTL_HOURS = 24;

interface Args {
  tokenId: string;
  key: string | null;
  supabase: SupabaseClient;
}

interface HandlerResult {
  status: number;
  body: unknown;
}

export async function withIdempotency(
  args: Args,
  handler: () => Promise<HandlerResult>,
): Promise<HandlerResult> {
  if (!args.key) return await handler();

  const cutoff = new Date(
    Date.now() - TTL_HOURS * 60 * 60 * 1000,
  ).toISOString();
  const { data: existing } = await args.supabase
    .from("api_idempotency_keys")
    .select("status, response")
    .eq("token_id", args.tokenId)
    .eq("key", args.key)
    .gt("created_at", cutoff)
    .maybeSingle();

  if (existing) {
    return { status: existing.status as number, body: existing.response };
  }

  const result = await handler();
  // Best-effort store; ignore write conflicts (concurrent requests with the
  // same key — second one wins-or-loses, doesn't matter).
  await args.supabase.from("api_idempotency_keys").insert({
    token_id: args.tokenId,
    key: args.key,
    status: result.status,
    response: result.body as never,
  });
  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/api/__tests__/idempotency.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Wire into changesets/board route**

Modify `src/app/api/changesets/board/route.ts`. After auth + parse, before the RPC call:

```ts
import { withIdempotency } from "@/lib/api/idempotency";

const idempotencyKey = req.headers.get("idempotency-key");
const tokenId = (user as { tokenId?: string }).tokenId ?? null;

if (idempotencyKey && !tokenId) {
  // Idempotency only meaningful for token auth — silently ignore for sessions.
}

const result = await withIdempotency(
  {
    tokenId: tokenId ?? "session",
    key: tokenId ? idempotencyKey : null,
    supabase,
  },
  async () => {
    const { data, error } = await supabase.rpc("create_board_changeset", {
      payload: parsed,
    });
    if (error)
      return { status: 500, body: { error: error.message, details: error } };
    return { status: 201, body: data };
  },
);

return NextResponse.json(result.body, { status: result.status });
```

- [ ] **Step 6: Add a route-level idempotency test**

In `src/__tests__/api/changesets-board.test.ts`, add:

```ts
it("returns the stored response on idempotency replay", async () => {
  const stored = {
    board: { id: "b1", name: "Q3", groupId: null },
    columns: [],
    cards: [],
  };
  const fromSpy = vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          gt: vi.fn(() => ({
            maybeSingle: vi
              .fn()
              .mockResolvedValue({
                data: { status: 201, response: stored },
                error: null,
              }),
          })),
        })),
      })),
    })),
    insert: vi.fn(),
  }));
  const rpcSpy = vi.fn();
  mockAuth.mockResolvedValue({
    supabase: { rpc: rpcSpy, from: fromSpy } as never,
    user: { id: "u1", tokenId: "t1" } as never,
  });

  const res = await POST(buildReq(validPayload, { "idempotency-key": "abc" }));
  expect(res.status).toBe(201);
  expect(await res.json()).toEqual(stored);
  expect(rpcSpy).not.toHaveBeenCalled();
});
```

Run: `pnpm vitest run src/__tests__/api/changesets-board.test.ts`
Expected: PASS (5 tests now).

- [ ] **Step 7: Commit**

```bash
git add src/lib/api/idempotency.ts src/lib/api/__tests__/idempotency.test.ts \
        src/app/api/changesets/board/route.ts src/__tests__/api/changesets-board.test.ts
git commit -m "feat(api): add idempotency middleware for changesets endpoint"
```

---

## Task 18: In-memory rate limiter

**Files:**

- Create: `src/lib/api/rate-limit.ts`
- Create: `src/lib/api/__tests__/rate-limit.test.ts`
- Modify: `src/app/api/changesets/board/route.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { rateLimit, _resetRateLimitForTests } from "../rate-limit";

describe("rateLimit", () => {
  beforeEach(() => {
    _resetRateLimitForTests();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-21T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("allows up to N requests per window", () => {
    for (let i = 0; i < 60; i++) {
      expect(rateLimit("token-1").allowed).toBe(true);
    }
  });

  it("blocks the 61st request and reports retry-after", () => {
    for (let i = 0; i < 60; i++) rateLimit("token-1");
    const r = rateLimit("token-1");
    expect(r.allowed).toBe(false);
    expect(r.retryAfter).toBeGreaterThan(0);
    expect(r.retryAfter).toBeLessThanOrEqual(60);
  });

  it("resets after the window slides past", () => {
    for (let i = 0; i < 60; i++) rateLimit("token-1");
    expect(rateLimit("token-1").allowed).toBe(false);

    vi.advanceTimersByTime(61_000); // > 60s
    expect(rateLimit("token-1").allowed).toBe(true);
  });

  it("isolates buckets per token", () => {
    for (let i = 0; i < 60; i++) rateLimit("token-1");
    expect(rateLimit("token-1").allowed).toBe(false);
    expect(rateLimit("token-2").allowed).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/api/__tests__/rate-limit.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// src/lib/api/rate-limit.ts
const LIMIT = 60;
const WINDOW_MS = 60_000;

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter: number; // seconds, 0 when allowed
}

export function rateLimit(tokenId: string): RateLimitResult {
  const now = Date.now();
  const b = buckets.get(tokenId);

  if (!b || b.resetAt <= now) {
    buckets.set(tokenId, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: LIMIT - 1, retryAfter: 0 };
  }

  if (b.count >= LIMIT) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil((b.resetAt - now) / 1000),
    };
  }

  b.count += 1;
  return { allowed: true, remaining: LIMIT - b.count, retryAfter: 0 };
}

/** @internal Test-only — clears the in-memory buckets. */
export function _resetRateLimitForTests() {
  buckets.clear();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/api/__tests__/rate-limit.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Wire into the changesets route**

In `src/app/api/changesets/board/route.ts`, immediately after the auth check and before parsing the body:

```ts
import { rateLimit } from "@/lib/api/rate-limit";

const tokenIdForLimit = (user as { tokenId?: string }).tokenId;
if (tokenIdForLimit) {
  const limit = rateLimit(tokenIdForLimit);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }
}
```

- [ ] **Step 6: Add route-level rate-limit test**

In `src/__tests__/api/changesets-board.test.ts`, add:

```ts
import { _resetRateLimitForTests } from "@/lib/api/rate-limit";

it("returns 429 when token rate limit is exceeded", async () => {
  _resetRateLimitForTests();
  const rpcSpy = vi.fn().mockResolvedValue({ data: {}, error: null });
  mockAuth.mockResolvedValue({
    supabase: { rpc: rpcSpy, from: vi.fn() } as never,
    user: { id: "u1", tokenId: "t-rate" } as never,
  });

  // Burn the bucket
  for (let i = 0; i < 60; i++) {
    await POST(buildReq(validPayload));
  }
  const res = await POST(buildReq(validPayload));
  expect(res.status).toBe(429);
  expect(res.headers.get("Retry-After")).toBeDefined();
});
```

Run: `pnpm vitest run src/__tests__/api/changesets-board.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/api/rate-limit.ts src/lib/api/__tests__/rate-limit.test.ts \
        src/app/api/changesets/board/route.ts src/__tests__/api/changesets-board.test.ts
git commit -m "feat(api): add per-token in-memory rate limiter (60 req/min)"
```

---

## Task 19: i18n strings (`apiAccess.*`)

**Files:**

- Modify: `src/lib/locales/de.ts`

- [ ] **Step 1: Add the strings**

Open `src/lib/locales/de.ts` and add a new `apiAccess` section near the existing top-level groups (alongside `boardGroups`, `dashboard`, etc.). Keep alphabetical order if the file uses one.

```ts
apiAccess: {
  title: "Claude API-Zugang",
  subtitle: "Tokens für Claude Code und ähnliche Agenten verwalten.",
  masterToggle: "Claude API-Zugang aktivieren",
  masterToggleDescription:
    "Wenn aktiviert, können erstellte Tokens Boards, Karten und Dateien in deinem Namen anlegen.",
  masterDisabledBanner:
    "API-Zugang ist deaktiviert. Tokens bleiben gespeichert, sind aber inaktiv.",
  disableConfirmTitle: "API-Zugang deaktivieren?",
  disableConfirmDescription:
    "Alle aktiven Tokens werden sofort inaktiv. Du kannst sie später wieder aktivieren, indem du diesen Schalter erneut einschaltest.",
  tokenListTitle: "Tokens",
  tokenListEmpty: "Noch keine Tokens erstellt.",
  createToken: "Neuen Token erstellen",
  tokenName: "Name",
  tokenNamePlaceholder: 'z. B. „Claude Code Laptop"',
  tokenCreatedTitle: "Token erstellt",
  tokenCreatedOnce:
    "Kopiere diesen Token jetzt. Er wird aus Sicherheitsgründen nicht erneut angezeigt.",
  tokenCopy: "In Zwischenablage kopieren",
  tokenCopied: "Kopiert",
  tokenLastUsedNever: "Noch nie verwendet",
  tokenLastUsed: "Zuletzt verwendet:",
  revoke: "Widerrufen",
  revokeConfirmTitle: "Token widerrufen?",
  revokeConfirmDescription:
    "Der Token kann nicht mehr verwendet werden. Diese Aktion lässt sich nicht rückgängig machen.",
  viaApiBadge: "via API",
  viaApiBadgeTitle: "Über die Claude API erstellt",
},
```

- [ ] **Step 2: Type-check**

Run: `pnpm tsc --noEmit`
Expected: clean. The `t()` helper is type-safe; any missing key surfaces here.

- [ ] **Step 3: Commit**

```bash
git add src/lib/locales/de.ts
git commit -m "feat(i18n): add apiAccess.* strings"
```

---

## Task 20: API token CRUD routes

**Files:**

- Create: `src/app/api/api-tokens/route.ts`
- Create: `src/app/api/api-tokens/[id]/route.ts`
- Create: `src/app/api/users/api-access/route.ts`
- Create: `src/__tests__/api/api-tokens.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/__tests__/api/api-tokens.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  GET as listTokens,
  POST as createToken,
} from "@/app/api/api-tokens/route";
import { DELETE as revokeToken } from "@/app/api/api-tokens/[id]/route";
import { PATCH as patchAccess } from "@/app/api/users/api-access/route";
import { getSessionUser } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  getSessionUser: vi.fn(),
}));
vi.mock("@/lib/api-tokens/mint", () => ({
  mintToken: vi.fn(async () => ({
    token: "avk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
    row: {
      id: "tok-1",
      name: "Laptop",
      prefix: "avk_a1b2",
      createdAt: "2026-04-21T00:00:00Z",
    },
  })),
}));

const mockSession = vi.mocked(getSessionUser);
const USER = { id: "u1" };

const supabaseMock = (impl: (table: string) => unknown) => ({
  from: vi.fn(impl),
});

const req = (path: string, method: string, body?: unknown) =>
  body !== undefined
    ? new NextRequest(`http://localhost${path}`, {
        method,
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      })
    : new NextRequest(`http://localhost${path}`, { method });

describe("API tokens routes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("GET returns the caller's tokens", async () => {
    const rows = [
      {
        id: "tok-1",
        name: "Laptop",
        prefix: "avk_a1b2",
        last_used_at: null,
        created_at: "2026-01-01T00:00:00Z",
        revoked_at: null,
      },
    ];
    mockSession.mockResolvedValue({
      supabase: supabaseMock(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn().mockResolvedValue({ data: rows, error: null }),
          })),
        })),
      })) as never,
      user: USER as never,
    });
    const res = await listTokens();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.tokens[0]).toMatchObject({ id: "tok-1", name: "Laptop" });
  });

  it("POST mints a token only when api_access_enabled is true", async () => {
    mockSession.mockResolvedValue({
      supabase: supabaseMock((t) => {
        if (t === "users") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { api_access_enabled: true },
                  error: null,
                }),
              })),
            })),
          };
        }
        return {};
      }) as never,
      user: USER as never,
    });
    const res = await createToken(
      req("/api/api-tokens", "POST", { name: "Laptop" }),
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.token).toMatch(/^avk_/);
  });

  it("POST rejects when master flag is off", async () => {
    mockSession.mockResolvedValue({
      supabase: supabaseMock(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: { api_access_enabled: false },
              error: null,
            }),
          })),
        })),
      })) as never,
      user: USER as never,
    });
    const res = await createToken(
      req("/api/api-tokens", "POST", { name: "X" }),
    );
    expect(res.status).toBe(403);
  });

  it("DELETE soft-revokes by setting revoked_at", async () => {
    const updateSpy = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: "tok-1" },
              error: null,
            }),
          })),
        })),
      })),
    }));
    mockSession.mockResolvedValue({
      supabase: supabaseMock(() => ({ update: updateSpy })) as never,
      user: USER as never,
    });
    const res = await revokeToken(req("/api/api-tokens/tok-1", "DELETE"), {
      params: Promise.resolve({ id: "tok-1" }),
    });
    expect(res.status).toBe(200);
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ revoked_at: expect.any(String) }),
    );
  });

  it("PATCH /users/api-access toggles the flag for the caller", async () => {
    const updateSpy = vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    }));
    mockSession.mockResolvedValue({
      supabase: supabaseMock(() => ({ update: updateSpy })) as never,
      user: USER as never,
    });
    const res = await patchAccess(
      req("/api/users/api-access", "PATCH", { enabled: true }),
    );
    expect(res.status).toBe(200);
    expect(updateSpy).toHaveBeenCalledWith({ api_access_enabled: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/__tests__/api/api-tokens.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the routes**

```ts
// src/app/api/api-tokens/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/supabase/server";
import { mintToken } from "@/lib/api-tokens/mint";

const NameSchema = z.object({ name: z.string().trim().min(1).max(80) });

export async function GET() {
  const { supabase, user } = await getSessionUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("api_tokens")
    .select("id, name, prefix, last_used_at, created_at, revoked_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    tokens: (data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      prefix: r.prefix,
      lastUsedAt: r.last_used_at,
      createdAt: r.created_at,
      revokedAt: r.revoked_at,
    })),
  });
}

export async function POST(req: NextRequest) {
  const { supabase, user } = await getSessionUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = NameSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  // Master flag check
  const { data: u } = await supabase
    .from("users")
    .select("api_access_enabled")
    .eq("id", user.id)
    .single();
  if (!u?.api_access_enabled) {
    return NextResponse.json(
      { error: "API access is disabled — enable it in settings first." },
      { status: 403 },
    );
  }

  const result = await mintToken({
    userId: user.id,
    name: parsed.data.name,
    supabase,
  });

  return NextResponse.json(
    {
      token: result.token,
      id: result.row.id,
      name: result.row.name,
      prefix: result.row.prefix,
      createdAt: result.row.createdAt,
    },
    { status: 201 },
  );
}
```

```ts
// src/app/api/api-tokens/[id]/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/supabase/server";

const ParamsSchema = z.object({ id: z.string().uuid() });

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolved = await params;
  const parsed = ParamsSchema.safeParse(resolved);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid token id" }, { status: 400 });
  }

  const { supabase, user } = await getSessionUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("api_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
```

```ts
// src/app/api/users/api-access/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/supabase/server";

const Schema = z.object({ enabled: z.boolean() });

export async function PATCH(req: NextRequest) {
  const { supabase, user } = await getSessionUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("users")
    .update({ api_access_enabled: parsed.data.enabled })
    .eq("id", user.id);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, enabled: parsed.data.enabled });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/__tests__/api/api-tokens.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/api-tokens src/app/api/users/api-access src/__tests__/api/api-tokens.test.ts
git commit -m "feat(api): add api-tokens CRUD + master toggle endpoints"
```

---

## Task 21: Settings page — server shell

**Files:**

- Create: `src/app/(app)/profile/api-access/page.tsx`

- [ ] **Step 1: Implement**

```tsx
// src/app/(app)/profile/api-access/page.tsx
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/supabase/server";
import { ApiAccessContent } from "@/components/api-access/ApiAccessContent";

export default async function ApiAccessPage() {
  const { supabase, user } = await getSessionUser();
  if (!user) redirect("/login");

  const [{ data: u }, { data: tokens }] = await Promise.all([
    supabase
      .from("users")
      .select("api_access_enabled")
      .eq("id", user.id)
      .single(),
    supabase
      .from("api_tokens")
      .select("id, name, prefix, last_used_at, created_at, revoked_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <ApiAccessContent
      initialEnabled={u?.api_access_enabled ?? false}
      initialTokens={(tokens ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        prefix: r.prefix,
        lastUsedAt: r.last_used_at,
        createdAt: r.created_at,
        revokedAt: r.revoked_at,
      }))}
    />
  );
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm build`
Expected: route compiles. (No tests yet — UI tests come in the next task.)

- [ ] **Step 3: Commit**

```bash
git add src/app/(app)/profile/api-access/page.tsx
git commit -m "feat(ui): add /profile/api-access route shell"
```

---

## Task 22: Settings page — client component

**Files:**

- Create: `src/components/api-access/ApiAccessContent.tsx`
- Create: `src/components/api-access/CreateTokenDialog.tsx`
- Create: `src/components/api-access/__tests__/ApiAccessContent.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/api-access/__tests__/ApiAccessContent.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiAccessContent } from "../ApiAccessContent";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.endsWith("/api/users/api-access") && init?.method === "PATCH") {
        return new Response(JSON.stringify({ ok: true, enabled: true }));
      }
      return new Response("{}");
    }),
  );
});

describe("ApiAccessContent", () => {
  it("shows the master toggle and disables token list when off", () => {
    render(<ApiAccessContent initialEnabled={false} initialTokens={[]} />);
    expect(screen.getByRole("switch")).not.toBeChecked();
    expect(screen.getByText(/API-Zugang ist deaktiviert/i)).toBeInTheDocument();
  });

  it("renders token rows with the prefix and last-used time", () => {
    render(
      <ApiAccessContent
        initialEnabled={true}
        initialTokens={[
          {
            id: "tok-1",
            name: "Laptop",
            prefix: "avk_a1b2",
            lastUsedAt: null,
            createdAt: "2026-04-20T12:00:00Z",
            revokedAt: null,
          },
        ]}
      />,
    );
    expect(screen.getByText("Laptop")).toBeInTheDocument();
    expect(screen.getByText(/avk_a1b2/)).toBeInTheDocument();
  });

  it("PATCHes /api/users/api-access when toggle is flipped", async () => {
    const user = userEvent.setup();
    render(<ApiAccessContent initialEnabled={false} initialTokens={[]} />);
    await user.click(screen.getByRole("switch"));
    expect(fetch).toHaveBeenCalledWith(
      "/api/users/api-access",
      expect.objectContaining({ method: "PATCH" }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/api-access/__tests__/ApiAccessContent.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement `ApiAccessContent`**

```tsx
// src/components/api-access/ApiAccessContent.tsx
"use client";

import { useState, useTransition } from "react";
import useSWR from "swr";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ContentTopBar } from "@/components/layout/ContentTopBar";
import { CreateTokenDialog } from "./CreateTokenDialog";
import { t } from "@/lib/i18n";

export interface TokenRow {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function ApiAccessContent({
  initialEnabled,
  initialTokens,
}: {
  initialEnabled: boolean;
  initialTokens: TokenRow[];
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [, startTransition] = useTransition();

  const { data, mutate } = useSWR<{ tokens: TokenRow[] }>(
    "/api/api-tokens",
    fetcher,
    { fallbackData: { tokens: initialTokens } },
  );
  const tokens = data?.tokens ?? [];

  const writeFlag = (next: boolean) => {
    startTransition(async () => {
      const res = await fetch("/api/users/api-access", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (res.ok) setEnabled(next);
    });
  };

  const onToggle = (next: boolean) => {
    if (!next) setConfirmDisable(true);
    else writeFlag(true);
  };

  const onRevoke = async (id: string) => {
    if (!confirm(t("apiAccess.revokeConfirmDescription"))) return;
    const res = await fetch(`/api/api-tokens/${id}`, { method: "DELETE" });
    if (res.ok) await mutate();
  };

  return (
    <div className="flex min-h-screen flex-col">
      <ContentTopBar
        title={t("apiAccess.title")}
        subtitle={t("apiAccess.subtitle")}
      />

      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{t("apiAccess.masterToggle")}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {t("apiAccess.masterToggleDescription")}
              </p>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={onToggle}
              aria-label={t("apiAccess.masterToggle")}
            />
          </CardHeader>
        </Card>

        {!enabled && (
          <div className="rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
            {t("apiAccess.masterDisabledBanner")}
          </div>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t("apiAccess.tokenListTitle")}</CardTitle>
            <CreateTokenDialog disabled={!enabled} onCreated={() => mutate()} />
          </CardHeader>
          <CardContent>
            {tokens.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center">
                {t("apiAccess.tokenListEmpty")}
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {tokens.map((tok) => (
                  <li
                    key={tok.id}
                    className="py-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">{tok.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {tok.prefix}…
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {tok.lastUsedAt
                          ? `${t("apiAccess.tokenLastUsed")} ${new Date(
                              tok.lastUsedAt,
                            ).toLocaleString()}`
                          : t("apiAccess.tokenLastUsedNever")}
                      </div>
                    </div>
                    {!tok.revokedAt && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onRevoke(tok.id)}
                        disabled={!enabled}
                      >
                        {t("apiAccess.revoke")}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </main>

      <AlertDialog open={confirmDisable} onOpenChange={setConfirmDisable}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("apiAccess.disableConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("apiAccess.disableConfirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                writeFlag(false);
                setConfirmDisable(false);
              }}
            >
              {t("apiAccess.masterToggle")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
```

- [ ] **Step 4: Implement `CreateTokenDialog`**

```tsx
// src/components/api-access/CreateTokenDialog.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Copy, Check } from "lucide-react";
import { t } from "@/lib/i18n";

export function CreateTokenDialog({
  disabled,
  onCreated,
}: {
  disabled: boolean;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<{ token: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    const res = await fetch("/api/api-tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setSubmitting(false);
    if (!res.ok) return; // surface error toast in a follow-up; route returns 400/403
    const json = (await res.json()) as { token: string };
    setCreated(json);
    onCreated();
  };

  const close = () => {
    setOpen(false);
    setName("");
    setCreated(null);
    setCopied(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={disabled}>
          <Plus className="w-4 h-4 mr-2" />
          {t("apiAccess.createToken")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        {!created ? (
          <>
            <DialogHeader>
              <DialogTitle>{t("apiAccess.createToken")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="token-name">{t("apiAccess.tokenName")}</Label>
              <Input
                id="token-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("apiAccess.tokenNamePlaceholder")}
              />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={close}>
                Abbrechen
              </Button>
              <Button onClick={submit} disabled={submitting || !name.trim()}>
                {t("apiAccess.createToken")}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t("apiAccess.tokenCreatedTitle")}</DialogTitle>
              <DialogDescription>
                {t("apiAccess.tokenCreatedOnce")}
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-md border bg-muted px-3 py-2 font-mono text-sm break-all">
              {created.token}
            </div>
            <DialogFooter>
              <Button
                onClick={async () => {
                  await navigator.clipboard.writeText(created.token);
                  setCopied(true);
                }}
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    {t("apiAccess.tokenCopied")}
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    {t("apiAccess.tokenCopy")}
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={close}>
                Schließen
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run src/components/api-access/__tests__/ApiAccessContent.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Smoke-test the page in the browser**

Run: `pnpm dev` (in another terminal — leave running).
Visit `http://localhost:3000/profile/api-access`.
Verify:

- Toggle is off, list says "Noch keine Tokens erstellt", Create button disabled.
- Flip toggle on, create button enables.
- Create a token "Test", confirm the plaintext shows once with copy button.
- Reload page → token in list with prefix `avk_…`. Click Revoke → row disappears (or shows revoked state).
- Flip toggle off → confirm dialog → all controls disabled, banner appears.

If anything breaks visually, fix before commit.

- [ ] **Step 7: Commit**

```bash
git add src/components/api-access
git commit -m "feat(ui): add /profile/api-access settings page"
```

---

## Task 23: "Via API" badge

**Files:**

- Create: `src/components/ui/ViaApiBadge.tsx`
- Modify: `src/components/boards/BoardCard.tsx`
- Modify: `src/components/kanban/KanbanCard.tsx` (or whichever component renders cards on the board)

- [ ] **Step 1: Implement the badge**

```tsx
// src/components/ui/ViaApiBadge.tsx
import { Bot } from "lucide-react";
import { t } from "@/lib/i18n";

export function ViaApiBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-violet-50 text-violet-700 border border-violet-200 px-2 py-0.5 text-[10px] font-medium"
      title={t("apiAccess.viaApiBadgeTitle")}
    >
      <Bot className="w-3 h-3" />
      {t("apiAccess.viaApiBadge")}
    </span>
  );
}
```

- [ ] **Step 2: Wire into BoardCard**

Find where the board's metadata row is rendered in `src/components/boards/BoardCard.tsx`. Conditionally render the badge:

```tsx
{
  board.createdVia === "api" && <ViaApiBadge />;
}
```

(Add the import at the top: `import { ViaApiBadge } from "@/components/ui/ViaApiBadge";`)

- [ ] **Step 3: Wire into the card-display component**

Locate the kanban card component (`src/components/kanban/KanbanCard.tsx` or similar — `grep -ln "function KanbanCard\|export function.*Card" src/components/kanban/`). Add the same conditional render in the card's metadata row.

- [ ] **Step 4: Type-check + visual verify**

Run: `pnpm tsc --noEmit` (expect clean).

In the dev server, create a board through the API (curl with a fresh token), reload the dashboard, and confirm the badge appears on that board's card. Same for a card created through the API.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/ViaApiBadge.tsx src/components/boards/BoardCard.tsx src/components/kanban/KanbanCard.tsx
git commit -m "feat(ui): show via-API badge on boards and cards created through the API"
```

---

## Task 24: Documentation — `docs/api/`

**Files:**

- Create: 8 markdown files under `docs/api/`.

This task batches documentation. Each file is short (≤200 lines) and follows the same template: 1-paragraph overview → endpoint reference → curl example → fetch example → error notes.

- [ ] **Step 1: Create `docs/api/README.md`**

````markdown
# Aviam Kanban API

Base URL: `https://kanban.aviam.ag` (production) or your dev host.

This API powers Claude Code (and similar agents) for opted-in users. It is
not a public marketplace API — every request runs as a real user with the
permissions of that user's session.

## Versioning

The API is unversioned in v1 — additive changes only. Breaking changes will
ship under `/api/v2/` if and when needed.

## Authentication

All endpoints accept either a session cookie (browser) or a personal access
token (Claude Code). See `authentication.md`.

## Error format

```json
{ "error": "human-readable message", "at": "cards[2].title", "details": {} }
```
````

See `errors.md` for the full list.

## Endpoints

- `authentication.md` — token lifecycle, header format
- `changesets.md` — `POST /api/changesets/board` (atomic batch create)
- `boards.md`, `cards.md`, `attachments.md`, `groups.md` — per-resource CRUD
- `errors.md` — error codes

````

- [ ] **Step 2: Create `docs/api/authentication.md`**

```markdown
# Authentication

## Personal Access Tokens

Tokens are minted at `/profile/api-access` after enabling the master flag.
Format: `avk_<32 chars>` (36 chars total). The plaintext is shown **once**;
copy it immediately.

### Header

````

Authorization: Bearer avk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6

````

### curl example

```bash
curl -H "Authorization: Bearer $AVIAM_KANBAN_TOKEN" \
     https://kanban.aviam.ag/api/boards
````

### Revocation

DELETE `/api/api-tokens/{id}` (web UI button) or toggle the master flag off
in `/profile/api-access` to make all of your tokens inert without deleting
them.

### Failure modes

| Status | Cause                                                      |
| ------ | ---------------------------------------------------------- |
| 401    | Missing/invalid token, or master flag is off               |
| 403    | Token valid but the user lacks permission for the resource |
| 429    | Rate limit (60 req/min per token) — see `Retry-After`      |

````

- [ ] **Step 3: Create `docs/api/changesets.md`**

```markdown
# POST /api/changesets/board

Atomically creates a board with all of its columns, cards, and subtasks. If
any insert fails, the entire transaction rolls back.

## Headers

| Header              | Required | Notes |
| ------------------- | -------- | ----- |
| `Authorization`     | yes      | `Bearer avk_…` |
| `Content-Type`      | yes      | `application/json` |
| `Idempotency-Key`   | no       | Client-supplied UUID; replayed within 24h returns the original response |

## Body

```json
{
  "board": {
    "name": "Q3 Roadmap",
    "description": "Optional, ≤2000 chars",
    "groupId": "optional-uuid"
  },
  "columns": [
    { "title": "Backlog", "position": 1 },
    { "title": "Doing",   "position": 2 },
    { "title": "Done",    "position": 3 }
  ],
  "cards": [
    {
      "columnRef": "Backlog",
      "title": "Pick metrics",
      "description": "Optional, ≤8000 chars",
      "priority": "high",
      "dueDate": "2026-05-01T00:00:00Z",
      "subtasks": [{ "title": "Draft KPI list" }]
    }
  ]
}
````

### Field rules

- All titles: 1–80 chars, NFC-normalized, must match `[\p{L}\p{N}\p{P}\p{Zs}]+`. No emoji, no control characters.
- `columns`: 1–20 items, titles must be **unique within this request**.
- `cards`: 0–200 items, each `columnRef` must equal one of `columns[].title` exactly (post-NFC).
- `subtasks`: ≤50 per card.
- `priority`: `"high" | "medium" | "low"` (default `"medium"`).

## Response (201)

```json
{
  "board":   { "id": "uuid", "name": "Q3 Roadmap", "groupId": null },
  "columns": [{ "id": 1, "title": "Backlog", "position": 1 }, …],
  "cards":   [{ "id": "uuid", "title": "Pick metrics",
               "columnId": 1,
               "subtasks": [{ "id": 1, "title": "Draft KPI list" }] }]
}
```

## Atomicity

The entire body is applied via a single PostgreSQL transaction
(`create_board_changeset` PL/pgSQL RPC). Any failure rolls back all inserts.

## curl

```bash
curl -X POST https://kanban.aviam.ag/api/changesets/board \
  -H "Authorization: Bearer $AVIAM_KANBAN_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d @board.json
```

## fetch

```ts
const res = await fetch(`${BASE_URL}/api/changesets/board`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "Idempotency-Key": crypto.randomUUID(),
  },
  body: JSON.stringify(payload),
});
if (!res.ok) throw new Error((await res.json()).error);
const result = await res.json();
```

````

- [ ] **Step 4: Create `docs/api/boards.md`, `cards.md`, `attachments.md`, `groups.md`**

For each, cover the existing CRUD endpoints with a curl + fetch example each. Extract the field shapes from the existing route handlers (`src/app/api/boards/route.ts`, etc.) — do not invent new endpoints.

Suggested skeleton per file:

```markdown
# {Resource}

## GET /api/{resource}
…

## POST /api/{resource}
Body: `{ … }`
Returns `201 { … }`.

## PUT /api/{resource}/{id}
…

## DELETE /api/{resource}/{id}
…

## curl

```bash
…
````

## fetch

```ts
…
```

````

(For attachments, document the multipart `FormData` pattern explicitly with a Node fs stream example.)

- [ ] **Step 5: Create `docs/api/errors.md`**

```markdown
# Errors

All errors follow this shape:

```json
{ "error": "human-readable message", "at": "cards[2].title", "details": {} }
````

| Status | Meaning                                                       |
| ------ | ------------------------------------------------------------- |
| 400    | Validation failed; `at` points to the offending field         |
| 401    | Authentication required or token invalid / master flag off    |
| 403    | Authenticated but unauthorized for this resource              |
| 404    | Resource not found (often RLS-filtered)                       |
| 409    | Conflict — e.g. duplicate column title in same board          |
| 429    | Rate limit exceeded; `Retry-After: <seconds>` header included |
| 500    | Server error — inspect `details` for the underlying message   |

````

- [ ] **Step 6: Commit**

```bash
git add docs/api/
git commit -m "docs(api): add REST API reference under docs/api/"
````

---

## Task 25: Documentation — `docs/api/CLAUDE.md` drop-in

**Files:**

- Create: `docs/api/CLAUDE.md`

- [ ] **Step 1: Implement**

````markdown
# Aviam Kanban — Claude Code workflow

Drop the contents of this file into your own project's `CLAUDE.md` to teach
Claude how to apply changes to your Aviam Kanban board.

## Environment

Set these in your shell or `.env`:

```bash
AVIAM_KANBAN_URL="https://kanban.aviam.ag"
AVIAM_KANBAN_TOKEN="avk_…"
```
````

Mint the token at `${AVIAM_KANBAN_URL}/profile/api-access` first.

## Workflow — propose, confirm, apply

When the user asks Claude to "make this a board" / "track these tasks":

1. **Propose** the changeset as a Markdown table in chat:

   | Column  | Card         | Priority | Subtasks       |
   | ------- | ------------ | -------- | -------------- |
   | Backlog | Pick metrics | high     | Draft KPI list |

   | …

2. **Wait for explicit confirmation** ("ja", "go", "apply").

3. **Apply** with one POST:

   ```bash
   curl -X POST "$AVIAM_KANBAN_URL/api/changesets/board" \
     -H "Authorization: Bearer $AVIAM_KANBAN_TOKEN" \
     -H "Content-Type: application/json" \
     -H "Idempotency-Key: $(uuidgen)" \
     -d @changeset.json
   ```

4. Subsequent edits (add a card, attach a file, add a subtask) use the
   per-resource endpoints — no separate confirmation step needed; Claude
   Code's tool-permission flow covers it.

## Title rules

All titles (board, column, card, subtask) must be:

- 1–80 chars
- ASCII letters/digits/punctuation/spaces and equivalent Unicode classes
  (`\p{L}\p{N}\p{P}\p{Zs}`)
- **No emoji, no control chars** — they will be rejected at validation
- Column titles must be **unique within a board**

## Error handling

- **401** — token invalid, expired, or master flag off → tell the user to
  re-mint at `/profile/api-access`.
- **429** — rate limit; respect the `Retry-After` header.
- **400** — validation; `error` and `at` point to the issue, fix and retry.

## What you can do

| Resource    | Routes                                                                          |
| ----------- | ------------------------------------------------------------------------------- |
| Boards      | `GET/POST/PUT/DELETE /api/boards[/:id]`                                         |
| Groups      | `GET/POST/PUT/DELETE /api/board-groups[/:id]`                                   |
| Columns     | `GET/POST/PUT/DELETE /api/columns[/:id]`, `POST /api/columns/bulk-update`       |
| Cards       | `GET/POST/PUT/DELETE /api/cards[/:id]`, `POST /api/cards/bulk-{reorder,update}` |
| Subtasks    | `POST /api/cards/:id/subtasks`, `PUT/DELETE /api/cards/:id/subtasks/:sid`       |
| Attachments | `POST /api/cards/:id/attachments` (multipart)                                   |
| Composite   | `POST /api/changesets/board` (board + columns + cards + subtasks)               |

See `docs/api/changesets.md` for the composite-create payload schema.

````

- [ ] **Step 2: Commit**

```bash
git add docs/api/CLAUDE.md
git commit -m "docs(api): add CLAUDE.md drop-in snippet for Claude Code projects"
````

---

## Task 26: Final verification + sweep

- [ ] **Step 1: Full test suite**

Run: `pnpm test`
Expected: all suites green, including all new tests added in this plan.

- [ ] **Step 2: Type-check**

Run: `pnpm tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: clean (or fix any new warnings).

- [ ] **Step 4: Production build**

Run: `pnpm build`
Expected: clean compile, all routes register, no missing-page errors.

- [ ] **Step 5: End-to-end smoke**

In the running dev server:

1. Visit `/profile/api-access`, mint a token "smoke-test", copy it.
2. From the terminal:
   ```bash
   export TOK="avk_…"
   curl -X POST http://localhost:3000/api/changesets/board \
     -H "Authorization: Bearer $TOK" \
     -H "Content-Type: application/json" \
     -d '{"board":{"name":"Smoke"},"columns":[{"title":"Backlog","position":1},{"title":"Done","position":2}],"cards":[{"columnRef":"Backlog","title":"It works"}]}'
   ```
3. Reload the dashboard. The new "Smoke" board appears with a "via API" badge. Open it; the card has the badge too.
4. Toggle the master flag off in `/profile/api-access`. Re-run the curl above — expect 401.
5. Revoke the token from the UI. Toggle master back on. Re-run the curl — expect 401 (token gone).

- [ ] **Step 6: No commit needed unless smoke testing surfaced fixes**

If smoke testing surfaced bugs, fix them with focused commits per fix. Otherwise this task is just verification.

---

## End-state

A user toggles the API flag in `/profile/api-access`, mints a token, drops it
into their Claude Code project's env via the `docs/api/CLAUDE.md` snippet,
and Claude can propose-then-apply Kanban content — atomically for the
"new board with everything" case, and incrementally for follow-up edits.
Boards/cards created via the API are visually marked so other team members
on shared boards know which content came from an agent.
