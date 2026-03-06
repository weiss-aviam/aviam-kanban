import { describe, expect, it } from "vitest";
import {
  getPriorityBadgeClasses,
  getPriorityBorderColor,
  getPriorityConfig,
  sortCardsByPriority,
} from "@/lib/priority-colors";
import type { Card } from "@/types/database";

type TestCardOverrides = {
  id?: Card["id"];
  title?: Card["title"];
  description?: Card["description"];
  priority?: Card["priority"] | undefined;
  columnId?: Card["columnId"];
  boardId?: Card["boardId"];
  position?: Card["position"];
  createdAt?: Card["createdAt"];
  assigneeId?: Card["assigneeId"];
  dueDate?: Card["dueDate"];
};

function createCard(overrides: TestCardOverrides = {}): Card {
  return {
    id: "card-1",
    title: "Test card",
    description: null,
    priority: "medium",
    columnId: 1,
    boardId: "board-1",
    position: 1,
    createdAt: new Date("2026-03-05T12:00:00Z"),
    assigneeId: null,
    dueDate: null,
    ...overrides,
  } as Card;
}

describe("priority-colors", () => {
  it("maps each priority to the expected badge classes", () => {
    expect(getPriorityBadgeClasses("high")).toContain("red");
    expect(getPriorityBadgeClasses("medium")).toContain("amber");
    expect(getPriorityBadgeClasses("low")).toContain("emerald");
  });

  it("returns the expected high priority configuration and border colors", () => {
    expect(getPriorityConfig("high")).toMatchObject({
      label: "HIGH",
      color: "#dc2626",
      borderColor: "#dc2626",
    });

    expect(getPriorityBorderColor("medium")).toBe("#d97706");
    expect(getPriorityBorderColor("low")).toBe("#059669");
  });

  it("sorts cards from high to low priority without mutating the source array", () => {
    const cards = [
      createCard({ id: "low", priority: "low" }),
      createCard({ id: "default", priority: undefined }),
      createCard({ id: "high", priority: "high" }),
    ];

    const sorted = sortCardsByPriority(cards);

    expect(sorted.map((card) => card.id)).toEqual(["high", "default", "low"]);
    expect(cards.map((card) => card.id)).toEqual(["low", "default", "high"]);
  });
});
