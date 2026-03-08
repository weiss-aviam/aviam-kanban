import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@/__tests__/setup";
import { t } from "@/lib/i18n";
import { useAppStore } from "@/store";
import { BoardDetailPage } from "./BoardDetailPage";

vi.mock("../kanban/KanbanBoard", () => ({
  KanbanBoard: () => <div data-testid="kanban-board" />,
}));

vi.mock("../layout/HeaderMenu", () => ({
  HeaderMenu: () => <div data-testid="header-menu" />,
}));

vi.mock("../columns/CreateColumnDialog", () => ({
  CreateColumnDialog: () => null,
}));

vi.mock("./DeleteBoardDialog", () => ({
  DeleteBoardDialog: () => null,
}));

vi.mock("../layout/AppHeader", () => ({
  AppHeader: ({
    title,
    subtitle,
    actions,
  }: {
    title: string;
    subtitle?: ReactNode;
    actions?: ReactNode;
  }) => (
    <div>
      <h1>{title}</h1>
      <div>{subtitle}</div>
      <div>{actions}</div>
    </div>
  ),
}));

vi.mock("../admin/UserManagementModal", () => ({
  UserManagementModal: ({
    open,
    onOpenChange,
    currentUserRole,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    currentUserRole: string;
  }) =>
    open ? (
      <div>
        <div data-testid="members-modal-role">{currentUserRole}</div>
        <button type="button" onClick={() => onOpenChange(false)}>
          Close members modal
        </button>
      </div>
    ) : null,
}));

const BOARD_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

function createBoardResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: BOARD_ID,
    name: "Board Alpha",
    createdAt: "2026-03-05T12:00:00Z",
    ownerId: USER_ID,
    role: "admin",
    columns: [],
    labels: [],
    members: [],
    memberCount: 1,
    isArchived: false,
    ...overrides,
  };
}

function expectMemberCount(count: number) {
  expect(
    screen.getByText((content) =>
      content.includes(t("boardDetail.memberCount", { count })),
    ),
  ).toBeInTheDocument();
}

describe("BoardDetailPage member management access", () => {
  beforeEach(() => {
    useAppStore.getState().reset();
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("lets admins open user management from fetched board detail data even when members are omitted", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        board: createBoardResponse({
          members: undefined,
          role: "admin",
          memberCount: 3,
        }),
      }),
    } as Response);

    render(
      <BoardDetailPage
        boardId={BOARD_ID}
        currentUser={{ id: USER_ID, email: "admin@example.com" }}
      />,
    );

    const manageUsersButton = await screen.findByRole("button", {
      name: t("boardDetail.manageUsers"),
    });

    expectMemberCount(3);

    fireEvent.click(manageUsersButton);

    expect(await screen.findByTestId("members-modal-role")).toHaveTextContent(
      "admin",
    );
  });

  it("hides the board detail user-management entry for lower roles", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        board: createBoardResponse({ role: "viewer", memberCount: 2 }),
      }),
    } as Response);

    render(
      <BoardDetailPage
        boardId={BOARD_ID}
        currentUser={{ id: USER_ID, email: "viewer@example.com" }}
      />,
    );

    await screen.findByText("Board Alpha");

    expect(
      screen.queryByRole("button", { name: t("boardDetail.manageUsers") }),
    ).not.toBeInTheDocument();
  });

  it("refreshes board details when the member-management modal closes", async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          board: createBoardResponse({ role: "owner", memberCount: 1 }),
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          board: createBoardResponse({ role: "owner", memberCount: 2 }),
        }),
      } as Response);

    render(
      <BoardDetailPage
        boardId={BOARD_ID}
        currentUser={{ id: USER_ID, email: "owner@example.com" }}
      />,
    );

    const manageUsersButton = await screen.findByRole("button", {
      name: t("boardDetail.manageUsers"),
    });

    expectMemberCount(1);

    fireEvent.click(manageUsersButton);
    fireEvent.click(
      await screen.findByRole("button", { name: "Close members modal" }),
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    expectMemberCount(2);
  });
});
