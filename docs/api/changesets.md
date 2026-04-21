# POST /api/changesets/board

Atomically creates a board with all of its columns, cards, and subtasks. If
any insert fails, the entire transaction rolls back.

## Headers

| Header            | Required | Notes                                                                   |
| ----------------- | -------- | ----------------------------------------------------------------------- |
| `Authorization`   | yes      | `Bearer avk_…`                                                          |
| `Content-Type`    | yes      | `application/json`                                                      |
| `Idempotency-Key` | no       | Client-supplied UUID; replayed within 24h returns the original response |

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
    { "title": "Doing", "position": 2 },
    { "title": "Done", "position": 3 }
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
```

### Field rules

- All titles: 1–80 chars, NFC-normalized, must match `[\p{L}\p{N}\p{P}\p{Zs}]+`. No emoji, no control characters.
- `columns`: 1–20 items, titles must be **unique within this request**.
- `cards`: 0–200 items, each `columnRef` must equal one of `columns[].title` exactly (post-NFC).
- `subtasks`: ≤50 per card.
- `priority`: `"high" | "medium" | "low"` (default `"medium"`).

## Response (201)

```json
{
  "board": { "id": "uuid", "name": "Q3 Roadmap", "groupId": null },
  "columns": [{ "id": 1, "title": "Backlog", "position": 1 }, "…"],
  "cards": [
    {
      "id": "uuid",
      "title": "Pick metrics",
      "columnId": 1,
      "subtasks": [{ "id": 1, "title": "Draft KPI list" }]
    }
  ]
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
