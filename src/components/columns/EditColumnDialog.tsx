"use client";

import { useState, useEffect } from "react";
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
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAppActions, useAppState } from "@/store";
import type { Column } from "@/types/database";

interface EditColumnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  column: Column | null;
}

const schema = z.object({
  title: z.string().min(1, "Column title is required"),
});

type FormValues = z.infer<typeof schema>;

export function EditColumnDialog({
  open,
  onOpenChange,
  column,
}: EditColumnDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const { updateColumn, setError: setGlobalError } = useAppActions();
  const { currentBoard } = useAppState();

  const {
    register,
    handleSubmit: rhfHandleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: column?.title || "",
    },
  });

  // Reset form when column changes
  useEffect(() => {
    if (column) {
      reset({ title: column.title });
    }
  }, [column, reset]);

  const onSubmit = async (data: FormValues) => {
    if (!column) return;

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/columns/${column.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: data.title,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update column");
      }

      const updatedColumn = await response.json();

      // Get existing cards from the store to preserve them
      const existingColumn = currentBoard?.columns.find(
        (col) => col.id === column.id,
      );
      const cards = existingColumn?.cards || [];

      // Update the store immediately with cards preserved
      updateColumn({
        ...updatedColumn,
        cards,
      });

      // Close dialog and reset form
      onOpenChange(false);
      reset();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to update column";
      setError(errorMessage);
      setGlobalError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (!column) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Column</DialogTitle>
          <DialogDescription>Update the column title.</DialogDescription>
        </DialogHeader>
        <form onSubmit={rhfHandleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Column Title</Label>
              <Input
                id="title"
                placeholder="Enter column title..."
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
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
