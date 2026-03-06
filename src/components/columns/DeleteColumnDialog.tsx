"use client";

import { useState } from "react";
import { DeleteConfirmationDialog } from "../ui/delete-confirmation-dialog";
import { useAppActions } from "@/store";
import type { Column } from "@/types/database";
import { t } from "@/lib/i18n";
import {
  getColumnMutationErrorMessage,
  getDeleteColumnDescription,
} from "./column-dialog.utils";

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
        const errorData: unknown = await response.json().catch(() => null);
        throw new Error(
          getColumnMutationErrorMessage(errorData, "failedToDelete"),
        );
      }

      // Update the store
      deleteColumn(column.id);

      onOpenChange(false);
    } catch (error) {
      console.error("Error deleting column:", error);
      setError(
        error instanceof Error ? error.message : t("columns.failedToDelete"),
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
    title: t("columns.deleteColumn"),
    description: getDeleteColumnDescription(column.title, cardCount),
    destructiveAction: t("columns.deleteColumn"),
    onConfirm: handleDelete,
    isLoading,
    ...(hasCards ? { confirmationText: column.title } : {}),
  };

  return <DeleteConfirmationDialog {...dialogProps} />;
}
