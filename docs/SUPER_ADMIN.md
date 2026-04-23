# Super Admin

Aviam Kanban distinguishes between **board admins** (per-board admins and
owners — see `ADMIN_SYSTEM.md` and `USER_MANAGEMENT.md`) and **super
admins**, who manage user accounts globally across the installation.

This document covers the super-admin surface area only.

## Identity

A user is a super admin when their Supabase auth `app_metadata.super_admin`
is `true` (or `app_metadata.role === 'super_admin'`). The flag lives in
`app_metadata`, never in `user_metadata`, because `app_metadata` is
read-only from the client. The check is implemented in
`src/lib/auth.ts:isSuperAdminUser` and required by `requireSuperAdmin()`
on every super-admin route.

## Surface

- **UI:** `/dashboard/super-admin/users`
- **Component:** `src/components/admin/SuperAdminUserManagement.tsx`
- **API:** `src/app/api/admin/super-admin/users/`
  - `GET, POST /api/admin/super-admin/users`
  - `PATCH, DELETE /api/admin/super-admin/users/{id}`
  - `DELETE /api/admin/super-admin/users/{id}/purge`

Every mutation goes through `logAdminAction()` and is visible in the
admin audit log.

## Tabs and actions

The page presents three tabs, each backed by the user list paginated by
`status`.

### Pending

Users with `status = 'pending'` (registered, awaiting review) and
`status = 'unconfirmed'` (registered, email not yet confirmed).

- **Freigeben** → set `status = 'active'`, lift the auth ban
- **Ablehnen** → set `status = 'deactivated'`, ban in Supabase auth, sign
  out all sessions

### Aktiv

Users with `status = 'active'`.

- **Bearbeiten** → change display name (also propagated to
  `auth.user_metadata.name`)
- **API-Zugang aktivieren / sperren** → toggle `users.api_access_enabled`.
  See _API access_ below for the security model.
- **Deaktivieren** → set `status = 'deactivated'`, ban in Supabase auth
  for ~100 years, sign out all sessions

### Deaktiviert

Users with `status = 'deactivated'`.

- **Reaktivieren** → restore `status = 'active'`, lift the ban
- **Endgültig löschen** (purge) → permanent destruction of the account
  and the boards/columns/cards/attachments owned by the user; foreign
  rows on other users' boards (comments, file references) are kept.
  Requires retyping the user's email to confirm.

## API access

API access for a user is governed by `users.api_access_enabled` (see
migration `33_api_access_enabled.sql`). The default is `false`.

**Effect when `false`:**

- `POST /api/api-tokens` returns **403** (no new tokens can be minted)
- bearer authentication at `src/lib/api-tokens/verify.ts` rejects every
  request with **401**, regardless of whether the token is otherwise
  valid

**Effect when `true`:** the user can mint, list, and revoke their own
tokens at `/profile/api-access` and use them against the bearer-token
API.

Toggling is super-admin-only. Users see a read-only status badge and a
"contact your admin" hint at `/profile/api-access`; there is no
self-service endpoint. The audit log records every flip with the
admin who made the change.

Disabling `api_access_enabled` does **not** revoke individual tokens.
They remain in the `api_tokens` table and resume working the next time
the flag is enabled. To permanently invalidate a token, soft-revoke it
via `DELETE /api/api-tokens/{id}` (the user can do this from
`/profile/api-access` even while access is disabled — UI button stays
available for revocation only).

## Validation schema

`superAdminUpdateUserSchema` in `src/lib/validations/admin.ts` accepts:

```ts
{
  name?: string;                     // 1–100 chars, trimmed
  status?: 'pending' | 'active' | 'deactivated';
  apiAccessEnabled?: boolean;
}
```

At least one field must be provided.
