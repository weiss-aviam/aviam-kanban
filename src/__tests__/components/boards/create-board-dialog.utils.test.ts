import { describe, expect, it } from "vitest";
import { t } from "@/lib/i18n";
import {
  createCreateBoardSchema,
  getCreateBoardErrorMessage,
} from "@/components/boards/create-board-dialog.utils";

describe("create-board-dialog utils", () => {
  it("returns the localized validation message when the board name is empty", () => {
    const result = createCreateBoardSchema().safeParse({ name: "" });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      t("createBoard.nameRequired"),
    );
  });

  it("falls back to the localized create-board error when the API omits one", () => {
    expect(getCreateBoardErrorMessage({})).toBe(
      t("createBoard.failedToCreate"),
    );
    expect(getCreateBoardErrorMessage(null)).toBe(
      t("createBoard.failedToCreate"),
    );
  });

  it("prefers the API error message when one is provided", () => {
    expect(getCreateBoardErrorMessage({ error: "Board creation failed" })).toBe(
      "Board creation failed",
    );
  });
});
