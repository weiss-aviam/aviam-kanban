import { getBoardsForUser } from "@/lib/data/dashboard";
import { getBoardGroupsForUser } from "@/lib/data/board-groups";
import { BoardsContent } from "@/components/boards/BoardsContent";
import type { BoardWithDetails } from "@/types/database";

export default async function BoardsPage() {
  const [boards, boardGroups] = await Promise.all([
    getBoardsForUser(),
    getBoardGroupsForUser(),
  ]);

  return (
    <BoardsContent
      initialBoards={boards as unknown as BoardWithDetails[]}
      initialBoardGroups={boardGroups}
    />
  );
}
