# Authentication

## Personal Access Tokens

Tokens authenticate Claude Code (and similar agents) against the Aviam
Kanban API.

### Prerequisite: API access must be enabled by a super admin

Each user account carries a server-side flag, `api_access_enabled`. It
defaults to `false`. Until a super admin flips it to `true` via
`/dashboard/super-admin/users` (active tab → "API-Zugang aktivieren"),
the user cannot:

- mint a new token (`POST /api/api-tokens` returns **403**), and
- use any existing token (bearer auth at the route layer returns **401**).

The status is visible to the user at `/profile/api-access` as a read-only
badge — there is no self-service toggle. If a user needs access, they must
ask a super admin.

### Minting a token

Once a super admin has enabled access, the user mints tokens at
`/profile/api-access`. Format: `avk_<32 chars>` (36 chars total). The
plaintext is shown **once**; copy it immediately.

### Header

```
Authorization: Bearer avk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

### curl example

```bash
curl -H "Authorization: Bearer $AVIAM_KANBAN_TOKEN" \
     https://kanban.aviam.ag/api/boards
```

### Revocation

Two paths, both effective immediately:

- **User**: `DELETE /api/api-tokens/{id}` (web UI button on
  `/profile/api-access`). Soft-revokes a single token by setting
  `revoked_at`.
- **Super admin**: flip `api_access_enabled` off in the super-admin user
  list. Existing tokens stay in the database but stop authenticating —
  flipping the flag back on reactivates them without re-issuing.

### Failure modes

| Status | Cause                                                      |
| ------ | ---------------------------------------------------------- |
| 401    | Missing/invalid token, or `api_access_enabled` is false    |
| 403    | Token valid but the user lacks permission for the resource |
| 403    | `POST /api/api-tokens` while `api_access_enabled` is false |
| 429    | Rate limit (60 req/min per token) — see `Retry-After`      |
