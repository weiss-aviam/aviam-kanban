import { notFound } from "next/navigation";
import { getBoardGroupWithBoards } from "@/lib/data/board-groups";
import { GroupPageContent } from "@/components/board-groups/GroupPageContent";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function GroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_REGEX.test(id)) notFound();

  const result = await getBoardGroupWithBoards(id);
  if (!result) notFound();

  return (
    <GroupPageContent
      initialGroup={result.group}
      initialBoards={result.boards}
    />
  );
}
