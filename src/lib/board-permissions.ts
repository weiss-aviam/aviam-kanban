import type { BoardMemberRole } from "@/types/database";

type DueDateInput = Date | string | null | undefined;

/**
 * Role hierarchy weights — higher value = more privileges.
 */
const ROLE_WEIGHT = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
};

/**
 * Returns true when the given role can view the board.
 * All valid roles (owner, admin, member, viewer) grant view access.
 * A null/undefined role means the user is not a member.
 */
export function canViewBoard(
  role: BoardMemberRole | string | null | undefined,
): boolean {
  if (!role) return false;
  return Object.prototype.hasOwnProperty.call(ROLE_WEIGHT, role);
}

/**
 * Returns true when the given role can mutate board data
 * (create/update/delete cards and columns).
 * Viewers are read-only and cannot edit.
 */
export function canEditBoard(
  role: BoardMemberRole | string | null | undefined,
): boolean {
  if (!role) return false;
  return (ROLE_WEIGHT[role as BoardMemberRole] ?? 0) >= ROLE_WEIGHT.member;
}

/**
 * Returns true when the given role can manage board members
 * (invite, remove, change roles).  Only owners and admins qualify.
 */
export function canManageBoardMembers(
  role: BoardMemberRole | string | null | undefined,
): boolean {
  if (!role) return false;
  return (ROLE_WEIGHT[role as BoardMemberRole] ?? 0) >= ROLE_WEIGHT.admin;
}

// ---------------------------------------------------------------------------
// Deadline helpers
// ---------------------------------------------------------------------------

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const DEADLINE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function parseDueDate(dueDate: DueDateInput): Date | null {
  if (!dueDate) return null;

  const parsed = dueDate instanceof Date ? dueDate : new Date(dueDate);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Formats a due date for compact card display.
 */
export function formatDueDate(dueDate: DueDateInput): string {
  const parsed = parseDueDate(dueDate);
  if (!parsed) return "";

  return DEADLINE_FORMATTER.format(parsed);
}

/**
 * Returns true when the given due date is strictly in the past.
 */
export function isOverdue(dueDate: DueDateInput): boolean {
  const parsed = parseDueDate(dueDate);
  if (!parsed) return false;

  return parsed.getTime() < Date.now();
}

/**
 * Returns true when the due date is in the future but within the next 24 hours.
 */
export function isDueSoon(dueDate: DueDateInput): boolean {
  const parsed = parseDueDate(dueDate);
  if (!parsed) return false;

  const due = parsed.getTime();
  const now = Date.now();
  return due > now && due <= now + ONE_DAY_MS;
}

// ---------------------------------------------------------------------------
// Assigned-to-me predicate
// ---------------------------------------------------------------------------

/**
 * Returns true when the card is assigned to the given user.
 */
export function isAssignedToUser(
  card: { assigneeId?: string | null },
  userId: string | null | undefined,
): boolean {
  if (!userId) return false;
  return card.assigneeId === userId;
}
