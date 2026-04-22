import { describe, it, expect, vi, beforeEach } from "vitest";
import { withIdempotency } from "../idempotency";

const supabaseMock = (
  existing: { status: number; response: unknown } | null,
) => ({
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          gt: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: existing
                ? { status: existing.status, response: existing.response }
                : null,
              error: null,
            }),
          })),
        })),
      })),
    })),
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
  })),
});

describe("withIdempotency", () => {
  beforeEach(() => vi.clearAllMocks());

  it("runs handler and stores result on first call", async () => {
    const supabase = supabaseMock(null);
    const handler = vi
      .fn()
      .mockResolvedValue({ status: 201, body: { ok: true } });

    const out = await withIdempotency(
      { tokenId: "t1", key: "k1", supabase: supabase as never },
      handler,
    );

    expect(handler).toHaveBeenCalledOnce();
    expect(out).toEqual({ status: 201, body: { ok: true } });
    expect(supabase.from).toHaveBeenCalledWith("api_idempotency_keys");
  });

  it("returns stored response and skips handler on replay", async () => {
    const supabase = supabaseMock({
      status: 201,
      response: { ok: true, replayed: true },
    });
    const handler = vi.fn();

    const out = await withIdempotency(
      { tokenId: "t1", key: "k1", supabase: supabase as never },
      handler,
    );

    expect(handler).not.toHaveBeenCalled();
    expect(out).toEqual({ status: 201, body: { ok: true, replayed: true } });
  });

  it("does nothing when no key is provided", async () => {
    const supabase = supabaseMock(null);
    const handler = vi
      .fn()
      .mockResolvedValue({ status: 201, body: { ok: true } });

    const out = await withIdempotency(
      { tokenId: "t1", key: null, supabase: supabase as never },
      handler,
    );

    expect(handler).toHaveBeenCalledOnce();
    expect(supabase.from).not.toHaveBeenCalled();
    expect(out).toEqual({ status: 201, body: { ok: true } });
  });
});
