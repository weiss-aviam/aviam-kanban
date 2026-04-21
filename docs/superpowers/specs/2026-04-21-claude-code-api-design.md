# Claude Code API Access — Design

**Status:** Approved (brainstorming phase)
**Date:** 2026-04-21
**Author:** Matthias W (with Claude)

## Goal

Enable opted-in users to let Claude Code (and similar agents) create and manage
Aviam Kanban content — boards, groups, columns, cards, subtasks, attachments —
from outside the web UI, via a documented REST API with personal access tokens.

The motivation: planning happens in Claude Code, but the resulting plan never
materializes as actual Kanban data. We want a "polished v1" that closes that
gap without becoming a full-blown public API platform.

## Non-Goals (v1)

- **MCP server.** Planned as v2 once the REST surface is stable.
- **Per-board AI-write flag.** Rejected — Claude must also be able to create
  boards and groups, where no parent board exists to flag.
- **Token scopes (read-only vs read-write).** Token = exactly the user's
  permissions; no finer grain.
- **OAuth, webhooks, public API keys.** YAGNI.

## Workflow

The user-facing pattern is **propose → confirm → apply**:

1. The user works with Claude Code, planning a feature/refactor/etc.
2. Claude builds a structured changeset proposal (board + columns + cards +
   subtasks) and renders it in chat as a Markdown table for the user to review.
3. The user explicitly says "go" / "ja" / "apply".
4. Claude calls `POST /api/changesets/board` once, atomically.
5. Incremental edits afterwards (add a card, attach a file, add a subtask) go
   through the existing per-resource endpoints — no separate confirm step,
   Claude Code's built-in tool-permission flow is enough for those.

## Architecture

### Auth & data model

Three additive migrations:

**1. `users.api_access_enabled BOOLEAN NOT NULL DEFAULT false`**
Master opt-in flag. No token can be minted, and no token-authenticated request
can succeed, while this is `false`. Toggling off does not delete tokens — it
just makes them inert, so they reactivate when the user turns the master back on.

**2. `api_tokens` table**

| Column         | Type                                 | Purpose                                              |
| -------------- | ------------------------------------ | ---------------------------------------------------- |
| `id`           | uuid PK                              |                                                      |
| `user_id`      | uuid FK → users.id ON DELETE CASCADE | Owner                                                |
| `name`         | text NOT NULL                        | User-supplied label, e.g. "Claude Code Laptop"       |
| `token_hash`   | text NOT NULL                        | argon2id hash; plaintext shown only once at creation |
| `prefix`       | text(8) NOT NULL                     | First 8 chars of the token, for UI recognition       |
| `last_used_at` | timestamptz                          | Updated on each successful auth                      |
| `created_at`   | timestamptz NOT NULL DEFAULT now()   |                                                      |
| `revoked_at`   | timestamptz                          | Soft revoke; auth ignores when set                   |

Index `(prefix)` for fast lookup; index `(user_id, revoked_at)` for the listing.

Token format: `avk_<32-char-base62>` (36 chars total). The `avk_` prefix lets
us detect Aviam tokens accidentally pasted into chat/git/Slack — useful for
future secret-scanning hooks. The `prefix` column stores the first 8 chars of
the full token (e.g. `avk_a1b2`), used both for the constant-time lookup and
the UI list ("avk_a1b2…").

**3. `created_via TEXT NOT NULL DEFAULT 'ui'` on `boards`, `cards`, `subtasks`,
`attachments`**

Values: `'ui' | 'api'`. The UI shows a small "via API" badge on items with
`created_via = 'api'`, so other members of a shared board can see when content
came from an agent.

**4. `UNIQUE (board_id, title)` on `columns`**

Required for the changeset's `columnRef`-by-title lookup to be unambiguous.
Before applying the constraint, run `scripts/check-column-duplicates.js` to
detect any existing duplicates — if found, the user fixes them manually before
the migration runs. (Fits the additive-only migration rule from CLAUDE.md.)

### Auth middleware

A new helper `getAuthorizedUser()` lives next to `getSessionUser()` in
`src/lib/supabase/server.ts`. It checks `Authorization: Bearer avk_…` first,
falls back to the existing cookie session.

```ts
export async function getAuthorizedUser() {
  const authHeader = headers().get("authorization");
  if (authHeader?.startsWith("Bearer avk_")) {
    return await authenticateBearerToken(authHeader.slice(7));
  }
  return await getSessionUser();
}
```

`authenticateBearerToken` does:

1. Extract the prefix (first 8 chars of the full token, e.g. `avk_a1b2`).
2. `SELECT * FROM api_tokens WHERE prefix = $1 AND revoked_at IS NULL`.
3. Verify the argon2id hash against the candidate row(s).
4. Load the user; abort with 401 if `api_access_enabled = false`.
5. Update `last_used_at` (fire-and-forget, no await).
6. Build a Supabase client with a server-issued short-lived JWT for the token's
   user, so existing RLS policies (`auth.uid() = …`) keep working unchanged.

All API routes switch from `getSessionUser` to `getAuthorizedUser` — no other
changes inside the routes.

### API surface

**Existing routes** (unchanged behaviour, just accept Bearer auth too):

- `GET/POST/PUT/DELETE /api/boards[/:id]`
- `GET/POST/PUT/DELETE /api/cards[/:id]`
- `POST /api/cards/:id/subtasks`, `PUT/DELETE /api/cards/:id/subtasks/:sid`
- `POST /api/cards/:id/attachments` (multipart — Bearer auth works fine here)
- `GET/POST/PUT/DELETE /api/board-groups[/:id]`
- `GET/POST/PUT/DELETE /api/columns[/:id]`
- `POST /api/cards/bulk-reorder`, `POST /api/cards/bulk-update`
- `POST /api/columns/bulk-update`

**New endpoint** — composite create:

```
POST /api/changesets/board
Authorization: Bearer avk_…
Content-Type: application/json
Idempotency-Key: <optional client uuid>
```

Body schema (zod):

```ts
const ChangesetSchema = z.object({
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
        columnRef: TitleSchema, // matched against columns[].title
        title: TitleSchema,
        description: z.string().max(8000).optional(),
        priority: z.enum(["high", "medium", "low"]).default("medium"),
        dueDate: z.string().datetime().optional(),
        subtasks: z
          .array(z.object({ title: TitleSchema }))
          .max(50)
          .optional(),
      }),
    )
    .max(200)
    .optional(),
});

const TitleSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[\p{L}\p{N}\p{P}\p{Zs}]+$/u, "title contains forbidden characters")
  .transform((s) => s.normalize("NFC"));
```

Response (201):

```json
{
  "board": { "id": "uuid", "name": "...", "groupId": "uuid|null" },
  "columns": [{ "id": 1, "title": "Backlog", "position": 1 }],
  "cards": [
    { "id": "uuid", "title": "...", "subtasks": [{ "id": 1, "title": "..." }] }
  ]
}
```

**Atomicity:** the entire changeset runs in a single Postgres transaction. We
implement this as a Supabase RPC (`create_board_changeset`) written in PL/pgSQL,
because the JS Supabase client doesn't expose multi-statement transactions
directly. The RPC takes the validated payload as JSONB and either commits all
inserts or rolls back. If any insert fails (validation, RLS, FK), the entire
operation aborts and returns 4xx/5xx with `{ error, at, details }`.

**`columnRef` resolution:** in the RPC, after inserting the columns, we build
an in-memory `Map<normalizedTitle → columnId>` and look up each card's
`columnRef`. Because of the new unique constraint and the NFC-normalized
TitleSchema, the mapping is deterministic. Duplicate `columnRef` values _within
the request_ are caught at the zod layer before the RPC is called.

**Idempotency:** the optional `Idempotency-Key` header (client-supplied UUID)
is stored in a small `api_idempotency_keys` table `(token_id, key, response,
created_at)` with a 24-hour TTL. Repeat calls with the same key return the
stored response. Protects against retries creating duplicate boards.

**Rate limiting:** 60 requests/minute per token, in-memory counter per
PM2 process. Returns 429 with `Retry-After: <seconds>` on overflow. Sufficient
for v1; later move to Upstash if we go multi-instance.

**Error format** (consistent across all token-authenticated routes):

```json
{
  "error": "human-readable message",
  "at": "cards[2].subtasks[0]",
  "details": {}
}
```

### UI

**New settings area** at `/profile/api-access` (own tab off `/profile`):

- Master toggle "Claude API-Zugang aktivieren". Toggling off shows a confirm
  dialog explaining that all tokens become inert.
- Token list: `name`, `prefix` (`avk_a1b2c3d4…`), `created_at`, `last_used_at`,
  "Widerrufen" button per row. When master is off, the list is shown but
  read-only with a grey banner.
- "Neuen Token erstellen" dialog: name input → on submit, the plaintext token
  is shown once with a copy button and a clear "Wird nicht erneut angezeigt"
  warning.

**"Via API" badge:** wherever cards/boards are rendered with their meta
information (board card, card detail dialog), if `created_via === 'api'` we
show a small dot or muted badge ("via API"). Same for board headers and the
boards-list page. Already-existing card/board components get a small visual
addition; no structural change.

### Documentation

New directory `docs/api/`:

```
docs/api/
├── README.md            Overview, base URL, versioning, error schema
├── authentication.md    Token mint/revoke, Bearer header, curl example
├── changesets.md        POST /api/changesets/board with examples + columnRef pattern
├── boards.md            GET/POST/PUT/DELETE /api/boards[/:id]
├── cards.md             GET/POST/PUT/DELETE /api/cards[/:id], subtasks routes
├── attachments.md       multipart upload example
├── groups.md            board-groups CRUD
└── errors.md            Error schema + common codes
```

Each route doc includes: zod schema (hand-maintained for v1), `curl` example,
`fetch` example.

`docs/api/CLAUDE.md` is a copy-pasteable snippet the user can drop into their
own Claude Code project's `CLAUDE.md`. It documents the propose-→-confirm-→-apply
workflow, env vars (`AVIAM_KANBAN_TOKEN`, `AVIAM_KANBAN_URL`), title rules,
and 401/429 handling.

### i18n

New strings under `apiAccess.*` in `src/lib/locales/de.ts`:

- `apiAccess.title`, `apiAccess.subtitle`
- `apiAccess.masterToggle`, `apiAccess.masterToggleDescription`
- `apiAccess.disableConfirmTitle`, `apiAccess.disableConfirmDescription`
- `apiAccess.tokenListEmpty`, `apiAccess.createToken`
- `apiAccess.tokenName`, `apiAccess.tokenCreatedOnce`, `apiAccess.tokenCopy`
- `apiAccess.revoke`, `apiAccess.revokeConfirm`
- `apiAccess.viaApiBadge`

### Testing

- **Unit:** token hashing/verification, `getAuthorizedUser` middleware
  (cookie-fallback, revoked token, master-toggle off, rate-limit), changeset
  validation (columnRef lookup, duplicate refs, forbidden-char title).
- **Integration:** atomicity test using `vi.spyOn` on the second insert phase
  to throw, asserting no cards persist. Also a happy-path test using a real
  Supabase test database (per existing test patterns).
- **E2E:** not required for v1.

## Open questions for implementation phase

- The Supabase RPC for atomic changeset application needs to be written as a
  SQL migration. The implementation plan should sketch its rough body and
  confirm RLS interaction (the RPC runs with the caller's JWT, so RLS still
  applies — this is what we want).
- Token format: confirmed `avk_<32-char-base62>`. We'll need to pick the base62
  alphabet and a CSPRNG source — `crypto.randomBytes` + a base62 encoder is
  fine.

## Build sequence (rough — for the implementation plan)

1. Migrations (4 additive: `api_access_enabled`, `api_tokens`,
   `created_via`, `columns_unique_title_per_board`).
2. Token mint/verify helpers + `getAuthorizedUser` middleware.
3. Wire `getAuthorizedUser` into all `/api/*` routes (mechanical).
4. PL/pgSQL RPC `create_board_changeset` + `POST /api/changesets/board` route.
5. Idempotency-Keys table + middleware.
6. Rate-limiter (in-memory).
7. Settings UI: master toggle + token list + create dialog.
8. "Via API" badges in card/board components.
9. `docs/api/*` — written alongside the corresponding route.
10. `docs/api/CLAUDE.md`.
11. Tests at each step.

End-state: a user toggles the flag in settings, mints a token, drops it into
their Claude Code project's env, and Claude can propose-then-apply Kanban
content — atomically for the "new board with everything" case, sequentially
for incremental edits.
