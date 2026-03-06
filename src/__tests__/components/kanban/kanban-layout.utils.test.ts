import { describe, expect, it } from "vitest";
import { getKanbanColumnsLayoutStyle } from "@/components/kanban/kanban-layout.utils";

describe("kanban-layout utils", () => {
  it("fills the available width evenly for boards with up to four columns", () => {
    expect(getKanbanColumnsLayoutStyle(3)).toEqual({
      alignItems: "start",
      gridTemplateColumns: "repeat(3, minmax(300px, 1fr))",
      minWidth: "100%",
      width: "100%",
    });
  });

  it("keeps a 300px minimum per column for wider boards so horizontal scroll can appear", () => {
    expect(getKanbanColumnsLayoutStyle(5)).toEqual({
      alignItems: "start",
      gridTemplateColumns: "repeat(5, minmax(300px, 1fr))",
      minWidth: "1596px",
      width: "100%",
    });
  });
});
