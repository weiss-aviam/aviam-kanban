import { describe, expect, it } from "vitest";
import { render, screen } from "@/__tests__/setup";
import type { BoardPresenceMember } from "@/hooks/useBoardPresence";
import {
  BoardPresenceSummary,
  CardEditorsIndicator,
  getCardEditingMembers,
} from "@/components/boards/board-presence-ui";
import { t } from "@/lib/i18n";

const members: BoardPresenceMember[] = [
  {
    userId: "user-1",
    name: "Ada Lovelace",
    email: "ada@example.com",
    role: "member",
    activity: { type: "viewing-board" },
    connectedAt: "2026-03-07T12:00:00.000Z",
    updatedAt: "2026-03-07T12:00:00.000Z",
    connections: 1,
  },
  {
    userId: "user-2",
    name: "Grace Hopper",
    email: "grace@example.com",
    role: "admin",
    activity: {
      type: "editing-card",
      cardId: "card-123",
      cardTitle: "Ship live presence",
    },
    connectedAt: "2026-03-07T12:01:00.000Z",
    updatedAt: "2026-03-07T12:01:00.000Z",
    connections: 1,
  },
];

describe("board presence UI", () => {
  it("renders a board-scoped live presence summary with editing counts", () => {
    render(
      <BoardPresenceSummary currentUserId="user-2" members={members} />,
    );

    expect(
      screen.getByRole("status", { name: t("boardDetail.livePresenceLabel") }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(t("boardDetail.onlineCount", { count: 2 })),
    ).toBeInTheDocument();
    expect(
      screen.getByText(t("boardDetail.editingCount", { count: 1 })),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(
        `${t("boardDetail.you")}: ${t("boardDetail.editingCardActivity", { title: "Ship live presence" })}`,
      ),
    ).toBeInTheDocument();
  });

  it("shows when a specific card is actively being edited", () => {
    render(
      <CardEditorsIndicator
        currentUserId="user-2"
        members={getCardEditingMembers(members, "card-123")}
      />,
    );

    expect(screen.getByText(t("boardDetail.editingThisCard"))).toBeInTheDocument();
    expect(
      screen.getByRole("status", {
        name: `${t("boardDetail.you")}: ${t("boardDetail.editingCardActivity", { title: "Ship live presence" })}`,
      }),
    ).toBeInTheDocument();
  });

  it("filters editing members to the matching board card only", () => {
    expect(getCardEditingMembers(members, "card-123")).toHaveLength(1);
    expect(getCardEditingMembers(members, "other-card")).toEqual([]);
  });
});