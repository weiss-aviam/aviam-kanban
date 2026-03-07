import { describe, expect, it } from "vitest";
import { t } from "@/lib/i18n";
import {
  canAssignAdminRole,
  createDefaultMemberRole,
  formatAvailableUserLabel,
  getAddMemberResultSummary,
  getMemberSelectionValidationError,
} from "@/components/admin/invite-user-form.utils";

describe("InviteUserForm helpers", () => {
  it("returns viewer as the default member role", () => {
    expect(createDefaultMemberRole()).toBe("viewer");
  });

  it("only allows owners to assign the admin role", () => {
    expect(canAssignAdminRole("owner")).toBe(true);
    expect(canAssignAdminRole("admin")).toBe(false);
    expect(canAssignAdminRole("member")).toBe(false);
    expect(canAssignAdminRole("viewer")).toBe(false);
    expect(canAssignAdminRole(null)).toBe(false);
  });

  it("returns the no-user-selected validation key when no user is chosen", () => {
    const errorKey = getMemberSelectionValidationError(null);

    expect(errorKey).toBe("admin.validationErrors.noUserSelected");
    expect(t(errorKey!)).toBe(t("admin.validationErrors.noUserSelected"));
  });

  it("returns the already-queued validation key when the user is already selected", () => {
    expect(
      getMemberSelectionValidationError("user-1", ["user-1", "user-2"]),
    ).toBe("admin.validationErrors.userAlreadyQueued");
  });

  it("accepts a unique selected user", () => {
    expect(
      getMemberSelectionValidationError("user-3", ["user-1", "user-2"]),
    ).toBeNull();
  });

  it("formats available user labels with name and email when present", () => {
    expect(
      formatAvailableUserLabel({
        id: "user-1",
        name: "Ada Lovelace",
        email: "ada@example.com",
      }),
    ).toBe("Ada Lovelace (ada@example.com)");

    expect(
      formatAvailableUserLabel({
        id: "user-2",
        name: "",
        email: "grace@example.com",
      }),
    ).toBe("grace@example.com");
  });

  it("summarizes successful and failed add-member results", () => {
    expect(
      getAddMemberResultSummary([
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
