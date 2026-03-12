import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  canEditBoard,
  canManageBoardMembers,
  canViewBoard,
  formatDueDate,
  isAssignedToUser,
  isDueSoon,
  isOverdue,
} from "@/lib/board-permissions";

describe("board-permissions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-05T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("formatDueDate", () => {
    it("returns an empty string for missing values", () => {
      expect(formatDueDate(null)).toBe("");
      expect(formatDueDate(undefined)).toBe("");
    });

    it("formats deadline values for compact card display", () => {
      // formatDueDate uses Intl.DateTimeFormat("de-DE", { day: "numeric", month: "long", year: "2-digit" })
      expect(formatDueDate("2026-03-10T12:00:00Z")).toBe("10. März 26");
      expect(formatDueDate(new Date("2026-03-06T12:00:00Z"))).toBe(
        "6. März 26",
      );
    });
  });

  describe("isOverdue", () => {
    it("returns true only for dates before now", () => {
      expect(isOverdue("2026-03-05T11:59:59Z")).toBe(true);
      expect(isOverdue("2026-03-05T12:00:01Z")).toBe(false);
      expect(isOverdue(null)).toBe(false);
    });
  });

  describe("isDueSoon", () => {
    it("returns true only for future dates within the next 24 hours", () => {
      expect(isDueSoon("2026-03-05T18:00:00Z")).toBe(true);
      expect(isDueSoon("2026-03-06T12:00:01Z")).toBe(false);
      expect(isDueSoon("2026-03-05T11:59:59Z")).toBe(false);
    });
  });

  describe("isAssignedToUser", () => {
    it("matches cards to the active user id", () => {
      expect(isAssignedToUser({ assigneeId: "user-1" }, "user-1")).toBe(true);
      expect(isAssignedToUser({ assigneeId: "user-2" }, "user-1")).toBe(false);
      expect(isAssignedToUser({ assigneeId: null }, "user-1")).toBe(false);
      expect(isAssignedToUser({ assigneeId: "user-1" }, null)).toBe(false);
    });
  });

  describe("role helpers", () => {
    it("allows all valid roles to view the board", () => {
      expect(canViewBoard("owner")).toBe(true);
      expect(canViewBoard("admin")).toBe(true);
      expect(canViewBoard("member")).toBe(true);
      expect(canViewBoard("viewer")).toBe(true);
      expect(canViewBoard("invalid-role")).toBe(false);
      expect(canViewBoard(null)).toBe(false);
    });

    it("treats viewer as read-only while member/admin/owner can edit", () => {
      expect(canEditBoard("viewer")).toBe(false);
      expect(canEditBoard("member")).toBe(true);
      expect(canEditBoard("admin")).toBe(true);
      expect(canEditBoard("owner")).toBe(true);
      expect(canEditBoard(undefined)).toBe(false);
    });

    it("allows only admins and owners to manage board members", () => {
      expect(canManageBoardMembers("viewer")).toBe(false);
      expect(canManageBoardMembers("member")).toBe(false);
      expect(canManageBoardMembers("admin")).toBe(true);
      expect(canManageBoardMembers("owner")).toBe(true);
      expect(canManageBoardMembers(null)).toBe(false);
    });
  });
});
