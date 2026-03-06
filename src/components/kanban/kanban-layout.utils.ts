import type { CSSProperties } from "react";

const COLUMN_MIN_WIDTH_PX = 300;
const COLUMN_GAP_PX = 24;
const MAX_FILL_COLUMNS = 4;

export function getKanbanColumnsLayoutStyle(
  columnCount: number,
): CSSProperties {
  const safeColumnCount = Math.max(1, columnCount);
  const minimumScrollableWidth =
    safeColumnCount * COLUMN_MIN_WIDTH_PX +
    Math.max(0, safeColumnCount - 1) * COLUMN_GAP_PX;

  return {
    alignItems: "start",
    gridTemplateColumns: `repeat(${safeColumnCount}, minmax(${COLUMN_MIN_WIDTH_PX}px, 1fr))`,
    minWidth:
      safeColumnCount > MAX_FILL_COLUMNS
        ? `${minimumScrollableWidth}px`
        : "100%",
    width: "100%",
  };
}
