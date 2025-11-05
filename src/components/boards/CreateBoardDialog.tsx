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
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Board } from "@/types/database";

import { TemplateSelector } from "../templates/TemplateSelector";

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

  const schema = z.object({
    name: z.string().min(1, "Board name is required"),
  });
  type FormValues = z.infer<typeof schema>;
  const {
    register,
    handleSubmit: rhfHandleSubmit,
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "" },
  });

  const onSubmit = async ({ name }: FormValues) => {
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
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create board");
      }

      const { board } = await response.json();

      // Reset form
      reset({ name: "" });
      setSelectedTemplateId(undefined);
      setOpen(false);

      // Notify parent component
      if (onBoardCreated) {
        onBoardCreated(board);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const defaultTrigger = (
    <Button>
      <Plus className="w-4 h-4 mr-2" />
      Create Board
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger || defaultTrigger}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl w-[90vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Board</DialogTitle>
          <DialogDescription>
            Create a new Kanban board to organize your project tasks.
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
                Board Name
              </Label>
              <Input
                id="name"
                placeholder="Enter board name..."
                disabled={isLoading}
                autoFocus
                className="h-11"
                {...register("name")}
              />
            </div>

            <div className="space-y-3">
              <Label className="text-base font-medium">
                Template (Optional)
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
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Board
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
