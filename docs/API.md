# API Documentation

This document describes the REST API endpoints available in the Aviam Kanban application.

## Authentication

All API endpoints require authentication via Supabase JWT tokens. Include the token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

## Base URL

```
http://localhost:3000/api (development)
https://your-domain.com/api (production)
```

## Boards

### GET /api/boards
Get all boards accessible to the current user.

**Response:**
```json
[
  {
    "id": 1,
    "name": "Project Alpha",
    "ownerId": "user-id",
    "isArchived": false,
    "createdAt": "2024-01-01T00:00:00Z",
    "role": "owner"
  }
]
```

### POST /api/boards
Create a new board.

**Request Body:**
```json
{
  "name": "New Board Name"
}
```

**Response:**
```json
{
  "id": 2,
  "name": "New Board Name",
  "ownerId": "user-id",
  "isArchived": false,
  "createdAt": "2024-01-01T00:00:00Z"
}
```

### GET /api/boards/:id
Get detailed board information including columns, cards, and members.

**Response:**
```json
{
  "id": 1,
  "name": "Project Alpha",
  "ownerId": "user-id",
  "isArchived": false,
  "createdAt": "2024-01-01T00:00:00Z",
  "owner": {
    "id": "user-id",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "members": [
    {
      "boardId": 1,
      "userId": "user-id",
      "role": "owner",
      "user": {
        "id": "user-id",
        "email": "user@example.com",
        "name": "John Doe"
      }
    }
  ],
  "columns": [
    {
      "id": 1,
      "boardId": 1,
      "title": "To Do",
      "position": 1,
      "cards": [
        {
          "id": 1,
          "boardId": 1,
          "columnId": 1,
          "title": "Task 1",
          "description": "Task description",
          "assigneeId": "user-id",
          "dueDate": "2024-01-15T00:00:00Z",
          "position": 1,
          "createdAt": "2024-01-01T00:00:00Z",
          "assignee": {
            "id": "user-id",
            "email": "user@example.com",
            "name": "John Doe"
          },
          "labels": [
            {
              "id": 1,
              "name": "Bug",
              "color": "#ef4444"
            }
          ]
        }
      ]
    }
  ],
  "labels": [
    {
      "id": 1,
      "boardId": 1,
      "name": "Bug",
      "color": "#ef4444"
    }
  ]
}
```

## Columns

### POST /api/columns
Create a new column.

**Request Body:**
```json
{
  "boardId": 1,
  "title": "In Progress",
  "position": 2
}
```

### PATCH /api/columns/:id
Update a column.

**Request Body:**
```json
{
  "title": "Updated Title",
  "position": 3
}
```

### DELETE /api/columns/:id
Delete a column (requires admin permissions).

## Cards

### POST /api/cards
Create a new card.

**Request Body:**
```json
{
  "boardId": 1,
  "columnId": 1,
  "title": "New Task",
  "description": "Task description",
  "assigneeId": "user-id",
  "dueDate": "2024-01-15T00:00:00Z",
  "position": 1
}
```

### PATCH /api/cards/:id
Update a card.

**Request Body:**
```json
{
  "title": "Updated Task",
  "description": "Updated description",
  "columnId": 2,
  "assigneeId": "user-id",
  "dueDate": "2024-01-20T00:00:00Z",
  "position": 2
}
```

### DELETE /api/cards/:id
Delete a card.

### PATCH /api/cards/bulk-reorder
Bulk update card positions (for drag and drop).

**Request Body:**
```json
{
  "updates": [
    {
      "id": 1,
      "columnId": 2,
      "position": 1
    },
    {
      "id": 2,
      "columnId": 1,
      "position": 1
    }
  ]
}
```

## Labels

### GET /api/labels?boardId=:boardId
Get all labels for a board.

### POST /api/labels
Create a new label.

**Request Body:**
```json
{
  "boardId": 1,
  "name": "Feature",
  "color": "#3b82f6"
}
```

## Comments

### GET /api/comments?cardId=:cardId
Get all comments for a card.

### POST /api/comments
Create a new comment.

**Request Body:**
```json
{
  "cardId": 1,
  "body": "This is a comment"
}
```

## Authentication

### POST /api/auth/sync-profile
Sync user profile from Supabase Auth to the application database.

## Error Responses

All endpoints return consistent error responses:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

### Common HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `422` - Validation Error
- `500` - Internal Server Error

## Rate Limiting

API endpoints are rate-limited to prevent abuse:
- 100 requests per minute per user for read operations
- 30 requests per minute per user for write operations

## Pagination

List endpoints support pagination via query parameters:
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20, max: 100)

Example:
```
GET /api/boards?page=2&limit=10
```

## Filtering

Some endpoints support filtering via query parameters:
- `assignee` - Filter by assignee ID
- `labels` - Filter by label IDs (comma-separated)
- `dueDate` - Filter by due date status (overdue, today, week, none)

Example:
```
GET /api/cards?assignee=user-id&labels=1,2&dueDate=overdue
```
