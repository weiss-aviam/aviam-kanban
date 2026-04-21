"use client";

import { useState } from "react";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { t } from "@/lib/i18n";
import type { DashboardBoardGroup } from "@/lib/data/board-groups";

interface DeleteGroupDialogProps {
  group: DashboardBoardGroup | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmed: (groupId: string) => void;
}

export function DeleteGroupDialog({
  group,
  open,
  onOpenChange,
  onConfirmed,
}: DeleteGroupDialogProps) {
  const [isLoading, setIsLoading] = useState(false);

  if (!group) return null;

  const handleDelete = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/board-groups/${group.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        console.error("Failed to delete group:", await res.text());
        return;
      }
      onConfirmed(group.id);
      onOpenChange(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DeleteConfirmationDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("boardGroups.deleteTitle")}
      description={t("boardGroups.deleteDescription", { name: group.name })}
      confirmationText={group.name}
      destructiveAction={t("boardGroups.delete")}
      onConfirm={handleDelete}
      isLoading={isLoading}
    />
  );
}
