import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@/__tests__/setup";
import { UserManagementModal } from "@/components/admin/UserManagementModal";
import { t } from "@/lib/i18n";

vi.mock("@/components/admin/UserList", () => ({
  UserList: () => <div data-testid="user-list" />,
}));

vi.mock("@/components/admin/InviteUserForm", () => ({
  InviteUserForm: () => <div data-testid="invite-user-form" />,
}));

vi.mock("@/components/admin/MembershipTable", () => ({
  MembershipTable: () => <div data-testid="membership-table" />,
}));

vi.mock("@/components/admin/AuditLogTable", () => ({
  AuditLogTable: () => <div data-testid="audit-log-table" />,
}));

function renderModal() {
  const boardName = "Roadmap Board";

  render(
    <UserManagementModal
      open
      onOpenChange={vi.fn()}
      boardId="board-123"
      boardName={boardName}
      currentUserRole="owner"
    />,
  );

  return {
    title: t("admin.userManagementTitle", { boardName }),
  };
}

describe("UserManagementModal", () => {
  it("renders the open dialog with the default users tab content", () => {
    const { title } = renderModal();

    expect(screen.getByText(title)).toBeVisible();
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(screen.getByRole("tab", { name: t("admin.tabs.users") })).toHaveAttribute(
      "data-state",
      "active",
    );
    expect(screen.getByText(t("admin.boardUsers"))).toBeVisible();
    expect(screen.getByTestId("user-list")).toBeInTheDocument();
  });

  it("keeps the full management tab set available", () => {
    renderModal();

    const tablist = screen.getByRole("tablist");
    const tabs = within(tablist).getAllByRole("tab");

    expect(tabs).toHaveLength(4);
    expect(tablist).toHaveClass("grid-cols-2", "sm:grid-cols-4");
    expect(tabs.map((tab) => tab.textContent?.trim())).toEqual([
      t("admin.tabs.users"),
      t("admin.tabs.members"),
      t("admin.tabs.memberships"),
      t("admin.tabs.auditLog"),
    ]);
  });

  it("uses the large modal sizing contract without matching the edit-card dialog width", () => {
    renderModal();

    const dialog = screen.getByRole("dialog");

    expect(dialog).toHaveClass(
      "w-[95vw]",
      "max-w-[95vw]",
      "sm:max-w-6xl",
      "max-h-[90vh]",
      "overflow-hidden",
    );
    expect(dialog).not.toHaveClass("sm:max-w-7xl");
  });
});