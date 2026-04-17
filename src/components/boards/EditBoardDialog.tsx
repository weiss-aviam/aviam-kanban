"use client";

import { useActionState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Edit, Loader2 } from "lucide-react";
import { t } from "@/lib/i18n";
import {
  updateBoardAction,
  INITIAL_BOARD_STATE,
  type BoardActionState,
} from "@/app/actions/boards";

interface EditBoardDialogProps {
  board: { id: string; name: string; description?: string | null } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBoardUpdated?: (board: {
    id: string;
    name: string;
    description?: string | null;
  }) => void;
}

export function EditBoardDialog({
  board,
  open,
  onOpenChange,
  onBoardUpdated,
}: EditBoardDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl w-[90vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("board.editBoard")}</DialogTitle>
          <DialogDescription>{t("editBoard.description")}</DialogDescription>
        </DialogHeader>
        {board && (
          <EditBoardForm
            key={board.id}
            board={board}
            onClose={() => onOpenChange(false)}
            onBoardUpdated={onBoardUpdated}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditBoardForm({
  board,
  onClose,
  onBoardUpdated,
}: {
  board: { id: string; name: string; description?: string | null };
  onClose: () => void;
  onBoardUpdated:
    | ((board: {
        id: string;
        name: string;
        description?: string | null;
      }) => void)
    | undefined;
}) {
  const handleAction = async (
    prev: BoardActionState,
    formData: FormData,
  ): Promise<BoardActionState> => {
    const result = await updateBoardAction(prev, formData);
    if (result.status === "success") {
      onBoardUpdated?.({
        id: result.board.id,
        name: result.board.name,
        description: result.board.description ?? null,
      });
      onClose();
    }
    return result;
  };

  const [state, formAction, isPending] = useActionState(
    handleAction,
    INITIAL_BOARD_STATE,
  );

  const errorMessage = state.status === "error" ? state.error : null;

  return (
    <form action={formAction} className="space-y-4 sm:space-y-6">
      <input type="hidden" name="boardId" value={board.id} />

      {errorMessage && (
        <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md border border-red-200">
          {errorMessage}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="name" className="text-sm font-medium">
          {t("editBoard.nameLabel")}
        </Label>
        <Input
          id="name"
          name="name"
          placeholder={t("editBoard.namePlaceholder")}
          disabled={isPending}
          autoFocus
          required
          defaultValue={board.name}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description" className="text-sm font-medium">
          {t("editBoard.descriptionLabel")}
        </Label>
        <Textarea
          id="description"
          name="description"
          placeholder={t("editBoard.descriptionPlaceholder")}
          disabled={isPending}
          rows={3}
          defaultValue={board.description ?? ""}
        />
      </div>

      <DialogFooter className="pt-4 sm:pt-6 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isPending}
        >
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {t("editBoard.updating")}
            </>
          ) : (
            <>
              <Edit className="w-4 h-4 mr-2" />
              {t("editBoard.submit")}
            </>
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}
