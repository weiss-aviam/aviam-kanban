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

  it("formats stored due dates for date-only inputs without timezone drift", () => {
    expect(
      getEditCardDueDateInputValue(
        new Date(Date.UTC(2026, 2, 10, 23, 59, 59, 999)),
      ),
    ).toBe("2026-03-10");
    expect(getEditCardDueDateInputValue("2026-03-10T23:59:59.999Z")).toBe(
      "2026-03-10",
    );
  });

  it("returns an empty due date input value for missing or invalid values", () => {
    expect(getEditCardDueDateInputValue(null)).toBe("");
    expect(getEditCardDueDateInputValue("not-a-date")).toBe("");
  });

  it("normalizes date-only values into end-of-day UTC ISO strings for the API", () => {
    expect(normalizeEditCardDueDateForApi("2026-03-10")).toBe(
      "2026-03-10T23:59:59.999Z",
    );
    expect(normalizeEditCardDueDateForApi("2026-02-30")).toBeNull();
    expect(normalizeEditCardDueDateForApi("")).toBeNull();
  });
});
