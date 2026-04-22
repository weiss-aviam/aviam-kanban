# Board Groups

Source: `src/app/api/board-groups/route.ts`, `src/app/api/board-groups/[id]/route.ts`

Board groups are named containers used to visually cluster boards on the
dashboard. The URL is `/api/board-groups` (not `/api/groups`). Only the
creator of a group can update or delete it (RLS-enforced).

## GET /api/board-groups

Returns all board groups visible to the authenticated user, ordered by
`position` then `createdAt`.

**Response 200**

```json
{
  "groups": [
    {
      "id": "uuid",
      "name": "string",
      "color": "#aabbcc | null",
      "createdBy": "uuid | null",
      "position": 0,
      "createdAt": "ISO8601"
    }
  ]
}
```

## POST /api/board-groups

Creates a new board group.

**Request body**

| Field   | Type              | Required | Notes                              |
| ------- | ----------------- | -------- | ---------------------------------- |
| `name`  | string (1–120)    | yes      |                                    |
| `color` | `#rrggbb` \| null | no       | Must be a 6-digit hex color string |

**Response 200** — single `group` object (same shape as above).

## PUT /api/board-groups/{id}

Renames, recolors, or repositions a group. At least one field must be present.
Only the creator may call this endpoint.

**Request body** (all fields optional)

| Field      | Type              | Notes                          |
| ---------- | ----------------- | ------------------------------ |
| `name`     | string (1–120)    |                                |
| `color`    | `#rrggbb` \| null | `null` removes the color       |
| `position` | integer           | Display order on the dashboard |

**Response 200** — updated `group` object.

## DELETE /api/board-groups/{id}

Deletes the group. Boards that belong to the group retain their data; their
`group_id` is set to `null` via FK cascade rule. Only the creator may call
this endpoint.

**Response 200** `{ "message": "Board group deleted" }`

## Status codes

| Status | Meaning                                       |
| ------ | --------------------------------------------- |
| 200    | Success                                       |
| 400    | Validation error (bad UUID, empty name, etc.) |
| 401    | Unauthenticated                               |
| 404    | Group not found or caller is not the creator  |
| 500    | Server error                                  |

## curl

```bash
# List groups
curl -H "Authorization: Bearer $AVIAM_KANBAN_TOKEN" \
     https://kanban.aviam.ag/api/board-groups

# Create a group
curl -X POST https://kanban.aviam.ag/api/board-groups \
  -H "Authorization: Bearer $AVIAM_KANBAN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Q3 Projects","color":"#3b82f6"}'
```

## fetch

```ts
const BASE = "https://kanban.aviam.ag";
const headers = {
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
};

// List
const { groups } = await fetch(`${BASE}/api/board-groups`, {
  headers: { Authorization: `Bearer ${token}` },
}).then((r) => r.json());

// Create
const { group } = await fetch(`${BASE}/api/board-groups`, {
  method: "POST",
  headers,
  body: JSON.stringify({ name: "Q3 Projects", color: "#3b82f6" }),
}).then((r) => r.json());

// Update
await fetch(`${BASE}/api/board-groups/${group.id}`, {
  method: "PUT",
  headers,
  body: JSON.stringify({ color: "#ef4444" }),
});

// Delete
await fetch(`${BASE}/api/board-groups/${group.id}`, {
  method: "DELETE",
  headers: { Authorization: `Bearer ${token}` },
});
```
