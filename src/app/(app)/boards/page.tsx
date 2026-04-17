import { getBoardsForUser } from "@/lib/data/dashboard";
import { BoardsContent } from "@/components/boards/BoardsContent";
import { StoreHydrator } from "@/components/providers/StoreHydrator";
import type { BoardWithDetails } from "@/types/database";

export default async function BoardsPage() {
  const boards = await getBoardsForUser();

  return (
    <>
      <StoreHydrator initialBoards={boards as unknown as BoardWithDetails[]} />
      <BoardsContent />
    </>
  );
}
