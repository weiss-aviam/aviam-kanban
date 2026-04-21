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

export type DashboardActivityType =
  | "mention"
  | "comment_on_assigned"
  | "deadline_change"
  | "file_upload"
  | "card_assigned"
  | "board_member_added"
  | "card_completed"
  | "card_moved";

export type DashboardDeadline = {
  cardId: string;
  title: string;
  dueDate: string;
  priority: "high" | "medium" | "low";
  boardId: string;
  boardName: string;
};

export type DashboardActivity = {
  id: string;
  type: DashboardActivityType;
  createdAt: string;
  actor: { id: string; name: string | null; avatarUrl: string | null } | null;
  card: { id: string; title: string } | null;
  board: { id: string; name: string } | null;
};

export type DashboardStats = {
  activeTaskCount: number;
  totalTaskCount: number;
  teamMemberCount: number;
  upcomingDeadlines: DashboardDeadline[];
  recentActivities: DashboardActivity[];
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

export async function getDashboardStats(): Promise<DashboardStats> {
  const { supabase, user } = await getSessionUser();
  if (!user) {
    return {
      activeTaskCount: 0,
      totalTaskCount: 0,
      teamMemberCount: 0,
      upcomingDeadlines: [],
      recentActivities: [],
    };
  }

  const nowIso = new Date().toISOString();

  const [activeRes, totalRes, memberRes, deadlineRes, activityRes] =
    await Promise.all([
      supabase
        .from("cards")
        .select("id, boards!inner(is_archived)", { count: "exact", head: true })
        .eq("assignee_id", user.id)
        .eq("boards.is_archived", false),
      supabase
        .from("cards")
        .select("id, boards!inner(is_archived)", { count: "exact", head: true })
        .eq("boards.is_archived", false),
      supabase.from("board_members").select("user_id"),
      supabase
        .from("cards")
        .select(
          `id, title, due_date, priority,
         boards!inner ( id, name, is_archived )`,
        )
        .gte("due_date", nowIso)
        .eq("boards.is_archived", false)
        .order("due_date", { ascending: true })
        .limit(5),
      supabase
        .from("notifications")
        .select(
          `id, type, created_at,
         actor:users!actor_id ( id, name, avatar_url ),
         card:cards!card_id ( id, title ),
         board:boards!board_id ( id, name )`,
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  if (activeRes.error)
    console.error("getDashboardStats activeRes:", activeRes.error.message);
  if (totalRes.error)
    console.error("getDashboardStats totalRes:", totalRes.error.message);
  if (memberRes.error)
    console.error("getDashboardStats memberRes:", memberRes.error.message);
  if (deadlineRes.error)
    console.error("getDashboardStats deadlineRes:", deadlineRes.error.message);
  if (activityRes.error)
    console.error("getDashboardStats activityRes:", activityRes.error.message);

  const teamMemberCount = new Set((memberRes.data ?? []).map((r) => r.user_id))
    .size;

  const upcomingDeadlines: DashboardDeadline[] = (deadlineRes.data ?? []).map(
    (r) => {
      const board = Array.isArray(r.boards) ? r.boards[0] : r.boards;
      return {
        cardId: r.id as string,
        title: r.title as string,
        dueDate: r.due_date as string,
        priority: r.priority as DashboardDeadline["priority"],
        boardId: (board as { id: string }).id,
        boardName: (board as { name: string }).name,
      };
    },
  );

  const recentActivities: DashboardActivity[] = (activityRes.data ?? []).map(
    (n) => {
      const actor = Array.isArray(n.actor) ? n.actor[0] : n.actor;
      const card = Array.isArray(n.card) ? n.card[0] : n.card;
      const board = Array.isArray(n.board) ? n.board[0] : n.board;
      return {
        id: n.id as string,
        type: n.type as DashboardActivityType,
        createdAt: n.created_at as string,
        actor: actor
          ? {
              id: (actor as { id: string }).id,
              name: (actor as { name: string | null }).name,
              avatarUrl: (actor as { avatar_url: string | null }).avatar_url,
            }
          : null,
        card: card
          ? {
              id: (card as { id: string }).id,
              title: (card as { title: string }).title,
            }
          : null,
        board: board
          ? {
              id: (board as { id: string }).id,
              name: (board as { name: string }).name,
            }
          : null,
      };
    },
  );

  return {
    activeTaskCount: activeRes.count ?? 0,
    totalTaskCount: totalRes.count ?? 0,
    teamMemberCount,
    upcomingDeadlines,
    recentActivities,
  };
}
