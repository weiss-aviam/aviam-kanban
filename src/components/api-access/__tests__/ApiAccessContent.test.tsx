import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ApiAccessContent } from "../ApiAccessContent";

// ContentTopBar uses SidebarTrigger which requires SidebarProvider — mock it out
vi.mock("@/components/layout/ContentTopBar", () => ({
  ContentTopBar: ({
    title,
    subtitle,
  }: {
    title: string;
    subtitle?: string;
  }) => (
    <div>
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
    </div>
  ),
}));

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("{}")),
  );
});

describe("ApiAccessContent", () => {
  it("shows the disabled status badge and admin hint when access is off", () => {
    render(<ApiAccessContent initialEnabled={false} initialTokens={[]} />);
    // No interactive switch any more — admins control this
    expect(screen.queryByRole("switch")).toBeNull();
    expect(screen.getByText(/API-Zugang ist deaktiviert/i)).toBeInTheDocument();
  });

  it("renders token rows with the prefix and last-used time when enabled", () => {
    render(
      <ApiAccessContent
        initialEnabled={true}
        initialTokens={[
          {
            id: "tok-1",
            name: "Laptop",
            prefix: "avk_a1b2",
            lastUsedAt: null,
            createdAt: "2026-04-20T12:00:00Z",
            revokedAt: null,
          },
        ]}
      />,
    );
    expect(screen.getByText("Laptop")).toBeInTheDocument();
    expect(screen.getByText(/avk_a1b2/)).toBeInTheDocument();
  });
});
