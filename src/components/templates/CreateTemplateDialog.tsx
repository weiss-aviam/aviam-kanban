"use client";

import { useState } from "react";
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
  DialogTrigger,
} from "../ui/dialog";
import { Plus, Loader2, X, GripVertical } from "lucide-react";
import { Card } from "../ui/card";

import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

interface ColumnConfig {
  id: string;
  title: string;
  position: number;
}

interface CreateTemplateDialogProps {
  onTemplateCreated?: (template: unknown) => void;
  trigger?: React.ReactNode;
  initialColumns?: { title: string }[];
}

export function CreateTemplateDialog({
  onTemplateCreated,
  trigger,
  initialColumns = [],
}: CreateTemplateDialogProps) {
  const [open, setOpen] = useState(false);
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    if (initialColumns.length > 0) {
      return initialColumns.map((col, index) => ({
        id: `col-${index}`,
        title: col.title,
        position: index + 1,
      }));
    }
    return [
      { id: "col-1", title: "To Do", position: 1 },
      { id: "col-2", title: "In Progress", position: 2 },
      { id: "col-3", title: "Done", position: 3 },
    ];
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const addColumn = () => {
    const newColumn: ColumnConfig = {
      id: `col-${Date.now()}`,
      title: "",
      position: columns.length + 1,
    };
    setColumns([...columns, newColumn]);
  };

  const removeColumn = (id: string) => {
    if (columns.length <= 1) return; // Keep at least one column
    setColumns(columns.filter((col) => col.id !== id));
  };

  const updateColumn = (id: string, title: string) => {
    setColumns(columns.map((col) => (col.id === id ? { ...col, title } : col)));
  };

  const moveColumn = (id: string, direction: "up" | "down") => {
    const index = columns.findIndex((col) => col.id === id);
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === columns.length - 1)
    ) {
      return;
    }

    const newColumns = [...columns];
    const targetIndex = direction === "up" ? index - 1 : index + 1;

    // Ensure both indices are valid
    if (newColumns[index] && newColumns[targetIndex]) {
      [newColumns[index], newColumns[targetIndex]] = [
        newColumns[targetIndex],
        newColumns[index],
      ];
    }

    // Update positions
    newColumns.forEach((col, idx) => {
      col.position = idx + 1;
    });

    setColumns(newColumns);
  };

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
    defaultValues: { name: "", description: "", isPublic: false },
  });

  const onSubmit = async ({
    name,
    description,
    isPublic = false,
  }: FormValues) => {
    const validColumns = columns.filter((col) => col.title.trim());
    if (validColumns.length === 0) {
      setError("At least one column with a title is required");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description?.trim() || undefined,
          isPublic,
          columns: validColumns.map((col) => ({
            title: col.title.trim(),
            position: col.position,
          })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create template");
      }

      const { template } = await response.json();

      // Reset form
      reset({ name: "", description: "", isPublic: false });
      setColumns([
        { id: "col-1", title: "To Do", position: 1 },
        { id: "col-2", title: "In Progress", position: 2 },
        { id: "col-3", title: "Done", position: 3 },
      ]);
      setOpen(false);

      if (onTemplateCreated) onTemplateCreated(template);
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
      Create Template
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger || defaultTrigger}</DialogTrigger>
      <DialogContent className="sm:max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Column Template</DialogTitle>
          <DialogDescription>
            Save your column configuration as a template for future boards.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={rhfHandleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Template Name</Label>
              <Input
                id="name"
                placeholder="Enter template name..."
                disabled={isLoading}
                autoFocus
                {...register("name")}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                placeholder="Describe when to use this template..."
                disabled={isLoading}
                rows={2}
                {...register("description")}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Controller
                name="isPublic"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    id="isPublic"
                    checked={!!field.value}
                    onCheckedChange={(checked) =>
                      field.onChange(Boolean(checked))
                    }
                    disabled={isLoading}
                  />
                )}
              />
              <Label htmlFor="isPublic" className="text-sm">
                Make this template public (others can use it)
              </Label>
            </div>

            <div className="space-y-2">
              <Label>Columns</Label>
              <div className="space-y-2">
                {columns.map((column, index) => (
                  <Card key={column.id} className="p-3">
                    <div className="flex items-center space-x-2">
                      <div className="flex flex-col space-y-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-4 w-4 p-0"
                          onClick={() => moveColumn(column.id, "up")}
                          disabled={index === 0 || isLoading}
                        >
                          ↑
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-4 w-4 p-0"
                          onClick={() => moveColumn(column.id, "down")}
                          disabled={index === columns.length - 1 || isLoading}
                        >
                          ↓
                        </Button>
                      </div>
                      <GripVertical className="w-4 h-4 text-gray-400" />
                      <Input
                        value={column.title}
                        onChange={(e) =>
                          updateColumn(column.id, e.target.value)
                        }
                        placeholder={`Column ${index + 1} title...`}
                        disabled={isLoading}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeColumn(column.id)}
                        disabled={columns.length <= 1 || isLoading}
                        className="h-8 w-8 p-0"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={addColumn}
                disabled={isLoading}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Column
              </Button>
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
                  Create Template
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
