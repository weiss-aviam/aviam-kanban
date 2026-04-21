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
