import { getSessionUser } from "@/lib/supabase/server";
import type { BoardMemberRole } from "@/types/database";

export type DashboardBoard = {
  id: string;
  name: string;
  description: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  ownerId: string;
  groupId: string | null;
  groupPosition: number;
  role: BoardMemberRole;
  memberCount: number;
  taskCount: number;
};

export async function getBoardsForUser(): Promise<DashboardBoard[]> {
  const { supabase, user } = await getSessionUser();
  if (!user) return [];

  const { data: userBoards, error } = await supabase
    .from("boards")
    .select(
      `
      id,
      name,
      is_archived,
      created_at,
      owner_id,
      description,
      updated_at,
      group_id,
      group_position,
      board_members!inner(role, user_id)
    `,
    )
    .order("created_at", { ascending: false });

  if (error || !userBoards) {
    console.error("Error fetching boards (RSC):", error);
    return [];
  }

  const boardIds = userBoards.map((b) => b.id);
  let taskCounts: Record<string, number> = {};
  if (boardIds.length > 0) {
    const { data: cardRows } = await supabase
      .from("cards")
      .select("board_id")
      .in("board_id", boardIds);
    taskCounts = (cardRows ?? []).reduce<Record<string, number>>((acc, c) => {
      acc[c.board_id] = (acc[c.board_id] || 0) + 1;
      return acc;
    }, {});
  }

  return userBoards.map((board) => ({
    id: board.id,
    name: board.name,
    isArchived: board.is_archived,
    createdAt: board.created_at,
    ownerId: board.owner_id,
    groupId: board.group_id ?? null,
    groupPosition: board.group_position ?? 0,
    role:
      (board.board_members.find((m) => m.user_id === user.id)
        ?.role as BoardMemberRole) ??
      (board.board_members[0]?.role as BoardMemberRole) ??
      "viewer",
    memberCount: board.board_members.length,
    description: board.description ?? null,
    updatedAt: board.updated_at,
    taskCount: taskCounts[board.id] ?? 0,
  }));
}

export async function getDashboardStats(): Promise<{
  activeTaskCount: number;
}> {
  const { supabase, user } = await getSessionUser();
  if (!user) return { activeTaskCount: 0 };

  const { count, error } = await supabase
    .from("cards")
    .select("id, boards!inner(is_archived)", { count: "exact", head: true })
    .eq("assignee_id", user.id)
    .eq("boards.is_archived", false);

  if (error) {
    console.error("Error fetching active task count (RSC):", error);
    return { activeTaskCount: 0 };
  }

  return { activeTaskCount: count ?? 0 };
}
