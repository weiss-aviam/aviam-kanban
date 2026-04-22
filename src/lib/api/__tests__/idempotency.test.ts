import { describe, it, expect, vi, beforeEach } from "vitest";
import { withIdempotency } from "../idempotency";

const adminMock = (existing: { status: number; response: unknown } | null) => ({
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
    delete: vi.fn(() => ({
      lt: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  })),
});

describe("withIdempotency", () => {
  beforeEach(() => vi.clearAllMocks());

  it("runs handler and stores result on first call", async () => {
    const admin = adminMock(null);
    const handler = vi
      .fn()
      .mockResolvedValue({ status: 201, body: { ok: true } });

    const out = await withIdempotency(
      { tokenId: "t1", key: "k1", adminClient: admin as never },
      handler,
    );

    expect(handler).toHaveBeenCalledOnce();
    expect(out).toEqual({ status: 201, body: { ok: true } });
    expect(admin.from).toHaveBeenCalledWith("api_idempotency_keys");
  });

  it("returns stored response and skips handler on replay", async () => {
    const admin = adminMock({
      status: 201,
      response: { ok: true, replayed: true },
    });
    const handler = vi.fn();

    const out = await withIdempotency(
      { tokenId: "t1", key: "k1", adminClient: admin as never },
      handler,
    );

    expect(handler).not.toHaveBeenCalled();
    expect(out).toEqual({ status: 201, body: { ok: true, replayed: true } });
  });

  it("does nothing when no key is provided", async () => {
    const admin = adminMock(null);
    const handler = vi
      .fn()
      .mockResolvedValue({ status: 201, body: { ok: true } });

    const out = await withIdempotency(
      { tokenId: "t1", key: null, adminClient: admin as never },
      handler,
    );

    expect(handler).toHaveBeenCalledOnce();
    expect(admin.from).not.toHaveBeenCalled();
    expect(out).toEqual({ status: 201, body: { ok: true } });
  });
});
