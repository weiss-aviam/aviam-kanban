import { getBoardsForUser, getDashboardStats } from "@/lib/data/dashboard";
import { DashboardContent } from "@/components/dashboard/DashboardContent";
import { StoreHydrator } from "@/components/providers/StoreHydrator";
import type { BoardWithDetails } from "@/types/database";

export default async function DashboardPage() {
  const [boards, stats] = await Promise.all([
    getBoardsForUser(),
    getDashboardStats(),
  ]);

  return (
    <>
      <StoreHydrator
        initialBoards={boards as unknown as BoardWithDetails[]}
        initialTaskCount={stats.activeTaskCount}
      />
      <DashboardContent />
    </>
  );
}
