"use client";

import { useState, useEffect } from "react";
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
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const schema = z.object({
    name: z.string().min(1, t("editBoard.nameRequired")),
    description: z.string().optional(),
  });
  type FormValues = z.infer<typeof schema>;
  const {
    register,
    handleSubmit: rhfHandleSubmit,
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", description: "" },
  });

  useEffect(() => {
    reset({
      name: board?.name ?? "",
      description: board?.description ?? "",
    });
  }, [board, reset]);

  const onSubmit = async ({ name, description }: FormValues) => {
    if (!board) return;

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/boards/${board.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description?.trim() || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t("editBoard.updateError"));
      }

      const { board: updatedBoard } = await response.json();

      onOpenChange(false);

      if (onBoardUpdated) {
        onBoardUpdated({
          id: updatedBoard.id,
          name: updatedBoard.name,
          description: updatedBoard.description ?? null,
        });
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("common.unexpectedError"),
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl w-[90vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("board.editBoard")}</DialogTitle>
          <DialogDescription>{t("editBoard.description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={rhfHandleSubmit(onSubmit)} className="space-y-6">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-4 rounded-md border border-red-200">
              {error}
            </div>
          )}

          <div className="space-y-3">
            <Label htmlFor="name" className="text-base font-medium">
              {t("editBoard.nameLabel")}
            </Label>
            <Input
              id="name"
              placeholder={t("editBoard.namePlaceholder")}
              disabled={isLoading}
              autoFocus
              className="h-11"
              {...register("name")}
            />
          </div>

          <div className="space-y-3">
            <Label htmlFor="description" className="text-base font-medium">
              {t("editBoard.descriptionLabel")}
            </Label>
            <Textarea
              id="description"
              placeholder={t("editBoard.descriptionPlaceholder")}
              disabled={isLoading}
              rows={3}
              {...register("description")}
            />
          </div>

          <DialogFooter className="pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
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
      </DialogContent>
    </Dialog>
  );
}
