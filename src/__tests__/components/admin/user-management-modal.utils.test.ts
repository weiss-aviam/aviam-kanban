import { describe, expect, it } from "vitest";
import { t } from "@/lib/i18n";
import {
  DEFAULT_USER_MANAGEMENT_TAB,
  canAccessUserManagement,
  getUserManagementRoleLabelKey,
  nextRefreshTrigger,
  shouldShowRefreshButton,
} from "@/components/admin/user-management-modal.utils";

describe("user-management-modal utils", () => {
  it("defaults to the users tab", () => {
    expect(DEFAULT_USER_MANAGEMENT_TAB).toBe("users");
  });

  it("only grants access to owners and admins", () => {
    expect(canAccessUserManagement("owner")).toBe(true);
    expect(canAccessUserManagement("admin")).toBe(true);
    expect(canAccessUserManagement("member")).toBe(false);
    expect(canAccessUserManagement("viewer")).toBe(false);
    expect(canAccessUserManagement(null)).toBe(false);
  });

  it("maps localized role label keys", () => {
    expect(t(getUserManagementRoleLabelKey("owner"))).toBe(t("roles.owner"));
    expect(t(getUserManagementRoleLabelKey("admin"))).toBe(t("roles.admin"));
  });

  it("shows refresh controls for every tab except invite", () => {
    expect(shouldShowRefreshButton("users")).toBe(true);
    expect(shouldShowRefreshButton("memberships")).toBe(true);
    expect(shouldShowRefreshButton("audit")).toBe(true);
    expect(shouldShowRefreshButton("invite")).toBe(false);
  });

  it("increments the refresh trigger", () => {
    expect(nextRefreshTrigger(0)).toBe(1);
    expect(nextRefreshTrigger(1)).toBe(2);
    expect(nextRefreshTrigger(4)).toBe(5);
  });
});
