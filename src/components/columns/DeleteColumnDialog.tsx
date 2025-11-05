"use client";

import { useState } from "react";
import { DeleteConfirmationDialog } from "../ui/delete-confirmation-dialog";
import { useAppActions } from "@/store";
import type { Column } from "@/types/database";

interface DeleteColumnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  column: Column | null;
  cardCount?: number;
}

export function DeleteColumnDialog({
  open,
  onOpenChange,
  column,
  cardCount = 0,
}: DeleteColumnDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { deleteColumn, setError } = useAppActions();

  const handleDelete = async () => {
    if (!column) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/columns/${column.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete column");
      }

      // Update the store
      deleteColumn(column.id);

      onOpenChange(false);
    } catch (error) {
      console.error("Error deleting column:", error);
      setError(
        error instanceof Error ? error.message : "Failed to delete column",
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!column) return null;

  const hasCards = cardCount > 0;

  const dialogProps = {
    open,
    onOpenChange,
    title: "Delete Column",
    description: hasCards
      ? `This will permanently delete the column "${column.title}" and all ${cardCount} card${cardCount === 1 ? "" : "s"} in it. This action cannot be undone.`
      : `This will permanently delete the empty column "${column.title}". This action cannot be undone.`,
    destructiveAction: "Delete Column",
    onConfirm: handleDelete,
    isLoading,
    ...(hasCards ? { confirmationText: column.title } : {}),
  };

  return <DeleteConfirmationDialog {...dialogProps} />;
}
