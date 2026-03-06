import type { BoardMemberRole } from "@/types/database";

export interface InvitationData {
  email: string;
  role: "admin" | "member" | "viewer";
}

export type InvitationRole = InvitationData["role"];

export type InvitationValidationErrorKey =
  | "admin.validationErrors.noEmail"
  | "admin.validationErrors.invalidEmails"
  | "admin.validationErrors.duplicateEmails";

const MAX_INVITATIONS = 10;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function createEmptyInvitation(): InvitationData {
  return { email: "", role: "viewer" };
}

export function canInviteAdmins(
  role: BoardMemberRole | string | null | undefined,
): boolean {
  return role === "owner";
}

export function addInvitationRow(
  invitations: InvitationData[],
): InvitationData[] {
  return invitations.length < MAX_INVITATIONS
    ? [...invitations, createEmptyInvitation()]
    : invitations;
}

export function getInvitationValidationError(
  invitations: InvitationData[],
): InvitationValidationErrorKey | null {
  const validInvitations = invitations.filter((invitation) =>
    invitation.email.trim(),
  );

  if (validInvitations.length === 0) {
    return "admin.validationErrors.noEmail";
  }

  const invalidEmails = validInvitations.filter(
    (invitation) => !EMAIL_REGEX.test(invitation.email),
  );
  if (invalidEmails.length > 0) {
    return "admin.validationErrors.invalidEmails";
  }

  const emails = validInvitations.map((invitation) =>
    invitation.email.toLowerCase(),
  );
  const duplicates = emails.filter(
    (email, index) => emails.indexOf(email) !== index,
  );
  if (duplicates.length > 0) {
    return "admin.validationErrors.duplicateEmails";
  }

  return null;
}

export function getInvitationResultSummary(
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
