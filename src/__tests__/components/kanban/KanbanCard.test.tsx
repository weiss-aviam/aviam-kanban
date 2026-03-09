import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/__tests__/setup";
import { KanbanCard } from "@/components/kanban/KanbanCard";
import { t } from "@/lib/i18n";
import type { BoardWithDetails, User } from "@/types/database";

vi.mock("@dnd-kit/sortable", () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
}));

vi.mock("@/hooks/useCardActionsWithStore", () => ({
  useCardActionsWithStore: () => ({
    handlePriorityChange: vi.fn(),
    handleMoveToColumn: vi.fn(),
    handleDuplicateCard: vi.fn(),
    handleArchiveCard: vi.fn(),
    handleDeleteCard: vi.fn(),
  }),
}));

vi.mock("@/components/kanban/CardContextMenu", () => ({
  AutoCardContextMenu: ({ children }: { children: ReactNode }) => children,
}));

type TestCard = BoardWithDetails["columns"][number]["cards"][number];

const createCard = (overrides: Partial<TestCard> = {}): TestCard => ({
  id: "11111111-1111-4111-8111-111111111111",
  boardId: "22222222-2222-4222-8222-222222222222",
  columnId: 1,
  title: "Investigate assignee bug",
  description: null,
  position: 1,
  dueDate: null,
  priority: "medium",
  createdAt: new Date("2026-03-05T12:00:00Z"),
  assigneeId: null,
  labels: [],
  comments: [],
  ...overrides,
});

const createUser = (overrides: Partial<User> = {}): User => ({
  id: "33333333-3333-4333-8333-333333333333",
  email: "ada@example.com",
  name: "Ada Lovelace",
  avatarUrl: null,
  createdAt: new Date("2026-03-05T12:00:00Z"),
  ...overrides,
});

describe("KanbanCard assignee display", () => {
  it("renders the assignee from the board payload when board members are missing", () => {
    const assignee = createUser();

    render(
      <KanbanCard
        card={createCard({ assigneeId: assignee.id, assignee })}
        boardMembers={[]}
        currentUser={null}
      />,
    );

    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(
      screen.queryByText(t("editCard.noAssignee")),
    ).not.toBeInTheDocument();
  });

  it("falls back to matching board members when the card payload has no assignee object", () => {
    const assignee = createUser({ id: "44444444-4444-4444-8444-444444444444" });

    render(
      <KanbanCard
        card={createCard({ assigneeId: assignee.id })}
        boardMembers={[assignee]}
        currentUser={null}
      />,
    );

    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
  });

  it("renders the unassigned state when no assignee data exists", () => {
    render(
      <KanbanCard card={createCard()} boardMembers={[]} currentUser={null} />,
    );

    expect(screen.getByText(t("editCard.noAssignee"))).toBeInTheDocument();
  });
});
