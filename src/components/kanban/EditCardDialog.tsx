"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Trash2,
  File as FileIcon,
  FileText,
  FileArchive,
  FileCode,
  FileSpreadsheet,
  FileVideo,
  FileAudio,
  Paperclip,
} from "lucide-react";
import type {
  Card,
  Column,
  User,
  Label as DatabaseLabel,
  CardPriority,
} from "@/types/database";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { PrioritySelector } from "@/components/ui/priority-selector";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";

import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

interface EditCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: Card | null; // if null => create mode
  columns: Column[];
  boardMembers: User[];
  boardLabels: DatabaseLabel[];
  currentUser: { id: string; name?: string | null; email?: string } | null;
  boardId?: string; // required for create mode
  defaultColumnId?: number; // initial column for create mode
  onCardUpdated?: (card: Card) => void;
  onCardDeleted?: (cardId: string) => void;
  onCardCreated?: (card: Card) => void;
}

export function EditCardDialog({
  open,
  onOpenChange,
  card,
  columns,
  boardMembers,
  currentUser,
  onCardUpdated,
  onCardDeleted,
  boardId,
  defaultColumnId,
  onCardCreated,
}: EditCardDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  // react-hook-form setup
  const CardFormSchema = z.object({
    title: z.string().min(1, "Title is required"),
    columnId: z.string().min(1, "Column is required"),
    description: z.string().optional().default(""),
    assigneeId: z.string().optional().default("none"),
    priority: z.enum(["high", "medium", "low"]).optional().default("medium"),
  });
  type CardFormValues = z.infer<typeof CardFormSchema>;

  const form = useForm({
    resolver: zodResolver(CardFormSchema),
    defaultValues: {
      title: "",
      description: "",
      columnId: card
        ? String(card.columnId ?? "")
        : defaultColumnId
          ? String(defaultColumnId)
          : "",
      assigneeId: currentUser?.id || "none",

      priority: (card?.priority as CardPriority) || "medium",
    },
  });
  const {
    control,
    register,
    handleSubmit: rhfHandleSubmit,
    watch,
    reset,
  } = form;

  // Comments state
  const [comments, setComments] = useState<
    Array<{
      id: number;
      body: string;
      createdAt: string;
      author: { id: string; name: string | null; email: string };
    }>
  >([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentBody, setCommentBody] = useState("");

  // Attachments state
  const [attachments, setAttachments] = useState<
    Array<{
      name: string;
      path: string;
      url: string;
      createdAt: string;
      size: number | undefined;
    }>
  >([]);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

  // Initialize form from card when editing, or defaults when creating
  useEffect(() => {
    if (card) {
      reset({
        title: card.title,
        description: card.description || "",
        columnId: card.columnId ? String(card.columnId) : "",
        assigneeId: card.assigneeId || "none",

        priority: (card.priority as CardPriority) || "medium",
      });
    } else {
      reset({
        title: "",
        description: "",
        columnId: defaultColumnId ? String(defaultColumnId) : "",
        assigneeId: currentUser?.id || "none",

        priority: "medium",
      });
    }
  }, [card, defaultColumnId, currentUser, reset]);

  // Load comments and attachments when dialog opens for an existing card
  useEffect(() => {
    const fetchComments = async () => {
      if (!open || !card) return;
      try {
        setCommentsLoading(true);
        const res = await fetch(`/api/comments?cardId=${card.id}`);
        if (res.ok) {
          const data = await res.json();
          setComments(data.comments || []);
        }
      } finally {
        setCommentsLoading(false);
      }
    };
    const fetchAttachments = async () => {
      if (!open || !card) return;
      try {
        const supabase = createSupabaseClient();
        const { data, error } = await supabase.storage
          .from("card-attachments")
          .list(card.id, {
            limit: 100,
            sortBy: { column: "created_at", order: "desc" },
          });
        if (!error && data) {
          const resolveUrl = async (path: string) => {
            const { data, error } = await supabase.storage
              .from("card-attachments")
              .download(path);
            if (error) throw error;
            return URL.createObjectURL(data);
          };
          const files = await Promise.all(
            data.map(
              async (f: {
                name: string;
                created_at: string;
                metadata?: { size?: number };
              }) => {
                const path = `${card.id}/${f.name}`;
                const url = await resolveUrl(path);
                return {
                  name: f.name,
                  path,
                  url,
                  createdAt: f.created_at,
                  size: f.metadata?.size,
                };
              },
            ),
          );
          setAttachments((prev) => {
            try {
              prev.forEach((a) => URL.revokeObjectURL(a.url));
            } catch {}
            return files;
          });
        } else if (error) {
          setError("Failed to load attachments");
        }
      } catch (_e) {
        setError("Failed to load attachments");
      }
    };
    fetchComments();
    fetchAttachments();
  }, [open, card]);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!card || !commentBody.trim()) return;
    try {
      setCommentsLoading(true);
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: card.id, body: commentBody.trim() }),
      });
      if (res.ok) {
        const created = await res.json();
        setComments((prev) => [...prev, created]);
        setCommentBody("");
      } else {
        const err = await res.json();
        setError(err.error || "Failed to add comment");
      }
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleUploadFiles = async (files: FileList | null) => {
    if (!card || !files || files.length === 0) return;
    const supabase = createSupabaseClient();
    setUploading(true);
    try {
      const filesArr = Array.from(files);
      const oversized = filesArr.filter((f) => f.size > MAX_FILE_SIZE);
      if (oversized.length > 0) {
        setError(
          `Some files exceed 10 MB and were skipped: ${oversized.map((f) => f.name).join(", ")}`,
        );
      }
      for (const file of filesArr) {
        if (file.size > MAX_FILE_SIZE) continue;
        const safeName = `${Date.now()}_${file.name}`;
        const path = `${card.id}/${safeName}`;
        const { error } = await supabase.storage
          .from("card-attachments")
          .upload(path, file, { upsert: false, cacheControl: "3600" });
        if (error) {
          setError(error.message || "Failed to upload file");
          break;
        }
      }
      // Refresh list
      const { data, error: listErr } = await supabase.storage
        .from("card-attachments")
        .list(card.id, {
          limit: 100,
          sortBy: { column: "created_at", order: "desc" },
        });
      if (listErr) {
        setError(listErr.message || "Failed to load attachments");
      } else if (data) {
        const resolveUrl = async (path: string) => {
          const { data, error } = await supabase.storage
            .from("card-attachments")
            .download(path);
          if (error) throw error;
          return URL.createObjectURL(data);
        };
        const filesOut = await Promise.all(
          data.map(
            async (f: {
              name: string;
              created_at: string;
              metadata?: { size?: number };
            }) => {
              const p = `${card.id}/${f.name}`;
              const url = await resolveUrl(p);
              return {
                name: f.name,
                path: p,
                url,
                createdAt: f.created_at,
                size: f.metadata?.size,
              };
            },
          ),
        );
        setAttachments((prev) => {
          try {
            prev.forEach((a) => URL.revokeObjectURL(a.url));
          } catch {}
          return filesOut;
        });
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to upload files");
    } finally {
      setUploading(false);
    }
  };
  // File input + drag-and-drop handlers
  const handleFileInputClick = () => fileInputRef.current?.click();
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleUploadFiles(e.currentTarget.files);
    if (e.currentTarget) e.currentTarget.value = "";
  };
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    e.dataTransfer.dropEffect = "copy";
  };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleUploadFiles(e.dataTransfer.files);
  };

  // Attachment helpers and deletion
  const imageExts = new Set([
    "png",
    "jpg",
    "jpeg",
    "gif",
    "webp",
    "bmp",
    "svg",
  ]);
  const isImageFile = (name: string) =>
    imageExts.has((name.split(".").pop() || "").toLowerCase());

  const AttachmentIcon = ({
    name,
    className = "h-10 w-10 text-muted-foreground",
  }: {
    name: string;
    className?: string;
  }) => {
    const ext = (name.split(".").pop() || "").toLowerCase();
    if (["txt", "md", "rtf", "doc", "docx", "pdf"].includes(ext))
      return <FileText className={className} />;
    if (["zip", "rar", "7z", "gz", "bz2", "tar"].includes(ext))
      return <FileArchive className={className} />;
    if (["xls", "xlsx", "csv"].includes(ext))
      return <FileSpreadsheet className={className} />;
    if (
      [
        "js",
        "ts",
        "tsx",
        "jsx",
        "json",
        "yml",
        "yaml",
        "xml",
        "html",
        "css",
        "scss",
        "py",
        "rb",
        "go",
        "rs",
        "java",
        "kt",
        "php",
        "c",
        "cpp",
        "h",
        "sh",
      ].includes(ext)
    )
      return <FileCode className={className} />;
    if (["mp4", "webm", "mov", "mkv"].includes(ext))
      return <FileVideo className={className} />;
    if (["mp3", "wav", "flac", "ogg", "m4a"].includes(ext))
      return <FileAudio className={className} />;
    return <FileIcon className={className} />;
  };

  const handleDeleteAttachment = async (path: string) => {
    if (!card) return;
    const supabase = createSupabaseClient();
    setUploading(true);
    try {
      const { error: removeErr } = await supabase.storage
        .from("card-attachments")
        .remove([path]);
      if (removeErr) {
        setError(removeErr.message || "Failed to delete file");
      }
      const { data, error: listErr } = await supabase.storage
        .from("card-attachments")
        .list(card.id, {
          limit: 100,
          sortBy: { column: "created_at", order: "desc" },
        });
      if (listErr) {
        setError(listErr.message || "Failed to load attachments");
      } else if (data) {
        const resolveUrl = async (p: string) => {
          const { data, error } = await supabase.storage
            .from("card-attachments")
            .download(p);
          if (error) throw error;
          return URL.createObjectURL(data);
        };
        const filesOut = await Promise.all(
          data.map(
            async (f: {
              name: string;
              created_at: string;
              metadata?: { size?: number };
            }) => {
              const p = `${card.id}/${f.name}`;
              const url = await resolveUrl(p);
              return {
                name: f.name,
                path: p,
                url,
                createdAt: f.created_at,
                size: f.metadata?.size,
              };
            },
          ),
        );
        setAttachments((prev) => {
          try {
            prev.forEach((a) => URL.revokeObjectURL(a.url));
          } catch {}
          return filesOut;
        });
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to delete attachment");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (values: CardFormValues) => {
    setIsLoading(true);
    setError("");

    try {
      if (card) {
        // Edit mode
        const response = await fetch(`/api/cards/${card.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: values.title.trim(),
            description: values.description.trim() || null,
            columnId: parseInt(values.columnId),
            assigneeId: values.assigneeId === "none" ? null : values.assigneeId,

            priority: values.priority,
          }),
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to update card");
        }
        const { card: updatedCard } = await response.json();
        onCardUpdated?.(updatedCard);
        handleClose();
      } else {
        // Create mode
        if (!boardId) {
          setError("Board ID is required");
          return;
        }
        const response = await fetch("/api/cards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            boardId,
            columnId: parseInt(values.columnId),
            title: values.title.trim(),
            description: values.description.trim() || null,
            assigneeId: values.assigneeId === "none" ? null : values.assigneeId,

            priority: values.priority,
          }),
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to create card");
        }
        const { card: newCard } = await response.json();
        onCardCreated?.(newCard);
        handleClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit card");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!card) return;

    setIsDeleting(true);
    setError("");

    try {
      const response = await fetch(`/api/cards/${card.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete card");
      }

      onCardDeleted?.(card.id);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete card");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    reset({
      title: "",
      description: "",
      columnId: defaultColumnId ? String(defaultColumnId) : "",
      assigneeId: currentUser?.id || "none",

      priority: "medium",
    });
    setError("");
    setAttachments((prev) => {
      try {
        prev.forEach((a) => URL.revokeObjectURL(a.url));
      } catch {}
      return [];
    });
    onOpenChange(false);
  };

  const watchedColumnId = watch("columnId");
  const selectedColumn = columns.find(
    (col) => col.id === parseInt(watchedColumnId || "0"),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-7xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{card ? "Edit Card" : "Create Card"}</DialogTitle>
          <DialogDescription>
            {card
              ? `Update card details in ${selectedColumn?.title || "the board"}`
              : `Add a new card to ${selectedColumn?.title || "the selected column"}.`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={rhfHandleSubmit(handleSubmit)} className="space-y-6">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-4 rounded-md border border-red-200">
              {error}
            </div>
          )}

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 gap-6">
            {/* Left Column */}
            <div className="space-y-6">
              <div className="space-y-3">
                <Label htmlFor="title" className="text-base font-medium">
                  Title *
                </Label>
                <Input
                  id="title"
                  placeholder="Enter card title"
                  disabled={isLoading || isDeleting}
                  required
                  className="h-11"
                  {...register("title")}
                />
              </div>

              <div className="space-y-3 flex flex-col">
                <Label htmlFor="description" className="text-base font-medium">
                  Description
                </Label>
                <Controller
                  name="description"
                  control={control}
                  render={({ field }) => (
                    <MarkdownEditor
                      value={field.value || ""}
                      onChange={field.onChange}
                      placeholder="Enter card description (supports markdown)"
                      height={200}
                      preview="live"
                      className={
                        isLoading || isDeleting
                          ? "opacity-50 pointer-events-none"
                          : ""
                      }
                    />
                  )}
                />
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              <div className="space-y-3 flex flex-col max-w-[200px]">
                <Label className="text-base font-medium">Priority</Label>
                <Controller
                  name="priority"
                  control={control}
                  render={({ field }) => (
                    <PrioritySelector
                      value={field.value as CardPriority}
                      onChange={field.onChange}
                      disabled={isLoading || isDeleting}
                      size="md"
                    />
                  )}
                />
              </div>

              <div className="space-y-3 flex flex-col max-w-[200px]">
                <Label className="text-base font-medium">Column</Label>
                <Controller
                  name="columnId"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isLoading || isDeleting}
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Select a column" />
                      </SelectTrigger>
                      <SelectContent>
                        {columns.map((column) => (
                          <SelectItem
                            key={column.id}
                            value={column.id.toString()}
                          >
                            {column.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-3 flex flex-col max-w-[200px]">
                <Label className="text-base font-medium">Assignee</Label>
                <Controller
                  name="assigneeId"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value || "none"}
                      onValueChange={field.onChange}
                      disabled={isLoading || isDeleting}
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Select an assignee (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No assignee</SelectItem>
                        {currentUser && (
                          <SelectItem
                            key={currentUser.id}
                            value={currentUser.id}
                          >
                            {currentUser.name || currentUser.email} (YOU)
                          </SelectItem>
                        )}
                        {boardMembers
                          ?.filter((member) => member.id !== currentUser?.id)
                          .map((member) => (
                            <SelectItem key={member.id} value={member.id}>
                              {member.name || member.email}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
          </div>

          {/* Comments & Attachments */}
          {card ? (
            <div className="mt-4 space-y-8">
              {/* Discussion */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">Discussion</Label>
                </div>
                <div className="space-y-3">
                  {comments.length === 0 && !commentsLoading && (
                    <div className="text-sm text-muted-foreground">
                      No comments yet.
                    </div>
                  )}
                  {comments.map((c) => (
                    <div key={c.id} className="rounded-md border p-3">
                      <div className="text-sm font-medium">
                        {c.author.name || c.author.email}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(c.createdAt).toLocaleString()}
                      </div>
                      <div className="mt-1 text-sm whitespace-pre-wrap">
                        {c.body}
                      </div>
                    </div>
                  ))}
                  <div className="flex items-start gap-2">
                    <Input
                      placeholder="Write a comment..."
                      value={commentBody}
                      onChange={(e) => setCommentBody(e.target.value)}
                      disabled={commentsLoading || isLoading || isDeleting}
                    />
                    <Button
                      type="button"
                      onClick={handleSubmitComment}
                      disabled={
                        !commentBody.trim() ||
                        commentsLoading ||
                        isLoading ||
                        isDeleting
                      }
                    >
                      {commentsLoading && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Comment
                    </Button>
                  </div>
                </div>
              </div>

              {/* Attachments */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">Attachments</Label>
                </div>
                <div
                  className={`mt-1 border-2 border-dashed rounded-md p-4 cursor-pointer text-sm flex items-center justify-center gap-2 ${isDragging ? "bg-muted/50 border-primary" : "hover:bg-muted/40"}`}
                  onClick={handleFileInputClick}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleFileInputClick();
                    }
                  }}
                  aria-label="Upload files"
                >
                  <Paperclip className="h-5 w-5 text-muted-foreground" />
                  <span>Click or drag files to upload (max 10 MB each)</span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleInputChange}
                  disabled={uploading || isLoading || isDeleting}
                  className="hidden"
                />
                {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                {attachments.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    No files uploaded.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {attachments.map((a) => (
                      <li
                        key={a.path}
                        className="flex items-center justify-between rounded border p-2"
                      >
                        <div className="flex items-center gap-3">
                          {isImageFile(a.name) ? (
                            <Image
                              src={a.url}
                              alt={a.name}
                              width={48}
                              height={48}
                              className="w-12 h-12 object-cover rounded"
                            />
                          ) : (
                            <AttachmentIcon name={a.name} />
                          )}
                          <a
                            className="text-blue-600 hover:underline"
                            href={a.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {a.name}
                          </a>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteAttachment(a.path)}
                          disabled={uploading || isLoading || isDeleting}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-4 text-sm text-muted-foreground">
              Create the card to enable comments and attachments.
            </div>
          )}

          <DialogFooter className="pt-6 border-t flex justify-between">
            {card && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isLoading || isDeleting}
              >
                {isDeleting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            )}
            <div className="flex space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isLoading || isDeleting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading || isDeleting}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {card ? "Update Card" : "Create Card"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
