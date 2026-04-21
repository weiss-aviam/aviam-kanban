"use client";

import { useActionState, useState } from "react";
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
import type { Column } from "@/types/database";
import { t } from "@/lib/i18n";
import { createColumnAction } from "@/app/actions/columns";
import {
  INITIAL_COLUMN_STATE,
  type ColumnActionState,
} from "@/app/actions/columns-state";

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
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledOnOpenChange || setInternalOpen;

  const handleAction = async (
    prev: ColumnActionState,
    formData: FormData,
  ): Promise<ColumnActionState> => {
    const result = await createColumnAction(prev, formData);
    if (result.status === "success") {
      onColumnCreated?.(result.column);
      setOpen(false);
    }
    return result;
  };

  const [state, formAction, isPending] = useActionState(
    handleAction,
    INITIAL_COLUMN_STATE,
  );

  const errorMessage = state.status === "error" ? state.error : null;

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
        <form action={formAction}>
          <input type="hidden" name="boardId" value={boardId} />
          <div className="grid gap-3 py-3 sm:gap-4 sm:py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">{t("columns.columnTitle")}</Label>
              <Input
                id="title"
                name="title"
                placeholder={t("columns.enterColumnTitle")}
                disabled={isPending}
                autoFocus
                required
              />
            </div>
            {errorMessage && (
              <div className="text-sm text-red-600">{errorMessage}</div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
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
