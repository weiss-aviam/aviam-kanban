import { describe, expect, it } from "vitest";
import { t } from "@/lib/i18n";
import { getEditCardAttachmentErrorMessage } from "@/components/kanban/edit-card-dialog.utils";

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
});
