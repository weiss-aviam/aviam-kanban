import type { Board } from "@/types/database";

export type BoardActionState =
  | { status: "idle" }
  | { status: "success"; board: Board }
  | { status: "error"; error: string };

export const INITIAL_BOARD_STATE: BoardActionState = { status: "idle" };
