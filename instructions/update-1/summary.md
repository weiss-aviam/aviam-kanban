# Update 1 Summary

## Source

- Instruction file: `instructions/update-1/instructions.yaml`
- Goal: implement incremental Kanban board enhancements without re-architecting the app

## Delivered scope

### Board collaboration and permissions

- Added shared board permission helpers in `src/lib/board-permissions.ts`
- Added shared board access authorization helpers in `src/lib/board-access.ts`
- Added board member management from the board detail page via `UserManagementModal`
- Added a post-create invite flow in `CreateBoardDialog`
- Aligned invite defaults to `viewer`
- Enforced viewer read-only behavior in both UI and mutation API routes
- Added member removal in the memberships admin API/UI with audit logging safeguards

### Board and card UX improvements

- Added an "Assigned to me" filter in `BoardFilters`
- Added due date editing in `EditCardDialog`
- Updated board column sizing so 1–4 columns fill width evenly and 5+ columns keep a 300px minimum with horizontal scroll
- Separated drag behavior from click/open behavior using a dedicated drag handle in `KanbanCard`
- Kept double-click-to-edit card behavior
- Preserved deadline and priority presentation on cards

### Branding and localization

- Added German localization support under `src/lib/i18n.ts` and `src/lib/locales/`
- Applied Aviam branding and Barlow font updates
- Preserved header/logo branding assets already introduced during update-1

### Testing and tooling stabilization

- Replaced the unstable `UserManagementModal.test.tsx` path with a helper-based test file
- Added focused coverage for:
  - board permission helpers
  - due-date and assigned-user helpers
  - viewer mutation rejection in card/column routes
  - invite form helper logic
  - user-management modal utility logic
- Kept repo-local filtering for Next's bundled Baseline stale-data warning in lint/build tooling
- Fixed route typing issues so both `tsc` and the Next build worker succeed

## Verification completed

Verified successfully with:

- `pnpm run type-check`
- `pnpm run lint`
- `pnpm run build`
- `pnpm exec vitest run src/__tests__/board-permissions.test.ts src/__tests__/api/board-mutation-routes.test.ts src/__tests__/components/admin/InviteUserForm.test.tsx src/__tests__/components/admin/user-management-modal.utils.test.ts`
- `pnpm exec vitest run src/__tests__/components/kanban/edit-card-dialog.utils.test.ts src/__tests__/api/admin/memberships.test.ts src/__tests__/components/kanban/kanban-layout.utils.test.ts`

Focused regression result:

- original focused regression set passed
- additional due-date/member-removal/layout regressions passed

## Documentation delivered

- Added `docs/kanban-enhancements.md`
- Updated `docs/TESTING.md`
- Updated `SETUP.md`

## Notes

- The implemented role model is `owner` / `admin` / `member` / `viewer`, which is broader than the smallest role set suggested in the original instruction file.
- The current UUID migration/RLS story is anchored in `src/db/schema/index.ts`, `src/db/migrations/05_convert_boards_to_uuid.sql`, and `src/db/migrations/add_user_management_tables.sql`; `schema.sql` and `src/db/migrations/0000_deep_thunderbolts.sql` are legacy/reference artifacts from the earlier integer-id bootstrap shape.
- The board creation route inserts the creator into both `boards.owner_id` and `board_members(role='owner')`, which keeps owner access aligned across the app layer and SQL policies.
- The app also enforces viewer-safe mutation checks at the API layer.
- The Baseline warning mitigation remains repo-local because the warning originates from Next's bundled compiled dependency path.
