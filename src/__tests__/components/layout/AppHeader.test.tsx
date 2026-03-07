import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, within } from "@/__tests__/setup";
import { AppHeader } from "@/components/layout/AppHeader";

interface MockImageProps {
  alt?: string;
  className?: string;
}

interface MockLinkProps {
  children?: ReactNode;
  href?: string;
  className?: string;
}

vi.mock("next/image", () => ({
  default: ({ alt, className }: MockImageProps) => (
    <div aria-label={alt} className={className} role="img" />
  ),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, className }: MockLinkProps) => (
    <a className={className} href={typeof href === "string" ? href : "#"}>
      {children}
    </a>
  ),
}));

describe("AppHeader", () => {
  it("renders a separate top action row and bottom title row", () => {
    const { container } = render(
      <AppHeader
        title="All Boards"
        subtitle="Manage and organize your projects"
        actions={<button type="button">Menu</button>}
      />,
    );

    const headerContent = container.querySelector("header > div");

    expect(headerContent?.children.length).toBe(2);

    const [topRow, bottomRow] = Array.from(headerContent?.children ?? []);

    expect(
      within(topRow as HTMLElement).getByRole("link", { name: "Aviam" }),
    ).toHaveAttribute("href", "/dashboard");
    expect(
      within(topRow as HTMLElement).getByRole("button", { name: "Menu" }),
    ).toBeInTheDocument();
    expect(
      within(bottomRow as HTMLElement).getByRole("heading", {
        name: "All Boards",
      }),
    ).toBeInTheDocument();
    expect(
      within(bottomRow as HTMLElement).getByText(
        "Manage and organize your projects",
      ),
    ).toBeInTheDocument();
  });

  it("renders metadata-style subtitle content", () => {
    const { getByText } = render(
      <AppHeader
        title="Board"
        subtitle={
          <>
            <span>3 columns</span>
            <span>5 cards</span>
          </>
        }
      />,
    );

    expect(getByText("3 columns")).toBeInTheDocument();
    expect(getByText("5 cards")).toBeInTheDocument();
  });
});
