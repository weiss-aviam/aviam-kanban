"use client";

import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Checkbox } from "../ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Save, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

interface Column {
  id: number;
  title: string;
  position: number;
}

interface SaveBoardAsTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: string;
  boardName: string;
  columns: Column[];
  onTemplateSaved?: (template: unknown) => void;
}

export function SaveBoardAsTemplateDialog({
  open,
  onOpenChange,
  boardId: _boardId,
  boardName,
  columns,
  onTemplateSaved,
}: SaveBoardAsTemplateDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const schema = z.object({
    name: z.string().min(1, "Template name is required"),
    description: z.string().optional(),
    isPublic: z.boolean().default(false),
  });
  type FormValues = z.infer<typeof schema>;
  const {
    register,
    control,
    handleSubmit: rhfHandleSubmit,
    reset,
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: `${boardName} Template`,
      description: "",
      isPublic: false,
    },
  });

  useEffect(() => {
    reset({ name: `${boardName} Template`, description: "", isPublic: false });
  }, [boardName, reset]);

  const onSubmit = async ({
    name,
    description,
    isPublic = false,
  }: FormValues) => {
    setIsLoading(true);
    setError("");

    try {
      const templateResponse = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description?.trim() || undefined,
          isPublic,
          columns: columns.map((col) => ({
            title: col.title,
            position: col.position,
          })),
        }),
      });

      if (!templateResponse.ok) {
        const errorData = await templateResponse.json();
        throw new Error(errorData.error || "Failed to save template");
      }

      const newTemplate = await templateResponse.json();
      onTemplateSaved?.(newTemplate);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save template");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    reset({ name: `${boardName} Template`, description: "", isPublic: false });
    setError("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl w-[90vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="w-5 h-5" />
            Save Board as Template
          </DialogTitle>
          <DialogDescription>
            Save the current column structure of `${boardName}` as a reusable
            template for future boards.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={rhfHandleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="template-name">Template Name</Label>
            <Input
              id="template-name"
              placeholder="Enter template name"
              disabled={isLoading}
              {...register("name")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-description">Description (Optional)</Label>
            <Textarea
              id="template-description"
              placeholder="Describe when to use this template"
              rows={3}
              disabled={isLoading}
              {...register("description")}
            />
          </div>

          <div className="space-y-3">
            <Label>Column Preview</Label>
            <div className="bg-gray-50 p-3 rounded-md">
              <div className="flex flex-wrap gap-2">
                {columns?.map((column) => (
                  <div
                    key={column.id}
                    className="bg-white px-3 py-1 rounded border text-sm"
                  >
                    {column.title}
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-600 mt-2">
                {columns?.length} column{columns?.length !== 1 ? "s" : ""} will
                be included in this template
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Controller
              name="isPublic"
              control={control}
              render={({ field }) => (
                <Checkbox
                  id="is-public"
                  checked={!!field.value}
                  onCheckedChange={(checked) =>
                    field.onChange(Boolean(checked))
                  }
                  disabled={isLoading}
                />
              )}
            />
            <Label htmlFor="is-public" className="text-sm">
              Make this template public (visible to all users)
            </Label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Template
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
