# Kanban Enhancements

This document describes the `update-1` enhancements that were implemented and verified in this repository.

## Data model changes

- `boards.owner_id`
  - stored in `src/db/schema/index.ts`
  - identifies the owning user for each board
- `board_members`
  - composite membership table keyed by `board_id` + `user_id`
  - stores the board role for each member
  - current repo roles are `owner`, `admin`, `member`, and `viewer`
- `cards.due_date`
  - used for deadline display and due/overdue helpers
- `cards.priority`
  - supports `high`, `medium`, and `low`
  - shown in the UI through left-border emphasis and a badge
- `user_invitations`
  - supports board invite flow by email with a persisted role and token
- `admin_audit_log`
  - stores admin/member-management activity for audit visibility

Relevant files:

- `src/db/schema/index.ts`
- `src/db/migrations/05_convert_boards_to_uuid.sql`
- `src/db/migrations/add_user_management_tables.sql`
- `schema.sql`

## Access control and RLS summary

The instruction asked for Supabase RLS-backed board access control. The current repository contains SQL/RLS artifacts in three places:

- `src/db/migrations/05_convert_boards_to_uuid.sql`
  - converts the earlier integer-id board schema to UUIDs
  - defines the core board/member/card/label RLS policies used by the UUID migration path
- `schema.sql`
  - preserves the original integer-id bootstrap/reference schema and policy set
- `src/db/migrations/add_user_management_tables.sql`
  - adds `user_invitations` and `admin_audit_log`
  - includes policies limiting invitation and audit-log access to board owners/admins

Schema alignment notes:

- `src/db/schema/index.ts` is the current application-side schema reference.
- `src/app/api/boards/route.ts` creates a board with both `boards.owner_id` and a matching `board_members` row with role `owner`, so owner access matches the app permission helpers and the SQL policy assumptions.
- `src/db/migrations/0000_deep_thunderbolts.sql` and `schema.sql` reflect the earlier integer-id bootstrap story and should be treated as legacy/reference artifacts rather than the current UUID deployment target.
- Because the original update-1 note allowed skipping risky RLS expansion for this intranet app, this pass aligns the documentation to the existing UUID migration/RLS artifacts instead of introducing another live-policy migration.

In addition to SQL policy artifacts, the application now enforces board write access in the API layer:

- `src/lib/board-access.ts`
- card mutation routes under `src/app/api/cards/*`
- column mutation routes under `src/app/api/columns/*`

This means viewers are blocked from card/column mutations even when interacting directly with the HTTP routes, not only through the UI.

## Roles and permissions

The implemented role model is slightly broader than the minimum originally suggested in the instruction file.

- `owner`
  - full board control
  - can manage members and board settings
- `admin`
  - can manage members and invitations
  - can edit cards and columns
- `member`
  - can edit cards and columns
  - cannot manage members
- `viewer`
  - read-only
  - cannot mutate cards or columns
  - does not get drag-and-drop or member-management controls

Permission helpers live in `src/lib/board-permissions.ts`.

## Invite and manage members flow

Two entry points are implemented:

1. **After board creation**
   - `src/components/boards/CreateBoardDialog.tsx`
   - after a board is created, a follow-up invite dialog opens
   - the prompt is skippable via “Skip for now”

2. **Board-level member management**
   - `src/components/boards/BoardDetailPage.tsx`
   - opens `src/components/admin/UserManagementModal.tsx`

The management modal currently provides four tabs:

- `users`
- `invite`
- `memberships`
- `audit`

Supporting components/hooks:

- `src/components/admin/InviteUserForm.tsx`
- `src/components/admin/UserList.tsx`
- `src/components/admin/MembershipTable.tsx`
- `src/hooks/useBoardMemberships.ts`

Important behavior:

- invite role defaults to `viewer`
- only privileged users can invite admins
- owners/admins can manage members
- members/viewers do not get the management modal

## Click vs drag behavior on cards

Card interaction was adjusted so drag-and-drop does not interfere with opening a card.

- implementation file: `src/components/kanban/KanbanCard.tsx`
- `useSortable(...)` is disabled for viewers
- drag listeners are attached only to the `GripVertical` handle
- normal card click triggers the detail/open callback
- double-click triggers edit
- click/double-click handlers bail out while a drag is active

This keeps card opening and reordering separate and avoids accidental modal opens during drag operations.

## Additional board UX covered by update-1

- assigned-to-me filter in `src/components/kanban/BoardFilters.tsx`
- due date editing in `src/components/kanban/EditCardDialog.tsx`
- due date formatting / overdue / due-soon helpers in `src/lib/board-permissions.ts`
- board member removal in `src/components/admin/MembershipTable.tsx` and `src/app/api/admin/memberships/route.ts`
- board columns now fill evenly for 1–4 columns and preserve a 300px minimum width with horizontal scroll for wider boards
- priority emphasis in `src/components/kanban/KanbanCard.tsx`
- branded layout/font work documented in `instructions/update-1/summary.md`

## Verification and tests

Verified during the update-1 closure pass:

- `pnpm run type-check`
- `pnpm run lint`
- `pnpm run build`

Focused regression suite:

- `src/__tests__/board-permissions.test.ts`
- `src/__tests__/api/board-mutation-routes.test.ts`
- `src/__tests__/api/admin/memberships.test.ts`
- `src/__tests__/components/admin/InviteUserForm.test.tsx`
- `src/__tests__/components/kanban/edit-card-dialog.utils.test.ts`
- `src/__tests__/components/kanban/kanban-layout.utils.test.ts`
- `src/__tests__/components/admin/user-management-modal.utils.test.ts`

Result: the focused update-1 regression set covering permissions, invite flow, due-date helpers, member removal, and board layout utilities passes locally.
