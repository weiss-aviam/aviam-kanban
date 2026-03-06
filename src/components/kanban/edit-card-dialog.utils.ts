import { t } from "@/lib/i18n";

export type EditCardAttachmentErrorKey =
  | "failedToLoadAttachments"
  | "failedToUpload"
  | "failedToDelete";

const ATTACHMENT_ERROR_FALLBACKS = {
  failedToLoadAttachments: "kanban.failedToLoadAttachments",
  failedToUpload: "kanban.failedToUpload",
  failedToDelete: "kanban.failedToDelete",
} as const;

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
