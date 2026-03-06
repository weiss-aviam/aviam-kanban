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
import { Plus, Loader2, Users } from "lucide-react";
import { t } from "@/lib/i18n";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Board } from "@/types/database";

import { TemplateSelector } from "../templates/TemplateSelector";
import { InviteUserForm } from "../admin/InviteUserForm";
import {
  createCreateBoardSchema,
  getCreateBoardErrorMessage,
  type CreateBoardFormValues,
} from "./create-board-dialog.utils";

interface CreateBoardDialogProps {
  onBoardCreated?: (board: Board) => void;
  trigger?: React.ReactNode;
}

export function CreateBoardDialog({
  onBoardCreated,
  trigger,
}: CreateBoardDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<
    number | undefined
  >();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [createdBoard, setCreatedBoard] = useState<Board | null>(null);
  const [showInvitePrompt, setShowInvitePrompt] = useState(false);

  const schema = createCreateBoardSchema();
  const {
    register,
    handleSubmit: rhfHandleSubmit,
    reset,
  } = useForm<CreateBoardFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "" },
  });

  const onSubmit = async ({ name }: CreateBoardFormValues) => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/boards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          templateId: selectedTemplateId,
        }),
      });

      if (!response.ok) {
        const errorData: unknown = await response.json().catch(() => null);
        throw new Error(getCreateBoardErrorMessage(errorData));
      }

      const { board } = await response.json();

      // Reset form
      reset({ name: "" });
      setSelectedTemplateId(undefined);

      // Store created board and show invite prompt
      setCreatedBoard(board);
      setShowInvitePrompt(true);

      // Notify parent component
      if (onBoardCreated) {
        onBoardCreated(board);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("common.unexpectedError"),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleInviteClose = () => {
    setShowInvitePrompt(false);
    setCreatedBoard(null);
    setOpen(false);
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
          <form onSubmit={rhfHandleSubmit(onSubmit)} className="space-y-6">
            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-4 rounded-md border border-red-200">
                {error}
              </div>
            )}

            <div className="space-y-6">
              <div className="space-y-3">
                <Label htmlFor="name" className="text-base font-medium">
                  {t("createBoard.nameLabel")}
                </Label>
                <Input
                  id="name"
                  placeholder={t("createBoard.namePlaceholder")}
                  disabled={isLoading}
                  autoFocus
                  className="h-11"
                  {...register("name")}
                />
              </div>

              <div className="space-y-3">
                <Label className="text-base font-medium">
                  {t("createBoard.templateLabel")}
                </Label>
                <TemplateSelector
                  selectedTemplateId={selectedTemplateId}
                  onTemplateSelect={setSelectedTemplateId}
                  disabled={isLoading}
                />
              </div>
            </div>

            <DialogFooter className="pt-6 border-t">
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
        </DialogContent>
      </Dialog>

      {/* Invite Members prompt — shown after board is created */}
      {createdBoard && (
        <Dialog open={showInvitePrompt} onOpenChange={handleInviteClose}>
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
              onInviteSent={() => {}}
            />

            <DialogFooter className="pt-4 border-t">
              <Button variant="outline" onClick={handleInviteClose}>
                {t("inviteMembers.skipForNow")}
              </Button>
              <Button onClick={handleInviteClose}>
                {t("inviteMembers.done")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
