import { describe, expect, it, vi } from "vitest";

// Restore the real date-fns implementation for this file (setup.ts mocks it globally)
vi.mock("date-fns", async (importOriginal) => {
  return await importOriginal<typeof import("date-fns")>();
});
import {
  getCardsForDay,
  getCardChipClasses,
  type CalendarCard,
} from "@/components/calendar/CalendarView";

function makeCard(overrides: Partial<CalendarCard> = {}): CalendarCard {
  return {
    id: "card-1",
    title: "Test Card",
    dueDate: "2024-04-15T12:00:00Z",
    priority: "medium",
    boardId: "board-1",
    boardName: "My Board",
    columnId: 1,
    columnTitle: "To Do",
    completedAt: null,
    ...overrides,
  };
}

describe("getCardsForDay", () => {
  it("returns cards whose dueDate matches the given day", () => {
    const cards = [
      makeCard({ id: "a", dueDate: "2024-04-15T08:00:00Z" }),
      makeCard({ id: "b", dueDate: "2024-04-15T14:00:00Z" }),
      makeCard({ id: "c", dueDate: "2024-04-16T12:00:00Z" }),
    ];
    const result = getCardsForDay(cards, new Date("2024-04-15T12:00:00"));
    expect(result.map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("returns an empty array when no cards fall on that day", () => {
    const cards = [makeCard({ dueDate: "2024-04-20T10:00:00Z" })];
    expect(getCardsForDay(cards, new Date("2024-04-15T12:00:00"))).toEqual([]);
  });

  it("returns an empty array for an empty input", () => {
    expect(getCardsForDay([], new Date("2024-04-15"))).toEqual([]);
  });
});

describe("getCardChipClasses", () => {
  it("applies line-through for completed cards", () => {
    const card = makeCard({ completedAt: "2024-04-10T10:00:00Z" });
    expect(getCardChipClasses(card)).toContain("line-through");
  });

  it("applies red classes for overdue non-completed cards", () => {
    // A due date in the far past
    const card = makeCard({
      dueDate: "2020-01-01T00:00:00Z",
      completedAt: null,
    });
    const classes = getCardChipClasses(card);
    expect(classes).toContain("red");
  });

  it("applies high-priority red for future high-priority cards", () => {
    const card = makeCard({
      priority: "high",
      dueDate: "2099-12-31T23:59:59Z",
      completedAt: null,
    });
    expect(getCardChipClasses(card)).toContain("red");
  });

  it("applies amber classes for future medium-priority cards", () => {
    const card = makeCard({
      priority: "medium",
      dueDate: "2099-12-31T23:59:59Z",
      completedAt: null,
    });
    expect(getCardChipClasses(card)).toContain("amber");
  });

  it("applies green classes for future low-priority cards", () => {
    const card = makeCard({
      priority: "low",
      dueDate: "2099-12-31T23:59:59Z",
      completedAt: null,
    });
    expect(getCardChipClasses(card)).toContain("green");
  });

  it("completed takes precedence over overdue", () => {
    const card = makeCard({
      completedAt: "2020-01-05T00:00:00Z",
      dueDate: "2020-01-01T00:00:00Z",
    });
    const classes = getCardChipClasses(card);
    expect(classes).toContain("line-through");
    // Should NOT be the overdue red-100 style
    expect(classes).not.toContain("red-100");
  });
});
