# Errors

All errors follow this shape:

```json
{ "error": "human-readable message", "at": "cards[2].title", "details": {} }
```

| Status | Meaning                                                       |
| ------ | ------------------------------------------------------------- |
| 400    | Validation failed; `at` points to the offending field         |
| 401    | Authentication required or token invalid / master flag off    |
| 403    | Authenticated but unauthorized for this resource              |
| 404    | Resource not found (often RLS-filtered)                       |
| 409    | Conflict — e.g. duplicate column title in same board          |
| 429    | Rate limit exceeded; `Retry-After: <seconds>` header included |
| 500    | Server error — inspect `details` for the underlying message   |
