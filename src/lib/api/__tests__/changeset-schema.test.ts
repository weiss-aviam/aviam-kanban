import { describe, it, expect } from "vitest";
import { ChangesetSchema, TitleSchema } from "../changeset-schema";

describe("TitleSchema", () => {
  it("accepts a normal title", () => {
    expect(TitleSchema.parse("My Board")).toBe("My Board");
  });

  it("trims whitespace", () => {
    expect(TitleSchema.parse("  Hi  ")).toBe("Hi");
  });

  it("normalizes to NFC", () => {
    const decomposed = "Cafe\u0301";
    const composed = "Café";
    expect(TitleSchema.parse(decomposed)).toBe(composed);
  });

  it("rejects empty", () => {
    expect(() => TitleSchema.parse("   ")).toThrow();
  });

  it("rejects forbidden control / emoji-only", () => {
    expect(() => TitleSchema.parse("\u0007bell")).toThrow();
    expect(() => TitleSchema.parse("\uD83D\uDE00")).toThrow(); // 😀 — symbol class, not L/N/P/Zs
  });

  it("rejects > 80 chars", () => {
    expect(() => TitleSchema.parse("x".repeat(81))).toThrow();
  });
});

describe("ChangesetSchema", () => {
  const valid = {
    board: { name: "Q3 Roadmap" },
    columns: [
      { title: "Backlog", position: 1 },
      { title: "Doing", position: 2 },
      { title: "Done", position: 3 },
    ],
    cards: [{ columnRef: "Backlog", title: "Pick metrics", priority: "high" }],
  };

  it("parses a valid payload", () => {
    expect(() => ChangesetSchema.parse(valid)).not.toThrow();
  });

  it("rejects when columnRef does not match any column title", () => {
    const bad = { ...valid, cards: [{ columnRef: "Nope", title: "x" }] };
    expect(() => ChangesetSchema.parse(bad)).toThrow(/columnRef/);
  });

  it("rejects empty columns array", () => {
    expect(() => ChangesetSchema.parse({ ...valid, columns: [] })).toThrow();
  });

  it("rejects > 200 cards", () => {
    expect(() =>
      ChangesetSchema.parse({
        ...valid,
        cards: Array.from({ length: 201 }, (_, i) => ({
          columnRef: "Backlog",
          title: `c${i}`,
        })),
      }),
    ).toThrow();
  });

  it("defaults priority to medium", () => {
    const r = ChangesetSchema.parse({
      ...valid,
      cards: [{ columnRef: "Backlog", title: "x" }],
    });
    expect(r.cards?.[0]?.priority).toBe("medium");
  });
});
