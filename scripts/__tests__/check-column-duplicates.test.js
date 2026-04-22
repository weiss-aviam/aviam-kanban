import { describe, it, expect } from "vitest";
import { findDuplicates } from "../check-column-duplicates.js";

describe("findDuplicates", () => {
  it("returns empty array when all (board_id, title) pairs are unique", () => {
    const rows = [
      { board_id: "b1", title: "Backlog" },
      { board_id: "b1", title: "Doing" },
      { board_id: "b2", title: "Backlog" },
    ];
    expect(findDuplicates(rows)).toEqual([]);
  });

  it("groups duplicates by (board_id, NFC-normalized title)", () => {
    const rows = [
      { board_id: "b1", title: "Backlog" },
      { board_id: "b1", title: "backlog" }, // case-different — NOT a duplicate
      { board_id: "b1", title: "Backlog" }, // exact dup
      { board_id: "b2", title: "Café" },    // composed
      { board_id: "b2", title: "Cafe\u0301" }, // decomposed — same after NFC
    ];
    expect(findDuplicates(rows)).toEqual([
      { board_id: "b1", title: "Backlog", count: 2 },
      { board_id: "b2", title: "Café", count: 2 },
    ]);
  });
});
