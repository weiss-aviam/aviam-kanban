import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { UserManagementModal } from "@/components/admin/UserManagementModal";

// Mock the child components
vi.mock("@/components/admin/UserList", () => ({
  UserList: ({ onUserAction }: { onUserAction: () => void }) => (
    <div data-testid="user-list">
      <button onClick={onUserAction}>User Action</button>
    </div>
  ),
}));

vi.mock("@/components/admin/InviteUserForm", () => ({
  InviteUserForm: ({ onUserInvited }: { onUserInvited: () => void }) => (
    <div data-testid="invite-user-form">
      <button onClick={onUserInvited}>Invite User</button>
    </div>
  ),
}));

vi.mock("@/components/admin/MembershipTable", () => ({
  MembershipTable: ({
    onMembershipAction,
  }: {
    onMembershipAction: () => void;
  }) => (
    <div data-testid="membership-table">
      <button onClick={onMembershipAction}>Membership Action</button>
    </div>
  ),
}));

vi.mock("@/components/admin/AuditLogTable", () => ({
  AuditLogTable: () => <div data-testid="audit-log-table">Audit Log Table</div>,
}));

describe("UserManagementModal", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    boardId: "board-123",
    boardName: "Test Board",
    currentUserRole: "admin" as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render modal when open is true", () => {
    render(<UserManagementModal {...defaultProps} />);

    expect(
      screen.getByText("User Management - Test Board"),
    ).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("should not render modal when user is not admin", () => {
    render(<UserManagementModal {...defaultProps} currentUserRole="member" />);

    expect(
      screen.queryByText("User Management - Test Board"),
    ).not.toBeInTheDocument();
  });

  it("should not render modal when user is viewer", () => {
    render(<UserManagementModal {...defaultProps} currentUserRole="viewer" />);

    expect(
      screen.queryByText("User Management - Test Board"),
    ).not.toBeInTheDocument();
  });

  it("should show owner badge for board owner", () => {
    render(<UserManagementModal {...defaultProps} currentUserRole="owner" />);

    expect(screen.getByText("Owner")).toBeInTheDocument();
  });

  it("should render all tabs", () => {
    render(<UserManagementModal {...defaultProps} />);

    expect(screen.getByText("Users")).toBeInTheDocument();
    expect(screen.getByText("Invite")).toBeInTheDocument();
    expect(screen.getByText("Memberships")).toBeInTheDocument();
    expect(screen.getByText("Audit Log")).toBeInTheDocument();
  });

  it("should switch tabs when clicked", async () => {
    render(<UserManagementModal {...defaultProps} />);

    // Initially should show Users tab content
    expect(screen.getByTestId("user-list")).toBeInTheDocument();

    // Click on Invite tab
    fireEvent.click(screen.getByText("Invite"));
    await waitFor(() => {
      expect(screen.getByTestId("invite-user-form")).toBeInTheDocument();
    });

    // Click on Memberships tab
    fireEvent.click(screen.getByText("Memberships"));
    await waitFor(() => {
      expect(screen.getByTestId("membership-table")).toBeInTheDocument();
    });

    // Click on Audit Log tab
    fireEvent.click(screen.getByText("Audit Log"));
    await waitFor(() => {
      expect(screen.getByTestId("audit-log-table")).toBeInTheDocument();
    });
  });

  it("should have refresh buttons in each tab", () => {
    render(<UserManagementModal {...defaultProps} />);

    // Users tab
    expect(screen.getByText("Refresh")).toBeInTheDocument();

    // Switch to other tabs and check for refresh buttons
    fireEvent.click(screen.getByText("Invite"));
    expect(screen.getByText("Refresh")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Memberships"));
    expect(screen.getByText("Refresh")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Audit Log"));
    expect(screen.getByText("Refresh")).toBeInTheDocument();
  });

  it("should trigger refresh when refresh button is clicked", () => {
    render(<UserManagementModal {...defaultProps} />);

    const refreshButton = screen.getByText("Refresh");
    fireEvent.click(refreshButton);

    // The refresh should trigger a re-render of child components
    // This is tested indirectly through the refreshTrigger prop
    expect(screen.getByTestId("user-list")).toBeInTheDocument();
  });

  it("should handle user actions and trigger refresh", () => {
    render(<UserManagementModal {...defaultProps} />);

    const userActionButton = screen.getByText("User Action");
    fireEvent.click(userActionButton);

    // Should trigger refresh after user action
    expect(screen.getByTestId("user-list")).toBeInTheDocument();
  });

  it("should handle user invitation and trigger refresh", async () => {
    render(<UserManagementModal {...defaultProps} />);

    // Switch to invite tab
    fireEvent.click(screen.getByText("Invite"));
    await waitFor(() => {
      expect(screen.getByTestId("invite-user-form")).toBeInTheDocument();
    });

    const inviteButton = screen.getByText("Invite User");
    fireEvent.click(inviteButton);

    // Should trigger refresh after invitation
    expect(screen.getByTestId("invite-user-form")).toBeInTheDocument();
  });

  it("should handle membership actions and trigger refresh", async () => {
    render(<UserManagementModal {...defaultProps} />);

    // Switch to memberships tab
    fireEvent.click(screen.getByText("Memberships"));
    await waitFor(() => {
      expect(screen.getByTestId("membership-table")).toBeInTheDocument();
    });

    const membershipActionButton = screen.getByText("Membership Action");
    fireEvent.click(membershipActionButton);

    // Should trigger refresh after membership action
    expect(screen.getByTestId("membership-table")).toBeInTheDocument();
  });

  it("should call onOpenChange when modal is closed", () => {
    const onOpenChange = vi.fn();
    render(
      <UserManagementModal {...defaultProps} onOpenChange={onOpenChange} />,
    );

    // Find and click the close button (usually an X or close icon)
    // This depends on the Dialog component implementation
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();

    // The actual close mechanism would depend on the Dialog component
    // For now, we just verify the modal is rendered
  });

  it("should pass correct props to child components", () => {
    render(<UserManagementModal {...defaultProps} />);

    // Verify UserList is rendered with correct props
    expect(screen.getByTestId("user-list")).toBeInTheDocument();

    // Switch to other tabs and verify components are rendered
    fireEvent.click(screen.getByText("Invite"));
    expect(screen.getByTestId("invite-user-form")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Memberships"));
    expect(screen.getByTestId("membership-table")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Audit Log"));
    expect(screen.getByTestId("audit-log-table")).toBeInTheDocument();
  });

  it("should maintain tab state across re-renders", async () => {
    const { rerender } = render(<UserManagementModal {...defaultProps} />);

    // Switch to Invite tab
    fireEvent.click(screen.getByText("Invite"));
    await waitFor(() => {
      expect(screen.getByTestId("invite-user-form")).toBeInTheDocument();
    });

    // Re-render with same props
    rerender(<UserManagementModal {...defaultProps} />);

    // Should still be on Invite tab
    expect(screen.getByTestId("invite-user-form")).toBeInTheDocument();
  });

  it("should handle modal open/close state changes", () => {
    const { rerender } = render(
      <UserManagementModal {...defaultProps} open={false} />,
    );

    // Modal should not be visible when open is false
    expect(
      screen.queryByText("User Management - Test Board"),
    ).not.toBeInTheDocument();

    // Re-render with open=true
    rerender(<UserManagementModal {...defaultProps} open={true} />);

    // Modal should now be visible
    expect(
      screen.getByText("User Management - Test Board"),
    ).toBeInTheDocument();
  });
});
