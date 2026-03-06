import { canEditBoard } from "@/lib/board-permissions";
import type { BoardMemberRole } from "@/types/database";

type BoardAccessRow = {
  owner_id?: string | null;
  role?: BoardMemberRole | null;
};

type BoardAccessResult = {
  data: BoardAccessRow | null;
  error: unknown;
};

type BoardAccessQuery = {
  eq: (column: string, value: string) => BoardAccessQuery;
  single: () => PromiseLike<BoardAccessResult>;
};

type BoardAccessClient = {
  from: (table: string) => {
    select: (columns: string) => BoardAccessQuery;
  };
};

export async function getBoardRoleForUser(
  supabase: BoardAccessClient,
  boardId: string,
  userId: string,
): Promise<BoardMemberRole | null> {
  const { data: board, error: boardError } = await supabase
    .from("boards")
    .select("owner_id")
    .eq("id", boardId)
    .single();

  if (boardError || !board) {
    return null;
  }

  if (board.owner_id === userId) {
    return "owner";
  }

  const { data: memberData, error: memberError } = await supabase
    .from("board_members")
    .select("role")
    .eq("board_id", boardId)
    .eq("user_id", userId)
    .single();

  if (memberError || !memberData?.role) {
    return null;
  }

  return memberData.role;
}

export async function getBoardMutationAuthorization(
  supabase: BoardAccessClient,
  boardId: string,
  userId: string,
): Promise<
  | { ok: true; role: BoardMemberRole }
  | { ok: false; status: 403 | 404; error: string }
> {
  const role = await getBoardRoleForUser(supabase, boardId, userId);

  if (!role) {
    return {
      ok: false,
      status: 404,
      error: "Board not found or access denied",
    };
  }

  if (!canEditBoard(role)) {
    return {
      ok: false,
      status: 403,
      error: "Insufficient permissions",
    };
  }

  return { ok: true, role };
}
