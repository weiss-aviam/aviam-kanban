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
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

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
  Pencil,
  File as FileIcon,
  FileText,
  FileArchive,
  FileCode,
  FileSpreadsheet,
  FileVideo,
  FileAudio,
  Paperclip,
  Calendar as CalendarIcon,
  X,
} from "lucide-react";
import type {
  Card,
  Column,
  User,
  Label as DatabaseLabel,
  CardPriority,
} from "@/types/database";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { PrioritySelector } from "@/components/ui/priority-selector";
import { getUserInitials, getUserAvatarColor } from "@/lib/role-colors";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";

import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { formatDisplayDate, formatDateTime } from "@/lib/date-format";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  getEditCardAttachmentErrorMessage,
  getEditCardDueDateInputValue,
  normalizeEditCardDueDateForApi,
} from "./edit-card-dialog.utils";

interface EditCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card: Card | null; // if null => create mode
  columns: Column[];
  boardMembers: User[];
  boardLabels: DatabaseLabel[];
  currentUser: {
    id: string;
    name?: string | null;
    email?: string | null;
  } | null;
  boardId?: string; // required for create mode
  defaultColumnId?: number; // initial column for create mode
  userRole?: "owner" | "admin" | "member" | "viewer";
  onCardUpdated?: (card: Card) => void;
  onCardDeleted?: (cardId: string) => void;
  onCardCreated?: (card: Card) => void;
}

type CommentItem = {
  id: string;
  body: string;
  createdAt: string;
  editedAt?: string | null;
  deletedAt?: string | null;
  author: { id: string; name: string | null; email: string };
};

type AttachmentItem = {
  name: string;
  path: string;
  url: string;
  createdAt: string;
  size: number | undefined;
};

const parseCalendarDate = (value: string | undefined): Date | undefined => {
  if (!value) return undefined;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return undefined;

  const [, yearPart, monthPart, dayPart] = match;
  const year = Number(yearPart);
  const month = Number(monthPart);
  const day = Number(dayPart);
  const parsed = new Date(year, month - 1, day);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return undefined;
  }

  return parsed;
};

const getCalendarFieldValue = (date: Date | undefined): string => {
  if (!date) return "";

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const imageExts = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"]);

const isImageFile = (name: string) =>
  imageExts.has((name.split(".").pop() || "").toLowerCase());

function AttachmentIcon({
  name,
  className = "h-8 w-8",
}: {
  name: string;
  className?: string;
}) {
  const ext = (name.split(".").pop() || "").toLowerCase();
  const baseClass = cn("text-muted-foreground", className);
  if (["txt", "md", "rtf", "doc", "docx"].includes(ext))
    return <FileText className={baseClass} />;
  if (["pdf"].includes(ext))
    return <FileText className={cn("text-red-500", className)} />;
  if (["zip", "rar", "7z", "gz", "bz2", "tar"].includes(ext))
    return <FileArchive className={baseClass} />;
  if (["xls", "xlsx", "csv"].includes(ext))
    return <FileSpreadsheet className={cn("text-green-600", className)} />;
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
    return <FileCode className={cn("text-blue-500", className)} />;
  if (["mp4", "webm", "mov", "mkv"].includes(ext))
    return <FileVideo className={cn("text-purple-500", className)} />;
  if (["mp3", "wav", "flac", "ogg", "m4a"].includes(ext))
    return <FileAudio className={cn("text-orange-500", className)} />;
  return <FileIcon className={baseClass} />;
}

function AttachmentThumbnail({
  attachment,
  onDelete,
  disabled,
}: {
  attachment: AttachmentItem;
  onDelete: (path: string) => void;
  disabled: boolean;
}) {
  const ext = (attachment.name.split(".").pop() || "").toUpperCase();
  const displayName =
    attachment.name.length > 24
      ? attachment.name.slice(0, 20) + "…" + attachment.name.slice(-6)
      : attachment.name;

  return (
    <div className="group relative flex flex-col rounded-lg border bg-muted/30 overflow-hidden hover:border-primary/50 transition-colors">
      {/* Preview area */}
      <a
        href={attachment.url}
        target="_blank"
        rel="noreferrer"
        className="block"
        tabIndex={-1}
      >
        {isImageFile(attachment.name) ? (
          <div className="relative h-24 w-full bg-muted">
            <Image
              src={attachment.url}
              alt={attachment.name}
              fill
              className="object-cover"
              sizes="200px"
            />
          </div>
        ) : (
          <div className="flex h-24 w-full items-center justify-center bg-muted/50">
            <div className="flex flex-col items-center gap-1">
              <AttachmentIcon name={attachment.name} className="h-9 w-9" />
              <span className="text-[10px] font-semibold text-muted-foreground tracking-wide">
                {ext}
              </span>
            </div>
          </div>
        )}
      </a>

      {/* Footer */}
      <div className="flex items-center gap-1 px-2.5 py-2">
        <a
          href={attachment.url}
          download={attachment.name}
          className="flex-1 min-w-0"
          title={attachment.name}
          onClick={(e) => e.stopPropagation()}
        >
          <span className="block truncate text-xs text-foreground hover:text-primary hover:underline">
            {displayName}
          </span>
        </a>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
          onClick={() => onDelete(attachment.path)}
          disabled={disabled}
          aria-label={t("kanban.deleteAttachment")}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function EditCardDialog({
  open,
  onOpenChange,
  card,
  columns,
  boardMembers,
  currentUser,
  userRole = "member",
  onCardUpdated,
  onCardDeleted,
  boardId,
  defaultColumnId,
  onCardCreated,
}: EditCardDialogProps) {
  const isViewer = userRole === "viewer";
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  // react-hook-form setup
  const CardFormSchema = z.object({
    title: z.string().min(1, t("editCard.titleRequired")),
    columnId: z.string().min(1, t("editCard.columnRequired")),
    description: z.string().optional().default(""),
    assigneeId: z.string().optional().default("none"),
    dueDate: z.string().optional().default(""),
    priority: z.enum(["high", "medium", "low"]).optional().default("medium"),
  });
  type CardFormInput = z.input<typeof CardFormSchema>;
  type CardFormValues = z.output<typeof CardFormSchema>;

  const form = useForm<CardFormInput, unknown, CardFormValues>({
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
      dueDate: getEditCardDueDateInputValue(card?.dueDate),

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
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentBody, setEditingCommentBody] = useState("");

  // Attachments state
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

  // Initialize form from card when editing, or defaults when creating.
  useEffect(() => {
    if (!open) return;
    if (card) {
      reset({
        title: card.title,
        description: card.description || "",
        columnId: card.columnId ? String(card.columnId) : "",
        assigneeId: card.assigneeId || "none",
        dueDate: getEditCardDueDateInputValue(card.dueDate),
        priority: (card.priority as CardPriority) || "medium",
      });
    } else {
      reset({
        title: "",
        description: "",
        columnId: defaultColumnId ? String(defaultColumnId) : "",
        assigneeId: currentUser?.id || "none",
        dueDate: "",
        priority: "medium",
      });
    }
  }, [open, card, defaultColumnId, currentUser, reset]);

  // Load comments and attachments when dialog opens for an existing card
  useEffect(() => {
    const fetchComments = async () => {
      if (!open || !card) return;
      try {
        setCommentsLoading(true);
        const res = await fetch(`/api/comments?cardId=${card.id}`);
        if (res.ok) {
          const data = await res.json();
          setComments(
            (data.comments || []).map(
              (c: CommentItem & { id: number | string }) => ({
                ...c,
                id: String(c.id),
              }),
            ),
          );
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
          setError(
            getEditCardAttachmentErrorMessage(error, "failedToLoadAttachments"),
          );
        }
      } catch (error: unknown) {
        setError(
          getEditCardAttachmentErrorMessage(error, "failedToLoadAttachments"),
        );
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
        setComments((prev) => [
          ...prev,
          { ...created, id: String(created.id) },
        ]);
        setCommentBody("");
      } else {
        const err = await res.json();
        setError(err.error || t("editCard.failedToAddComment"));
      }
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleStartEditComment = (comment: CommentItem) => {
    setEditingCommentId(comment.id);
    setEditingCommentBody(comment.body);
  };

  const handleSaveComment = async (commentId: string) => {
    if (!editingCommentBody.trim()) return;
    try {
      setCommentsLoading(true);
      const res = await fetch(`/api/comments/${commentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: editingCommentBody.trim() }),
      });
      if (res.ok) {
        const updated = await res.json();
        setComments((prev) =>
          prev.map((c) =>
            c.id === commentId
              ? {
                  ...c,
                  body: updated.body ?? editingCommentBody.trim(),
                  editedAt: updated.editedAt ?? new Date().toISOString(),
                }
              : c,
          ),
        );
        setEditingCommentId(null);
        setEditingCommentBody("");
      } else {
        const err = await res.json();
        setError(err.error || t("editCard.failedToEditComment"));
      }
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      setCommentsLoading(true);
      const res = await fetch(`/api/comments/${commentId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        const { deletedAt } = await res.json();
        setComments((prev) =>
          prev.map((c) =>
            c.id === commentId
              ? { ...c, deletedAt: deletedAt ?? new Date().toISOString() }
              : c,
          ),
        );
      } else {
        const err = await res.json();
        setError(err.error || t("editCard.failedToDeleteComment"));
      }
    } finally {
      setCommentsLoading(false);
    }
  };

  // Attachment refresh helper
  const refreshAttachments = async (cardId: string) => {
    const supabase = createSupabaseClient();
    const { data, error: listErr } = await supabase.storage
      .from("card-attachments")
      .list(cardId, {
        limit: 100,
        sortBy: { column: "created_at", order: "desc" },
      });
    if (listErr) {
      setError(
        getEditCardAttachmentErrorMessage(listErr, "failedToLoadAttachments"),
      );
      return;
    }
    if (!data) return;
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
          const p = `${cardId}/${f.name}`;
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
          t("kanban.fileTooLarge", {
            files: oversized.map((f) => f.name).join(", "),
          }),
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
          setError(getEditCardAttachmentErrorMessage(error, "failedToUpload"));
          break;
        }
      }
      await refreshAttachments(card.id);
    } catch (e: unknown) {
      setError(getEditCardAttachmentErrorMessage(e, "failedToUpload"));
    } finally {
      setUploading(false);
    }
  };

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

  const handleDeleteAttachment = async (path: string) => {
    if (!card) return;
    const supabase = createSupabaseClient();
    setUploading(true);
    try {
      const { error: removeErr } = await supabase.storage
        .from("card-attachments")
        .remove([path]);
      if (removeErr) {
        setError(
          getEditCardAttachmentErrorMessage(removeErr, "failedToDelete"),
        );
      }
      await refreshAttachments(card.id);
    } catch (e: unknown) {
      setError(getEditCardAttachmentErrorMessage(e, "failedToDelete"));
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (values: CardFormValues) => {
    setIsLoading(true);
    setError("");

    try {
      const dueDate = normalizeEditCardDueDateForApi(values.dueDate);
      if (values.dueDate && !dueDate) {
        throw new Error(t("editCard.invalidDueDate"));
      }

      if (card) {
        const response = await fetch(`/api/cards/${card.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: values.title.trim(),
            description: values.description.trim() || null,
            columnId: parseInt(values.columnId),
            assigneeId: values.assigneeId === "none" ? null : values.assigneeId,
            dueDate,
            priority: values.priority,
          }),
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || t("editCard.failedToUpdate"));
        }
        const { card: updatedCard } = await response.json();
        onCardUpdated?.(updatedCard);
        handleClose();
      } else {
        if (!boardId) {
          setError(t("editCard.boardIdRequired"));
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
            dueDate: dueDate || undefined,
            priority: values.priority,
          }),
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || t("editCard.failedToCreate"));
        }
        const { card: newCard } = await response.json();
        onCardCreated?.(newCard);
        handleClose();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("editCard.failedToCreate"),
      );
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
        throw new Error(errorData.error || t("editCard.failedToDelete"));
      }
      onCardDeleted?.(card.id);
      handleClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("editCard.failedToDelete"),
      );
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
      dueDate: "",
      priority: "medium",
    });
    setError("");
    setEditingCommentId(null);
    setEditingCommentBody("");
    setAttachments((prev) => {
      try {
        prev.forEach((a) => URL.revokeObjectURL(a.url));
      } catch {}
      return [];
    });
    onOpenChange(false);
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      handleClose();
      return;
    }
    onOpenChange(true);
  };

  const watchedColumnId = watch("columnId");
  const selectedColumn = columns.find(
    (col) => col.id === parseInt(watchedColumnId || "0"),
  );

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="sm:max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto p-8">
        <DialogHeader>
          <DialogTitle>
            {card ? t("editCard.titleEdit") : t("editCard.titleCreate")}
          </DialogTitle>
          <DialogDescription>
            {card
              ? t("editCard.descriptionEdit", {
                  column: selectedColumn?.title || t("editCard.theBoard"),
                })
              : t("editCard.descriptionCreate", {
                  column:
                    selectedColumn?.title || t("editCard.theSelectedColumn"),
                })}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={rhfHandleSubmit(handleSubmit)}
          className="flex flex-col gap-6 mt-2"
        >
          {isViewer && (
            <div className="text-sm text-amber-700 bg-amber-50 p-3 rounded-md border border-amber-200">
              {t("editCard.viewerReadOnly")}
            </div>
          )}
          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-4 rounded-md border border-red-200">
              {error}
            </div>
          )}

          <fieldset disabled={isViewer} className="flex flex-col gap-6">
            {/* Title + Description — grouped as card content */}
            <div className="rounded-lg border p-4 flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="title" className="text-sm font-medium">
                  {t("editCard.titleLabel")}
                </Label>
                <Input
                  id="title"
                  placeholder={t("editCard.titlePlaceholder")}
                  disabled={isLoading || isDeleting}
                  required
                  className="h-10"
                  {...register("title")}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="description" className="text-sm font-medium">
                  {t("editCard.descriptionLabel")}
                </Label>
                <Controller
                  name="description"
                  control={control}
                  render={({ field }) => (
                    <MarkdownEditor
                      value={field.value || ""}
                      onChange={field.onChange}
                      placeholder={t("editCard.descriptionPlaceholder")}
                      height={160}
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

            {/* Row 1: Priority | Column | Assignee */}
            <div className="rounded-lg border bg-muted/20 p-4">
              <div className="grid grid-cols-3 gap-5">
                {/* Priority */}
                <div className="flex flex-col gap-2">
                  <Label className="text-sm font-medium">
                    {t("editCard.priorityLabel")}
                  </Label>
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

                {/* Column */}
                <div className="flex flex-col gap-2">
                  <Label className="text-sm font-medium">
                    {t("editCard.columnLabel")}
                  </Label>
                  <Controller
                    name="columnId"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={isLoading || isDeleting}
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue
                            placeholder={t("editCard.columnPlaceholder")}
                          />
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

                {/* Assignee */}
                <div className="flex flex-col gap-2">
                  <Label className="text-sm font-medium">
                    {t("editCard.assigneeLabel")}
                  </Label>
                  <Controller
                    name="assigneeId"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value || "none"}
                        onValueChange={field.onChange}
                        disabled={isLoading || isDeleting}
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue
                            placeholder={t("editCard.assigneePlaceholder")}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">
                            {t("editCard.noAssignee")}
                          </SelectItem>
                          {currentUser && (
                            <SelectItem
                              key={currentUser.id}
                              value={currentUser.id}
                            >
                              <div className="flex items-center gap-2">
                                <Avatar className="h-5 w-5 shrink-0">
                                  {(
                                    currentUser as { avatarUrl?: string | null }
                                  ).avatarUrl ? (
                                    <AvatarImage
                                      src={
                                        (
                                          currentUser as {
                                            avatarUrl?: string | null;
                                          }
                                        ).avatarUrl!
                                      }
                                      alt={currentUser.name || ""}
                                    />
                                  ) : null}
                                  <AvatarFallback
                                    className={`${getUserAvatarColor()} text-[10px] font-semibold text-white`}
                                  >
                                    {getUserInitials(
                                      currentUser.name || "",
                                      currentUser.email || "",
                                    )}
                                  </AvatarFallback>
                                </Avatar>
                                <span>
                                  {currentUser.name || currentUser.email} (
                                  {t("boardDetail.you")})
                                </span>
                              </div>
                            </SelectItem>
                          )}
                          {boardMembers
                            ?.filter((member) => member.id !== currentUser?.id)
                            .map((member) => (
                              <SelectItem key={member.id} value={member.id}>
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-5 w-5 shrink-0">
                                    {member.avatarUrl ? (
                                      <AvatarImage
                                        src={member.avatarUrl}
                                        alt={member.name || ""}
                                      />
                                    ) : null}
                                    <AvatarFallback
                                      className={`${getUserAvatarColor()} text-[10px] font-semibold text-white`}
                                    >
                                      {getUserInitials(
                                        member.name || "",
                                        member.email || "",
                                      )}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span>{member.name || member.email}</span>
                                </div>
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>
            </div>

            {/* Row 2 + Row 3: only in edit mode */}
            {card ? (
              <>
                {/* Row 2: Due Date | Attachments */}
                <div className="rounded-lg border bg-muted/20 p-4">
                  <div className="grid grid-cols-2 gap-6">
                    {/* Due Date */}
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="dueDate" className="text-sm font-medium">
                        {t("editCard.dueDateLabel")}
                      </Label>
                      <Controller
                        name="dueDate"
                        control={control}
                        render={({ field }) => {
                          const selectedDate = parseCalendarDate(field.value);
                          return (
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2">
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button
                                      id="dueDate"
                                      type="button"
                                      variant="outline"
                                      disabled={isLoading || isDeleting}
                                      className={cn(
                                        "h-10 flex-1 justify-start text-left font-normal",
                                        !selectedDate &&
                                          "text-muted-foreground",
                                      )}
                                    >
                                      <CalendarIcon className="h-4 w-4" />
                                      <span>
                                        {selectedDate
                                          ? formatDisplayDate(selectedDate)
                                          : t("editCard.dueDatePlaceholder")}
                                      </span>
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent
                                    className="w-auto p-0"
                                    align="start"
                                  >
                                    <Calendar
                                      mode="single"
                                      selected={selectedDate}
                                      onSelect={(date) =>
                                        field.onChange(
                                          getCalendarFieldValue(date),
                                        )
                                      }
                                      disabled={isLoading || isDeleting}
                                      initialFocus
                                    />
                                  </PopoverContent>
                                </Popover>
                                {field.value ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    disabled={isLoading || isDeleting}
                                    onClick={() => field.onChange("")}
                                    aria-label={t("editCard.clearDueDate")}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                ) : null}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {t("editCard.dueDateHelper")}
                              </p>
                            </div>
                          );
                        }}
                      />
                    </div>

                    {/* Attachments */}
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">
                          {t("editCard.attachments")}
                        </Label>
                        {uploading && (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                        )}
                      </div>
                      {/* Drop zone */}
                      <div
                        className={`border-2 border-dashed rounded-md p-3 cursor-pointer text-sm flex items-center justify-center gap-2 transition-colors ${
                          isDragging
                            ? "bg-muted/50 border-primary"
                            : "hover:bg-muted/40"
                        }`}
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
                        aria-label={t("kanban.uploadFile")}
                      >
                        <Paperclip className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground text-xs">
                          {t("editCard.uploadHint")}
                        </span>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        onChange={handleInputChange}
                        disabled={uploading || isLoading || isDeleting}
                        className="hidden"
                      />
                      {/* Attachment grid */}
                      {attachments.length > 0 ? (
                        <div className="grid grid-cols-2 gap-2 mt-1">
                          {attachments.map((a) => (
                            <AttachmentThumbnail
                              key={a.path}
                              attachment={a}
                              onDelete={handleDeleteAttachment}
                              disabled={uploading || isLoading || isDeleting}
                            />
                          ))}
                        </div>
                      ) : (
                        !uploading && (
                          <p className="text-xs text-muted-foreground">
                            {t("editCard.noFiles")}
                          </p>
                        )
                      )}
                    </div>
                  </div>
                </div>

                {/* Row 3: Discussion */}
                <div className="space-y-4 pt-6 border-t">
                  <Label className="text-sm font-medium">
                    {t("editCard.discussion")}
                  </Label>

                  {/* Comment list */}
                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                    {commentsLoading && comments.length === 0 && (
                      <div className="flex justify-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    )}
                    {!commentsLoading && comments.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        {t("editCard.noComments")}
                      </p>
                    )}
                    {comments.map((c) => {
                      const isOwn = currentUser?.id === c.author.id;
                      const isEditing = editingCommentId === c.id;
                      const isDeleted = !!c.deletedAt;

                      return (
                        <div
                          key={c.id}
                          className={`group flex gap-3 rounded-lg border p-4 ${isDeleted ? "bg-muted/10 opacity-60" : "bg-muted/20"}`}
                        >
                          {/* Avatar */}
                          <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                            <AvatarFallback
                              className={`${getUserAvatarColor()} text-[10px] font-semibold text-white`}
                            >
                              {getUserInitials(
                                c.author.name || "",
                                c.author.email,
                              )}
                            </AvatarFallback>
                          </Avatar>

                          <div className="flex-1 min-w-0">
                            {/* Header */}
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="text-sm font-medium leading-none">
                                {c.author.name || c.author.email}
                                {isOwn && (
                                  <span className="ml-1 text-xs text-muted-foreground font-normal">
                                    ({t("boardDetail.you")})
                                  </span>
                                )}
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                <span className="text-xs text-muted-foreground">
                                  {formatDateTime(c.createdAt)}
                                </span>
                                {isOwn && !isViewer && !isDeleted && (
                                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={() => handleStartEditComment(c)}
                                      disabled={commentsLoading}
                                      aria-label={t("common.edit")}
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 hover:text-destructive"
                                      onClick={() => handleDeleteComment(c.id)}
                                      disabled={commentsLoading}
                                      aria-label={t("common.delete")}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Body, deleted notice, or inline editor */}
                            {isDeleted ? (
                              <p className="mt-1.5 text-sm italic text-muted-foreground">
                                {t("editCard.commentDeleted")} ·{" "}
                                {formatDateTime(c.deletedAt!)}
                              </p>
                            ) : isEditing ? (
                              <div className="mt-2 space-y-2">
                                <Textarea
                                  value={editingCommentBody}
                                  onChange={(e) =>
                                    setEditingCommentBody(e.target.value)
                                  }
                                  rows={3}
                                  className="text-sm resize-none"
                                  autoFocus
                                />
                                <div className="flex gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => handleSaveComment(c.id)}
                                    disabled={
                                      commentsLoading ||
                                      !editingCommentBody.trim()
                                    }
                                  >
                                    {commentsLoading && (
                                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                    )}
                                    {t("common.save")}
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setEditingCommentId(null);
                                      setEditingCommentBody("");
                                    }}
                                  >
                                    {t("common.cancel")}
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div>
                                <p className="mt-1.5 text-sm whitespace-pre-wrap break-words">
                                  {c.body}
                                </p>
                                {c.editedAt && (
                                  <p className="mt-1 text-xs text-muted-foreground italic">
                                    {t("editCard.commentEdited")} ·{" "}
                                    {formatDateTime(c.editedAt)}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* New comment input */}
                  {!isViewer && (
                    <div className="flex items-start gap-3 pt-2">
                      <Input
                        placeholder={t("editCard.commentPlaceholder")}
                        value={commentBody}
                        onChange={(e) => setCommentBody(e.target.value)}
                        disabled={commentsLoading || isLoading || isDeleting}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            void handleSubmitComment(
                              e as unknown as React.FormEvent,
                            );
                          }
                        }}
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleSubmitComment}
                        disabled={
                          !commentBody.trim() ||
                          commentsLoading ||
                          isLoading ||
                          isDeleting
                        }
                      >
                        {commentsLoading && (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        )}
                        {t("editCard.commentButton")}
                      </Button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* Create mode: just due date */
              <div className="flex flex-col gap-2 max-w-xs">
                <Label htmlFor="dueDateCreate" className="text-sm font-medium">
                  {t("editCard.dueDateLabel")}
                </Label>
                <Controller
                  name="dueDate"
                  control={control}
                  render={({ field }) => {
                    const selectedDate = parseCalendarDate(field.value);
                    return (
                      <div className="flex items-center gap-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              id="dueDateCreate"
                              type="button"
                              variant="outline"
                              disabled={isLoading || isDeleting}
                              className={cn(
                                "h-10 flex-1 justify-start text-left font-normal",
                                !selectedDate && "text-muted-foreground",
                              )}
                            >
                              <CalendarIcon className="h-4 w-4" />
                              <span>
                                {selectedDate
                                  ? formatDisplayDate(selectedDate)
                                  : t("editCard.dueDatePlaceholder")}
                              </span>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={selectedDate}
                              onSelect={(date) =>
                                field.onChange(getCalendarFieldValue(date))
                              }
                              disabled={isLoading || isDeleting}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        {field.value ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={isLoading || isDeleting}
                            onClick={() => field.onChange("")}
                            aria-label={t("editCard.clearDueDate")}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    );
                  }}
                />
              </div>
            )}
          </fieldset>

          <DialogFooter className="pt-6 border-t flex justify-between">
            {card && !isViewer && (
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
                {t("common.delete")}
              </Button>
            )}
            <div className="flex space-x-2 ml-auto">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isLoading || isDeleting}
              >
                {isViewer ? t("common.close") : t("common.cancel")}
              </Button>
              {!isViewer && (
                <Button type="submit" disabled={isLoading || isDeleting}>
                  {isLoading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {card ? t("editCard.updateCard") : t("editCard.createCard")}
                </Button>
              )}
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
