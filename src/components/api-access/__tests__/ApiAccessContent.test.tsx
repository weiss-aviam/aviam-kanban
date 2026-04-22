import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.endsWith("/api/users/api-access") && init?.method === "PATCH") {
        return new Response(JSON.stringify({ ok: true, enabled: true }));
      }
      return new Response("{}");
    }),
  );
});

describe("ApiAccessContent", () => {
  it("shows the master toggle and disables token list when off", () => {
    render(<ApiAccessContent initialEnabled={false} initialTokens={[]} />);
    expect(screen.getByRole("switch")).not.toBeChecked();
    expect(screen.getByText(/API-Zugang ist deaktiviert/i)).toBeInTheDocument();
  });

  it("renders token rows with the prefix and last-used time", () => {
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

  it("PATCHes /api/users/api-access when toggle is flipped", async () => {
    const user = userEvent.setup();
    render(<ApiAccessContent initialEnabled={false} initialTokens={[]} />);
    await user.click(screen.getByRole("switch"));
    expect(fetch).toHaveBeenCalledWith(
      "/api/users/api-access",
      expect.objectContaining({ method: "PATCH" }),
    );
  });
});
