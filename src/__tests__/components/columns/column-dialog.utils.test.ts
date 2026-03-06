import { describe, expect, it } from "vitest";
import { t } from "@/lib/i18n";
import {
  createColumnSchema,
  getColumnMutationErrorMessage,
  getDeleteColumnDescription,
} from "@/components/columns/column-dialog.utils";

describe("column-dialog utils", () => {
  it("returns the localized validation message when the column title is empty", () => {
    const result = createColumnSchema().safeParse({ title: "" });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      t("columns.columnTitleRequired"),
    );
  });

  it("falls back to localized mutation errors when the API omits one", () => {
    expect(getColumnMutationErrorMessage({}, "failedToCreate")).toBe(
      t("columns.failedToCreate"),
    );
    expect(getColumnMutationErrorMessage(null, "failedToUpdate")).toBe(
      t("columns.failedToUpdate"),
    );
    expect(getColumnMutationErrorMessage(undefined, "failedToDelete")).toBe(
      t("columns.failedToDelete"),
    );
  });

  it("returns the localized delete description for empty and populated columns", () => {
    expect(getDeleteColumnDescription("Backlog", 0)).toBe(
      t("columns.deleteColumnEmpty", { title: "Backlog" }),
    );
    expect(getDeleteColumnDescription("Backlog", 3)).toBe(
      t("columns.deleteColumnWithCards", { title: "Backlog", count: "3" }),
    );
  });
});
