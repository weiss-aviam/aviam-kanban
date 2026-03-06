import { t } from "@/lib/i18n";

export type EditCardAttachmentErrorKey =
  | "failedToLoadAttachments"
  | "failedToUpload"
  | "failedToDelete";

type EditCardDueDateValue = Date | string | null | undefined;

const ATTACHMENT_ERROR_FALLBACKS = {
  failedToLoadAttachments: "kanban.failedToLoadAttachments",
  failedToUpload: "kanban.failedToUpload",
  failedToDelete: "kanban.failedToDelete",
} as const;

const padDateSegment = (value: number) => String(value).padStart(2, "0");

export function getEditCardDueDateInputValue(
  dueDate: EditCardDueDateValue,
): string {
  if (!dueDate) return "";

  const parsed = dueDate instanceof Date ? dueDate : new Date(dueDate);
  if (Number.isNaN(parsed.getTime())) return "";

  return `${parsed.getFullYear()}-${padDateSegment(parsed.getMonth() + 1)}-${padDateSegment(parsed.getDate())}T${padDateSegment(parsed.getHours())}:${padDateSegment(parsed.getMinutes())}`;
}

export function normalizeEditCardDueDateForApi(
  dueDateInput: string,
): string | null {
  const trimmed = dueDateInput.trim();
  if (!trimmed) return null;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed.toISOString();
}

export function getEditCardAttachmentErrorMessage(
  errorLike: unknown,
  fallbackKey: EditCardAttachmentErrorKey,
): string {
  if (errorLike instanceof Error && errorLike.message.trim().length > 0) {
    return errorLike.message;
  }

  if (typeof errorLike === "object" && errorLike !== null) {
    const { message } = errorLike as { message?: unknown };

    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }

  return t(ATTACHMENT_ERROR_FALLBACKS[fallbackKey]);
}
