import type { BoardMemberRole } from "@/types/database";

export interface AvailableBoardUser {
  id: string;
  email: string;
  name: string;
}

export type AddMemberRole = "admin" | "member" | "viewer";

export type MemberSelectionValidationErrorKey =
  | "admin.validationErrors.noUserSelected"
  | "admin.validationErrors.userAlreadyQueued";

export function createDefaultMemberRole(): AddMemberRole {
  return "viewer";
}

export function canAssignAdminRole(
  role: BoardMemberRole | string | null | undefined,
): boolean {
  return role === "owner";
}

export function getMemberSelectionValidationError(
  selectedUserId: string | null,
  queuedUserIds: string[] = [],
): MemberSelectionValidationErrorKey | null {
  if (!selectedUserId) {
    return "admin.validationErrors.noUserSelected";
  }

  if (queuedUserIds.includes(selectedUserId)) {
    return "admin.validationErrors.userAlreadyQueued";
  }

  return null;
}

export function formatAvailableUserLabel(user: AvailableBoardUser): string {
  return user.name ? `${user.name} (${user.email})` : user.email;
}

export function getAddMemberResultSummary(
  results: PromiseSettledResult<unknown>[],
): {
  successful: number;
  failedMessages: string[];
} {
  return {
    successful: results.filter((result) => result.status === "fulfilled")
      .length,
    failedMessages: results.flatMap((result) => {
      if (result.status !== "rejected") {
        return [];
      }

      return result.reason instanceof Error ? [result.reason.message] : [];
    }),
  };
}
