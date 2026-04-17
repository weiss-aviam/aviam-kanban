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
import { Plus, Loader2, Users } from "lucide-react";
import { t } from "@/lib/i18n";
import type { Board } from "@/types/database";

import { TemplateSelector } from "../templates/TemplateSelector";
import { InviteUserForm } from "../admin/InviteUserForm";
import {
  createBoardAction,
  INITIAL_BOARD_STATE,
  type BoardActionState,
} from "@/app/actions/boards";

interface CreateBoardDialogProps {
  onBoardCreated?: (board: Board) => void;
  trigger?: React.ReactNode;
}

export function CreateBoardDialog({
  onBoardCreated,
  trigger,
}: CreateBoardDialogProps) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [createdBoard, setCreatedBoard] = useState<Board | null>(null);
  const [showMemberPrompt, setShowMemberPrompt] = useState(false);

  const handleMemberPromptClose = () => {
    setShowMemberPrompt(false);
    setCreatedBoard(null);
    setOpen(false);
  };

  const handleBoardCreated = (board: Board) => {
    setCreatedBoard(board);
    setShowMemberPrompt(true);
    setFormKey((k) => k + 1);
    onBoardCreated?.(board);
  };

  const defaultTrigger = (
    <Button>
      <Plus className="w-4 h-4 mr-2" />
      {t("createBoard.submit")}
    </Button>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>{trigger || defaultTrigger}</DialogTrigger>
        <DialogContent className="sm:max-w-2xl w-[90vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("createBoard.title")}</DialogTitle>
            <DialogDescription>
              {t("createBoard.description")}
            </DialogDescription>
          </DialogHeader>
          <CreateBoardForm
            key={formKey}
            onClose={() => setOpen(false)}
            onBoardCreated={handleBoardCreated}
          />
        </DialogContent>
      </Dialog>

      {createdBoard && (
        <Dialog open={showMemberPrompt} onOpenChange={handleMemberPromptClose}>
          <DialogContent className="sm:max-w-2xl w-[90vw] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                {t("inviteMembers.title")}
              </DialogTitle>
              <DialogDescription>
                {t("inviteMembers.description")}
              </DialogDescription>
            </DialogHeader>

            <InviteUserForm
              boardId={String(createdBoard.id)}
              currentUserRole="owner"
              onMemberAdded={() => {}}
            />

            <DialogFooter className="pt-4 sm:pt-5 border-t">
              <Button variant="outline" onClick={handleMemberPromptClose}>
                {t("inviteMembers.skipForNow")}
              </Button>
              <Button onClick={handleMemberPromptClose}>
                {t("inviteMembers.done")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function CreateBoardForm({
  onClose,
  onBoardCreated,
}: {
  onClose: () => void;
  onBoardCreated: (board: Board) => void;
}) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<
    number | undefined
  >();

  const handleAction = async (
    prev: BoardActionState,
    formData: FormData,
  ): Promise<BoardActionState> => {
    const result = await createBoardAction(prev, formData);
    if (result.status === "success") {
      onBoardCreated(result.board);
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
      {selectedTemplateId !== undefined && (
        <input
          type="hidden"
          name="templateId"
          value={String(selectedTemplateId)}
        />
      )}

      {errorMessage && (
        <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md border border-red-200">
          {errorMessage}
        </div>
      )}

      <div className="space-y-4 sm:space-y-6">
        <div className="space-y-2">
          <Label htmlFor="name" className="text-sm font-medium">
            {t("createBoard.nameLabel")}
          </Label>
          <Input
            id="name"
            name="name"
            placeholder={t("createBoard.namePlaceholder")}
            disabled={isPending}
            autoFocus
            required
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">
            {t("createBoard.templateLabel")}
          </Label>
          <TemplateSelector
            selectedTemplateId={selectedTemplateId}
            onTemplateSelect={setSelectedTemplateId}
            disabled={isPending}
          />
        </div>
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
              {t("createBoard.creating")}
            </>
          ) : (
            <>
              <Plus className="w-4 h-4 mr-2" />
              {t("createBoard.submit")}
            </>
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}
