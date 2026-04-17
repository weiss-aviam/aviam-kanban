"use client";

import { useRef } from "react";
import { useAppStore } from "@/store";
import type { BoardWithDetails } from "@/types/database";

interface StoreHydratorProps {
  initialBoards?: BoardWithDetails[];
  initialTaskCount?: number;
}

export function StoreHydrator({
  initialBoards,
  initialTaskCount,
}: StoreHydratorProps) {
  const hydrated = useRef(false);
  if (!hydrated.current) {
    const patch: Partial<{
      boards: BoardWithDetails[];
      boardsFetchedAt: Date;
      activeTaskCount: number;
    }> = {};
    if (initialBoards !== undefined) {
      patch.boards = initialBoards;
      patch.boardsFetchedAt = new Date();
    }
    if (initialTaskCount !== undefined) {
      patch.activeTaskCount = initialTaskCount;
    }
    if (Object.keys(patch).length > 0) {
      useAppStore.setState(patch);
    }
    hydrated.current = true;
  }
  return null;
}
