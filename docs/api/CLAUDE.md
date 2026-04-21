# Aviam Kanban — Claude Code workflow

Drop the contents of this file into your own project's `CLAUDE.md` to teach
Claude how to apply changes to your Aviam Kanban board.

## Environment

Set these in your shell or `.env`:

```bash
AVIAM_KANBAN_URL="https://kanban.aviam.ag"
AVIAM_KANBAN_TOKEN="avk_…"
```

Mint the token at `${AVIAM_KANBAN_URL}/profile/api-access` first.

## Workflow — propose, confirm, apply

When the user asks Claude to "make this a board" / "track these tasks":

1. **Propose** the changeset as a Markdown table in chat:

   | Column  | Card         | Priority | Subtasks       |
   | ------- | ------------ | -------- | -------------- |
   | Backlog | Pick metrics | high     | Draft KPI list |

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

The table below is the **complete** list of endpoints. Paths that look like
they should exist but don't (`GET /api/cards`, `GET /api/columns`, `PUT`
on cards/columns/subtasks) will 404 or 405 — don't try them.

| Resource    | Real routes                                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------------------------- |
| Boards      | `GET, POST /api/boards` · `GET, PUT, DELETE /api/boards/:id`                                                        |
| Groups      | `GET, POST /api/board-groups` · `PUT, DELETE /api/board-groups/:id`                                                 |
| Columns     | `POST /api/columns` · `PATCH, DELETE /api/columns/:id` · `POST /api/columns/bulk-update`                            |
| Cards       | `POST /api/cards` · `PATCH, DELETE /api/cards/:id` · `POST /api/cards/bulk-update` · `POST /api/cards/bulk-reorder` |
| Subtasks    | `GET, POST /api/cards/:id/subtasks` · `PATCH, DELETE /api/cards/:id/subtasks/:subtaskId`                            |
| Attachments | `GET, POST, DELETE /api/cards/:id/attachments` (POST = multipart)                                                   |
| Calendar    | `GET /api/calendar/cards` (all cards with due dates across boards)                                                  |
| Composite   | `POST /api/changesets/board` (board + columns + cards + subtasks, atomic)                                           |

**Read strategy.** There is no `GET /api/cards` or `GET /api/columns`. To
read a board's full state (columns, cards, members) use `GET /api/boards/:id`.
For a cross-board feed of upcoming work, use `GET /api/calendar/cards`.

See `docs/api/changesets.md` for the composite-create payload schema.
