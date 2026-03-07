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

const EDIT_CARD_DUE_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const padDateSegment = (value: number) => String(value).padStart(2, "0");

export function getEditCardDueDateInputValue(
  dueDate: EditCardDueDateValue,
): string {
  if (!dueDate) return "";

  const parsed = dueDate instanceof Date ? dueDate : new Date(dueDate);
  if (Number.isNaN(parsed.getTime())) return "";

  return `${parsed.getUTCFullYear()}-${padDateSegment(parsed.getUTCMonth() + 1)}-${padDateSegment(parsed.getUTCDate())}`;
}

export function normalizeEditCardDueDateForApi(
  dueDateInput: string,
): string | null {
  const trimmed = dueDateInput.trim();
  if (!trimmed) return null;

  const match = EDIT_CARD_DUE_DATE_PATTERN.exec(trimmed);
  if (!match) return null;

  const [, yearPart, monthPart, dayPart] = match;
  const year = Number(yearPart);
  const month = Number(monthPart);
  const day = Number(dayPart);

  const parsed = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

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
