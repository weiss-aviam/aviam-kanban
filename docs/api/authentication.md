# Authentication

## Personal Access Tokens

Tokens are minted at `/profile/api-access` after enabling the master flag.
Format: `avk_<32 chars>` (36 chars total). The plaintext is shown **once**;
copy it immediately.

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

DELETE `/api/api-tokens/{id}` (web UI button) or toggle the master flag off
in `/profile/api-access` to make all of your tokens inert without deleting
them.

### Failure modes

| Status | Cause                                                      |
| ------ | ---------------------------------------------------------- |
| 401    | Missing/invalid token, or master flag is off               |
| 403    | Token valid but the user lacks permission for the resource |
| 429    | Rate limit (60 req/min per token) — see `Retry-After`      |
