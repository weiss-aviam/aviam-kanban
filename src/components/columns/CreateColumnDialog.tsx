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
  DialogTrigger,
} from "../ui/dialog";
import { Plus, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Column } from "@/types/database";
import { t } from "@/lib/i18n";
import {
  createColumnSchema,
  getColumnMutationErrorMessage,
  type ColumnFormValues,
} from "./column-dialog.utils";

interface CreateColumnDialogProps {
  boardId: string;
  onColumnCreated?: (column: Column) => void;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CreateColumnDialog({
  boardId,
  onColumnCreated,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: CreateColumnDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const schema = createColumnSchema();
  const {
    register,
    handleSubmit: rhfHandleSubmit,
    reset,
  } = useForm<ColumnFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: "" },
  });

  // Use controlled or internal state
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledOnOpenChange || setInternalOpen;

  const onSubmit = async ({ title }: ColumnFormValues) => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/columns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          boardId,
          title: title.trim(),
        }),
      });

      if (!response.ok) {
        const errorData: unknown = await response.json().catch(() => null);
        throw new Error(
          getColumnMutationErrorMessage(errorData, "failedToCreate"),
        );
      }

      const column = await response.json();

      // Reset form
      reset({ title: "" });
      setOpen(false);

      // Notify parent component
      if (onColumnCreated) {
        onColumnCreated(column);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("common.unexpectedError"),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const defaultTrigger = (
    <Button
      variant="outline"
      className="border-dashed border-2 hover:border-solid"
    >
      <Plus className="w-4 h-4 mr-2" />
      {t("columns.addColumn")}
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      {!trigger && !controlledOpen && (
        <DialogTrigger asChild>{defaultTrigger}</DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t("columns.addNewColumn")}</DialogTitle>
          <DialogDescription>
            {t("columns.addNewColumnDescription")}
          </DialogDescription>
        </DialogHeader>
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
            </div>
            {error && <div className="text-sm text-red-600">{error}</div>}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("columns.creating")}
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  {t("columns.addColumn")}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
