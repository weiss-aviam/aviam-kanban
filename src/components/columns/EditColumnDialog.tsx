"use client";

import { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAppActions, useAppState } from "@/store";
import type { Column } from "@/types/database";
import { t } from "@/lib/i18n";
import {
  createColumnSchema,
  getColumnMutationErrorMessage,
  type ColumnFormValues,
} from "./column-dialog.utils";

interface EditColumnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  column: Column | null;
}

const schema = createColumnSchema();

export function EditColumnDialog({
  open,
  onOpenChange,
  column,
}: EditColumnDialogProps) {
  if (!column) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t("columns.editColumn")}</DialogTitle>
          <DialogDescription>
            {t("columns.updateColumnTitle")}
          </DialogDescription>
        </DialogHeader>
        <EditColumnForm
          key={column.id}
          column={column}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function EditColumnForm({
  column,
  onClose,
}: {
  column: Column;
  onClose: () => void;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const { updateColumn, setError: setGlobalError } = useAppActions();
  const { currentBoard } = useAppState();

  const {
    register,
    handleSubmit: rhfHandleSubmit,
    formState: { errors },
  } = useForm<ColumnFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: column.title },
  });

  const onSubmit = async (data: ColumnFormValues) => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/columns/${column.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: data.title }),
      });

      if (!response.ok) {
        const errorData: unknown = await response.json().catch(() => null);
        throw new Error(
          getColumnMutationErrorMessage(errorData, "failedToUpdate"),
        );
      }

      const updatedColumn = await response.json();

      const existingColumn = currentBoard?.columns.find(
        (col) => col.id === column.id,
      );
      const cards = existingColumn?.cards || [];

      updateColumn({
        ...updatedColumn,
        cards,
      });

      onClose();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : t("columns.failedToUpdate");
      setError(errorMessage);
      setGlobalError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={rhfHandleSubmit(onSubmit)}>
      <div className="grid gap-3 py-3 sm:gap-4 sm:py-4">
        <div className="grid gap-2">
          <Label htmlFor="title">{t("columns.columnTitle")}</Label>
          <Input
            id="title"
            placeholder={t("columns.enterColumnTitle")}
            disabled={isLoading}
            autoFocus
            {...register("title")}
          />
          {errors.title && (
            <p className="text-sm text-red-600">{errors.title.message}</p>
          )}
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
      </div>
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isLoading}
        >
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t("common.saveChanges")}
        </Button>
      </DialogFooter>
    </form>
  );
}
