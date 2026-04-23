import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  GET as listTokens,
  POST as createToken,
} from "@/app/api/api-tokens/route";
import { DELETE as revokeToken } from "@/app/api/api-tokens/[id]/route";
import { getSessionUser } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  getSessionUser: vi.fn(),
}));
vi.mock("@/lib/api-tokens/mint", () => ({
  mintToken: vi.fn(async () => ({
    token: "avk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
    row: {
      id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      name: "Laptop",
      prefix: "avk_a1b2",
      createdAt: "2026-04-21T00:00:00Z",
    },
  })),
}));

const mockSession = vi.mocked(getSessionUser);
const USER = { id: "u1" };

const supabaseMock = (impl: (table: string) => unknown) => ({
  from: vi.fn(impl),
});

const req = (path: string, method: string, body?: unknown) =>
  body !== undefined
    ? new NextRequest(`http://localhost${path}`, {
        method,
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      })
    : new NextRequest(`http://localhost${path}`, { method });

describe("API tokens routes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("GET returns the caller's tokens", async () => {
    const rows = [
      {
        id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        name: "Laptop",
        prefix: "avk_a1b2",
        last_used_at: null,
        created_at: "2026-01-01T00:00:00Z",
        revoked_at: null,
      },
    ];
    mockSession.mockResolvedValue({
      supabase: supabaseMock(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            is: vi.fn(() => ({
              order: vi.fn().mockResolvedValue({ data: rows, error: null }),
            })),
          })),
        })),
      })) as never,
      user: USER as never,
    });
    const res = await listTokens();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.tokens[0]).toMatchObject({
      id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      name: "Laptop",
    });
  });

  it("POST mints a token only when api_access_enabled is true", async () => {
    mockSession.mockResolvedValue({
      supabase: supabaseMock((t) => {
        if (t === "users") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { api_access_enabled: true },
                  error: null,
                }),
              })),
            })),
          };
        }
        return {};
      }) as never,
      user: USER as never,
    });
    const res = await createToken(
      req("/api/api-tokens", "POST", { name: "Laptop" }),
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.token).toMatch(/^avk_/);
  });

  it("POST rejects when master flag is off", async () => {
    mockSession.mockResolvedValue({
      supabase: supabaseMock(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: { api_access_enabled: false },
              error: null,
            }),
          })),
        })),
      })) as never,
      user: USER as never,
    });
    const res = await createToken(
      req("/api/api-tokens", "POST", { name: "X" }),
    );
    expect(res.status).toBe(403);
  });

  it("DELETE soft-revokes by setting revoked_at", async () => {
    const TOKEN_UUID = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
    const updateSpy = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: TOKEN_UUID },
              error: null,
            }),
          })),
        })),
      })),
    }));
    mockSession.mockResolvedValue({
      supabase: supabaseMock(() => ({ update: updateSpy })) as never,
      user: USER as never,
    });
    const res = await revokeToken(
      req(`/api/api-tokens/${TOKEN_UUID}`, "DELETE"),
      {
        params: Promise.resolve({ id: TOKEN_UUID }),
      },
    );
    expect(res.status).toBe(200);
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ revoked_at: expect.any(String) }),
    );
  });
});
