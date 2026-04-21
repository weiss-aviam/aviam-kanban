import type { Column } from "@/types/database";

export type ColumnActionState =
  | { status: "idle" }
  | { status: "success"; column: Column }
  | { status: "error"; error: string };

export const INITIAL_COLUMN_STATE: ColumnActionState = { status: "idle" };
