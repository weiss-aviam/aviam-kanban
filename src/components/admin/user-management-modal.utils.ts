import type { BoardMemberRole } from "@/types/database";
import { canManageBoardMembers } from "@/lib/board-permissions";

export type UserManagementTab = "users" | "invite" | "memberships" | "audit";

export const DEFAULT_USER_MANAGEMENT_TAB: UserManagementTab = "users";

export function canAccessUserManagement(
  role: BoardMemberRole | string | null | undefined,
): role is "owner" | "admin" {
  return canManageBoardMembers(role);
}

export function getUserManagementRoleLabelKey(
  role: "owner" | "admin",
): "roles.owner" | "roles.admin" {
  return role === "owner" ? "roles.owner" : "roles.admin";
}

export function shouldShowRefreshButton(tab: UserManagementTab): boolean {
  return tab !== "invite";
}

export function nextRefreshTrigger(current: number): number {
  return current + 1;
}
