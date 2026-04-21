import { getSessionUser } from "@/lib/supabase/server";
import type { DashboardBoard } from "@/lib/data/dashboard";

export type DashboardBoardGroup = {
  id: string;
  name: string;
  color: string | null;
  createdBy: string | null;
  position: number;
  createdAt: string;
};

/**
 * Returns every group the current user can see. RLS handles the visibility
 * filter (creator OR member of any board in the group), so we just SELECT.
 */
export async function getBoardGroupsForUser(): Promise<DashboardBoardGroup[]> {
  const { supabase, user } = await getSessionUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("board_groups")
    .select("id, name, color, created_by, position, created_at")
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error || !data) {
    console.error("Error fetching board groups (RSC):", error);
    return [];
  }

  return data.map((g) => ({
    id: g.id,
    name: g.name,
    color: g.color ?? null,
    createdBy: g.created_by ?? null,
    position: g.position ?? 0,
    createdAt: g.created_at,
  }));
}

/**
 * Returns a single group plus its boards (filtered by RLS — boards the user
 * is not a member of are dropped). Returns null if the group is not visible.
 */
export async function getBoardGroupWithBoards(
  groupId: string,
): Promise<{ group: DashboardBoardGroup; boards: DashboardBoard[] } | null> {
  const { supabase, user } = await getSessionUser();
  if (!user) return null;

  const { data: group, error: groupErr } = await supabase
    .from("board_groups")
    .select("id, name, color, created_by, position, created_at")
    .eq("id", groupId)
    .maybeSingle();

  if (groupErr || !group) return null;

  const { data: boardRows, error: boardsErr } = await supabase
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
    .eq("group_id", groupId)
    .order("group_position", { ascending: true });

  if (boardsErr || !boardRows) {
    console.error("Error fetching group boards (RSC):", boardsErr);
    return {
      group: {
        id: group.id,
        name: group.name,
        color: group.color ?? null,
        createdBy: group.created_by ?? null,
        position: group.position ?? 0,
        createdAt: group.created_at,
      },
      boards: [],
    };
  }

  const boardIds = boardRows.map((b) => b.id);
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

  const boards: DashboardBoard[] = boardRows.map((b) => ({
    id: b.id,
    name: b.name,
    isArchived: b.is_archived,
    createdAt: b.created_at,
    ownerId: b.owner_id,
    groupId: b.group_id ?? null,
    groupPosition: b.group_position ?? 0,
    role:
      (b.board_members.find((m) => m.user_id === user.id)?.role as
        | DashboardBoard["role"]
        | undefined) ??
      (b.board_members[0]?.role as DashboardBoard["role"] | undefined) ??
      "viewer",
    memberCount: b.board_members.length,
    description: b.description ?? null,
    updatedAt: b.updated_at,
    taskCount: taskCounts[b.id] ?? 0,
  }));

  return {
    group: {
      id: group.id,
      name: group.name,
      color: group.color ?? null,
      createdBy: group.created_by ?? null,
      position: group.position ?? 0,
      createdAt: group.created_at,
    },
    boards,
  };
}
