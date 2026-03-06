import { describe, expect, it } from "vitest";
import { t } from "@/lib/i18n";
import {
  getEditCardAttachmentErrorMessage,
  getEditCardDueDateInputValue,
  normalizeEditCardDueDateForApi,
} from "@/components/kanban/edit-card-dialog.utils";

describe("edit-card-dialog utils", () => {
  it("falls back to localized attachment errors when no message is present", () => {
    expect(
      getEditCardAttachmentErrorMessage({}, "failedToLoadAttachments"),
    ).toBe(t("kanban.failedToLoadAttachments"));
    expect(getEditCardAttachmentErrorMessage(null, "failedToUpload")).toBe(
      t("kanban.failedToUpload"),
    );
    expect(getEditCardAttachmentErrorMessage(undefined, "failedToDelete")).toBe(
      t("kanban.failedToDelete"),
    );
  });

  it("prefers error instance messages when available", () => {
    expect(
      getEditCardAttachmentErrorMessage(
        new Error("Upload failed"),
        "failedToUpload",
      ),
    ).toBe("Upload failed");
  });

  it("prefers object message fields when available", () => {
    expect(
      getEditCardAttachmentErrorMessage(
        { message: "Storage is unavailable" },
        "failedToLoadAttachments",
      ),
    ).toBe("Storage is unavailable");
  });

  it("formats local due dates for datetime-local inputs", () => {
    expect(getEditCardDueDateInputValue(new Date(2026, 2, 10, 14, 30))).toBe(
      "2026-03-10T14:30",
    );
  });

  it("returns an empty due date input value for missing or invalid values", () => {
    expect(getEditCardDueDateInputValue(null)).toBe("");
    expect(getEditCardDueDateInputValue("not-a-date")).toBe("");
  });

  it("normalizes datetime-local values into ISO strings for the API", () => {
    const localValue = "2026-03-10T14:30";

    expect(normalizeEditCardDueDateForApi(localValue)).toBe(
      new Date(localValue).toISOString(),
    );
    expect(normalizeEditCardDueDateForApi("")).toBeNull();
  });
});
