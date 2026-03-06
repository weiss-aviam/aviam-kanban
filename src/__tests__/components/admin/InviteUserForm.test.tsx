import { describe, expect, it } from "vitest";
import { t } from "@/lib/i18n";
import {
  addInvitationRow,
  canInviteAdmins,
  createEmptyInvitation,
  getInvitationResultSummary,
  getInvitationValidationError,
} from "@/components/admin/invite-user-form.utils";

describe("InviteUserForm helpers", () => {
  it("creates an empty viewer invitation by default", () => {
    expect(createEmptyInvitation()).toEqual({ email: "", role: "viewer" });
  });

  it("adds viewer rows until the invitation limit is reached", () => {
    let invitations = [createEmptyInvitation()];

    for (let index = 0; index < 12; index += 1) {
      invitations = addInvitationRow(invitations);
    }

    expect(invitations).toHaveLength(10);
    expect(invitations.at(-1)).toEqual({ email: "", role: "viewer" });
  });

  it("only allows owners to invite admins", () => {
    expect(canInviteAdmins("owner")).toBe(true);
    expect(canInviteAdmins("admin")).toBe(false);
    expect(canInviteAdmins("member")).toBe(false);
    expect(canInviteAdmins("viewer")).toBe(false);
  });

  it("returns the no-email validation key when all rows are empty", () => {
    const errorKey = getInvitationValidationError([createEmptyInvitation()]);

    expect(errorKey).toBe("admin.validationErrors.noEmail");
    expect(t(errorKey!)).toBe(t("admin.validationErrors.noEmail"));
  });

  it("returns the invalid-email validation key for malformed emails", () => {
    expect(
      getInvitationValidationError([{ email: "not-an-email", role: "viewer" }]),
    ).toBe("admin.validationErrors.invalidEmails");
  });

  it("returns the duplicate-email validation key case-insensitively", () => {
    expect(
      getInvitationValidationError([
        { email: "duplicate@example.com", role: "viewer" },
        { email: "DUPLICATE@example.com", role: "member" },
      ]),
    ).toBe("admin.validationErrors.duplicateEmails");
  });

  it("accepts unique valid invitations", () => {
    expect(
      getInvitationValidationError([
        { email: "viewer@example.com", role: "viewer" },
        { email: "member@example.com", role: "member" },
      ]),
    ).toBeNull();
  });

  it("summarizes successful and failed invitation results", () => {
    expect(
      getInvitationResultSummary([
        { status: "fulfilled", value: { ok: true } },
        { status: "rejected", reason: new Error("first failure") },
        { status: "rejected", reason: new Error("second failure") },
      ]),
    ).toEqual({
      successful: 1,
      failedMessages: ["first failure", "second failure"],
    });
  });
});
