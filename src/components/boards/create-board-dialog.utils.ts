import { z } from "zod";
import { t } from "@/lib/i18n";

export interface CreateBoardFormValues {
  name: string;
}

export function createCreateBoardSchema() {
  return z.object({
    name: z.string().min(1, t("createBoard.nameRequired")),
  });
}

export function getCreateBoardErrorMessage(errorData: unknown): string {
  if (typeof errorData === "object" && errorData !== null) {
    const { error } = errorData as { error?: unknown };

    if (typeof error === "string" && error.trim().length > 0) {
      return error;
    }
  }

  return t("createBoard.failedToCreate");
}
