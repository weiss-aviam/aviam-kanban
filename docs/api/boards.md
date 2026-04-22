# Boards

Source: `src/app/api/boards/route.ts`, `src/app/api/boards/[id]/route.ts`

## GET /api/boards

Returns all boards where the authenticated user is a member.

**Response 200**

```json
{
  "boards": [
    {
      "id": "uuid",
      "name": "string",
      "description": "string | null",
      "isArchived": false,
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601",
      "ownerId": "uuid",
      "role": "owner | admin | member | viewer",
      "memberCount": 3,
      "taskCount": 12
    }
  ]
}
```

## GET /api/boards/{id}

Returns a single board with its columns, cards, and member list.

**Path param:** `id` — UUID

**Response 200**

```json
{
  "board": {
    "id": "uuid",
    "name": "string",
    "description": "string | null",
    "isArchived": false,
    "createdAt": "ISO8601",
    "updatedAt": "ISO8601",
    "ownerId": "uuid",
    "role": "owner | admin | member | viewer",
    "memberCount": 3,
    "columns": [
      {
        "id": 1,
        "title": "string",
        "position": 1,
        "isDone": false,
        "createdAt": "ISO8601",
        "cards": ["…card objects…"]
      }
    ],
    "members": [
      {
        "role": "owner",
        "user": {
          "id": "uuid",
          "email": "string",
          "name": "string | null",
          "avatarUrl": "string | null"
        }
      }
    ]
  }
}
```

## POST /api/boards

Creates a new board. Columns are seeded from the default template (or from `templateId`).

**Request body**

| Field        | Type   | Required | Notes                                 |
| ------------ | ------ | -------- | ------------------------------------- |
| `name`       | string | yes      | Non-empty, trimmed                    |
| `templateId` | uuid   | no       | ID of a `column_templates` row to use |

**Response 201**

```json
{
  "board": {
    "id": "uuid",
    "name": "string",
    "description": null,
    "isArchived": false,
    "createdAt": "ISO8601",
    "updatedAt": "ISO8601",
    "ownerId": "uuid",
    "role": "owner"
  }
}
```

## PUT /api/boards/{id}

Updates board metadata. Requires `owner` or `admin` role.

**Request body** (all fields optional; send only what you want to change)

| Field           | Type           | Notes                                      |
| --------------- | -------------- | ------------------------------------------ |
| `name`          | string         | Non-empty, trimmed                         |
| `isArchived`    | boolean        |                                            |
| `description`   | string \| null |                                            |
| `groupId`       | uuid \| null   | Assign/remove the board from a board group |
| `groupPosition` | number         | Integer display order within the group     |

**Response 200** — same shape as POST 201 response, plus `groupId` and `groupPosition` fields.

## DELETE /api/boards/{id}

Permanently deletes the board (cascades to columns, cards, etc.). Requires `owner` role.

**Response 200**

```json
{ "message": "Board deleted successfully" }
```

## Status codes

| Status | Meaning                                       |
| ------ | --------------------------------------------- |
| 200    | Success (GET / PUT / DELETE)                  |
| 201    | Board created (POST)                          |
| 400    | Validation error (bad UUID, empty name, etc.) |
| 401    | Unauthenticated                               |
| 403    | Insufficient role                             |
| 404    | Board not found / not a member                |
| 500    | Server error                                  |

## curl

```bash
# List boards
curl -H "Authorization: Bearer $AVIAM_KANBAN_TOKEN" \
     https://kanban.aviam.ag/api/boards

# Create a board
curl -X POST https://kanban.aviam.ag/api/boards \
  -H "Authorization: Bearer $AVIAM_KANBAN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"My New Board"}'
```

## fetch

```ts
const BASE = "https://kanban.aviam.ag";
const headers = { Authorization: `Bearer ${token}` };

// List
const { boards } = await fetch(`${BASE}/api/boards`, { headers }).then((r) =>
  r.json(),
);

// Create
const { board } = await fetch(`${BASE}/api/boards`, {
  method: "POST",
  headers: { ...headers, "Content-Type": "application/json" },
  body: JSON.stringify({ name: "My New Board" }),
}).then((r) => r.json());

// Update
await fetch(`${BASE}/api/boards/${board.id}`, {
  method: "PUT",
  headers: { ...headers, "Content-Type": "application/json" },
  body: JSON.stringify({ isArchived: true }),
});

// Delete
await fetch(`${BASE}/api/boards/${board.id}`, { method: "DELETE", headers });
```
