# Cards

Sources:

- `src/app/api/cards/route.ts`
- `src/app/api/cards/[id]/route.ts`
- `src/app/api/cards/bulk-update/route.ts`
- `src/app/api/cards/bulk-reorder/route.ts`
- `src/app/api/cards/[id]/subtasks/route.ts`
- `src/app/api/cards/[id]/subtasks/[subtaskId]/route.ts`

## POST /api/cards

Creates a card inside a board column.

**Request body**

| Field         | Type                      | Required | Notes                    |
| ------------- | ------------------------- | -------- | ------------------------ |
| `boardId`     | uuid                      | yes      |                          |
| `columnId`    | integer                   | yes      | Must belong to `boardId` |
| `title`       | string (1–160)            | yes      |                          |
| `description` | string                    | no       |                          |
| `assigneeId`  | uuid                      | no       |                          |
| `dueDate`     | ISO8601 datetime          | no       |                          |
| `priority`    | `"high"\|"medium"\|"low"` | no       | Default `"medium"`       |
| `position`    | integer                   | no       | Auto-appended if omitted |

**Response 201**

```json
{
  "card": {
    "id": "uuid",
    "boardId": "uuid",
    "columnId": 1,
    "title": "string",
    "description": "string | null",
    "assigneeId": "uuid | null",
    "dueDate": "ISO8601 | null",
    "priority": "medium",
    "position": 3,
    "createdAt": "ISO8601",
    "createdBy": "uuid",
    "labels": [],
    "comments": []
  }
}
```

## PATCH /api/cards/{id}

Partial update. Send only the fields you want to change.

| Field         | Type                      | Notes                                                          |
| ------------- | ------------------------- | -------------------------------------------------------------- |
| `title`       | string (1–160)            |                                                                |
| `description` | string                    |                                                                |
| `assigneeId`  | uuid \| null              |                                                                |
| `dueDate`     | ISO8601 \| null           | Only the card creator may change this directly                 |
| `priority`    | `"high"\|"medium"\|"low"` |                                                                |
| `columnId`    | integer                   | Must belong to the same board                                  |
| `position`    | integer                   |                                                                |
| `completedAt` | ISO8601 \| null           | Set to mark/unmark complete; also auto-set on done-column move |

Full schema: `src/app/api/cards/[id]/route.ts`

**Response 200** — same card shape as POST (minus `labels`/`comments`).

## DELETE /api/cards/{id}

Permanently deletes a card. Requires non-viewer board membership.

**Response 200** `{ "message": "Card deleted successfully" }`

## POST /api/cards/bulk-update

Moves cards across columns (e.g. drag-and-drop). Auto-sets `completedAt` when
a card lands in a done column.

All cards must belong to the **same board**.

**Request body**

```json
{
  "updates": [
    { "id": "uuid", "columnId": 2, "position": 1 },
    { "id": "uuid", "columnId": 2, "position": 2 }
  ]
}
```

**Response 200** `{ "success": true, "updatedCount": 2 }`

## POST /api/cards/bulk-reorder

Reorders cards within or across columns without triggering done-column logic
or notifications.

Same body shape as `bulk-update`. Minimum 1 update required.

**Response 200** `{ "message": "Cards reordered successfully", "updatedCount": 2 }`

---

## Subtasks

### GET /api/cards/{id}/subtasks

Returns all non-deleted subtasks for a card, ordered by `position` then `createdAt`.

**Response 200**

```json
{
  "subtasks": [
    {
      "id": 1,
      "cardId": "uuid",
      "title": "string",
      "completedAt": "ISO8601 | null",
      "position": 0,
      "createdAt": "ISO8601"
    }
  ]
}
```

### POST /api/cards/{id}/subtasks

| Field      | Type           | Required | Notes       |
| ---------- | -------------- | -------- | ----------- |
| `title`    | string (1–200) | yes      |             |
| `position` | integer ≥ 0    | no       | Default `0` |

**Response 201** — single `subtask` object (same shape as above).

### PATCH /api/cards/{id}/subtasks/{subtaskId}

| Field       | Type    | Notes                                           |
| ----------- | ------- | ----------------------------------------------- |
| `completed` | boolean | `true` sets `completedAt = now`, `false` clears |
| `title`     | string  |                                                 |

**Response 200** — updated `subtask` object.

### DELETE /api/cards/{id}/subtasks/{subtaskId}

Soft-deletes (sets `deleted_at`). The subtask disappears from GET responses.

**Response 200** `{ "success": true }`

---

## Status codes

| Status | Meaning                                               |
| ------ | ----------------------------------------------------- |
| 200    | Success                                               |
| 201    | Created                                               |
| 400    | Validation error                                      |
| 401    | Unauthenticated                                       |
| 403    | Insufficient permission (e.g. dueDate by non-creator) |
| 404    | Card / subtask not found or not a board member        |
| 500    | Server error                                          |

## curl

```bash
# Create a card
curl -X POST https://kanban.aviam.ag/api/cards \
  -H "Authorization: Bearer $AVIAM_KANBAN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"boardId":"<uuid>","columnId":1,"title":"Fix bug","priority":"high"}'

# Move cards (bulk-update)
curl -X POST https://kanban.aviam.ag/api/cards/bulk-update \
  -H "Authorization: Bearer $AVIAM_KANBAN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"updates":[{"id":"<uuid>","columnId":3,"position":1}]}'
```

## fetch

```ts
const BASE = "https://kanban.aviam.ag";
const headers = {
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
};

// Create card
const { card } = await fetch(`${BASE}/api/cards`, {
  method: "POST",
  headers,
  body: JSON.stringify({ boardId, columnId: 1, title: "Fix bug" }),
}).then((r) => r.json());

// Patch card
await fetch(`${BASE}/api/cards/${card.id}`, {
  method: "PATCH",
  headers,
  body: JSON.stringify({ priority: "low", columnId: 2 }),
});

// Add subtask
const { subtask } = await fetch(`${BASE}/api/cards/${card.id}/subtasks`, {
  method: "POST",
  headers,
  body: JSON.stringify({ title: "Write tests" }),
}).then((r) => r.json());

// Complete subtask
await fetch(`${BASE}/api/cards/${card.id}/subtasks/${subtask.id}`, {
  method: "PATCH",
  headers,
  body: JSON.stringify({ completed: true }),
});
```
