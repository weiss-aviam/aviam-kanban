import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ViaApiBadge } from "@/components/ui/ViaApiBadge";
import { t } from "@/lib/i18n";

describe("ViaApiBadge", () => {
  it("renders the badge text from i18n", () => {
    render(<ViaApiBadge />);
    expect(screen.getByText(t("apiAccess.viaApiBadge"))).toBeInTheDocument();
  });

  it("has the correct title attribute from i18n", () => {
    render(<ViaApiBadge />);
    const badge = screen.getByTitle(t("apiAccess.viaApiBadgeTitle"));
    expect(badge).toBeInTheDocument();
  });
});
