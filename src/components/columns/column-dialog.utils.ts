import { z } from "zod";
import { t } from "@/lib/i18n";

export interface ColumnFormValues {
  title: string;
}

export type ColumnMutationErrorKey =
  | "failedToCreate"
  | "failedToUpdate"
  | "failedToDelete";

export function createColumnSchema() {
  return z.object({
    title: z.string().min(1, t("columns.columnTitleRequired")),
  });
}

export function getColumnMutationErrorMessage(
  errorData: unknown,
  fallbackKey: ColumnMutationErrorKey,
): string {
  if (typeof errorData === "object" && errorData !== null) {
    const { error } = errorData as { error?: unknown };

    if (typeof error === "string" && error.trim().length > 0) {
      return error;
    }
  }

  return t(`columns.${fallbackKey}`);
}

export function getDeleteColumnDescription(
  title: string,
  cardCount: number,
): string {
  return cardCount > 0
    ? t("columns.deleteColumnWithCards", { title, count: String(cardCount) })
    : t("columns.deleteColumnEmpty", { title });
}
