# Testing Guide

This repository uses `pnpm` and Vitest for TypeScript/unit testing.

## Stack

- test runner: `vitest`
- DOM/component utilities: React Testing Library
- environment: `jsdom`
- mocking: Vitest built-in mocks plus repo test helpers in `src/__tests__/setup.ts`

## Primary commands

```bash
pnpm test
pnpm run test:watch
pnpm run test:ui
pnpm run test:coverage
pnpm run type-check
pnpm run lint
pnpm run build
```

## Focused update-1 regression suite

Use this when validating the update-1 permission/member-management work:

```bash
pnpm exec vitest run \
  src/__tests__/board-permissions.test.ts \
  src/__tests__/api/board-mutation-routes.test.ts \
  src/__tests__/components/admin/InviteUserForm.test.tsx \
  src/__tests__/components/admin/user-management-modal.utils.test.ts
```

Current verified result for that suite: `27` passing tests.

## What the focused suite covers

- `src/__tests__/board-permissions.test.ts`
  - role predicates
  - due-date formatting
  - overdue / due-soon helpers
  - assigned-to-user helper
- `src/__tests__/api/board-mutation-routes.test.ts`
  - viewer rejection for card/column mutations
  - admin-allowed mutation flow for representative routes
- `src/__tests__/components/admin/InviteUserForm.test.tsx`
  - invite defaults
  - validation behavior
  - role restrictions for admin invites
- `src/__tests__/components/admin/user-management-modal.utils.test.ts`
  - tab defaults
  - access gating
  - refresh helper behavior

## Existing broader test surface

There are also existing admin API tests under `src/__tests__/api/admin/`, including user-management-related route coverage.

## Current test strategy

The repo now prefers small, deterministic tests over large brittle UI integrations.

Preferred order:

1. pure helper/unit test
2. focused route-handler test
3. focused component test
4. broader integration test only when smaller coverage is insufficient

This is why the old unstable `UserManagementModal.test.tsx` path was replaced with `user-management-modal.utils.test.ts`.

## Writing new tests

- keep test scope as small as possible
- mock network/Supabase boundaries explicitly
- prefer helper seams for logic-heavy UI
- for Next route tests, avoid passing explicit `undefined` optional fields when building `NextRequest` init objects
- if you change board permissions, add or update route and helper tests together

## Recommended verification workflow after code changes

For targeted work:

```bash
pnpm exec vitest run path/to/test-file.test.ts
```

For feature completion:

```bash
pnpm run type-check
pnpm run lint
pnpm run build
```

For update-1 closure work, run both the focused regression suite and the repo verification commands above.
