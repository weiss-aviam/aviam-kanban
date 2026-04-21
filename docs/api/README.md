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

See `errors.md` for the full list.

## Endpoints

- `authentication.md` — token lifecycle, header format
- `changesets.md` — `POST /api/changesets/board` (atomic batch create)
- `boards.md`, `cards.md`, `attachments.md`, `groups.md` — per-resource CRUD
- `errors.md` — error codes
