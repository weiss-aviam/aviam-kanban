import { getBoardsForUser, getDashboardStats } from "@/lib/data/dashboard";
import { getBoardGroupsForUser } from "@/lib/data/board-groups";
import { DashboardContent } from "@/components/dashboard/DashboardContent";
import type { BoardWithDetails } from "@/types/database";

export default async function DashboardPage() {
  const [boards, stats, boardGroups] = await Promise.all([
    getBoardsForUser(),
    getDashboardStats(),
    getBoardGroupsForUser(),
  ]);

  return (
    <DashboardContent
      initialBoards={boards as unknown as BoardWithDetails[]}
      initialStats={stats}
      initialBoardGroups={boardGroups}
    />
  );
}
