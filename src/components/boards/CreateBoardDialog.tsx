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
  const [showMemberPrompt, setShowMemberPrompt] = useState(false);

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

      // Store created board and show member prompt
      setCreatedBoard(board);
      setShowMemberPrompt(true);

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

  const handleMemberPromptClose = () => {
    setShowMemberPrompt(false);
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
          <form
            onSubmit={rhfHandleSubmit(onSubmit)}
            className="space-y-4 sm:space-y-6"
          >
            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md border border-red-200">
                {error}
              </div>
            )}

            <div className="space-y-4 sm:space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium">
                  {t("createBoard.nameLabel")}
                </Label>
                <Input
                  id="name"
                  placeholder={t("createBoard.namePlaceholder")}
                  disabled={isLoading}
                  autoFocus
                  {...register("name")}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  {t("createBoard.templateLabel")}
                </Label>
                <TemplateSelector
                  selectedTemplateId={selectedTemplateId}
                  onTemplateSelect={setSelectedTemplateId}
                  disabled={isLoading}
                />
              </div>
            </div>

            <DialogFooter className="pt-4 sm:pt-6 border-t">
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

      {/* Add Members prompt — shown after board is created */}
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
