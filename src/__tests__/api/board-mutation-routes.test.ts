import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as createCard } from "@/app/api/cards/route";
import {
  PATCH as updateCard,
  DELETE as deleteCard,
} from "@/app/api/cards/[id]/route";
import { POST as bulkUpdateCards } from "@/app/api/cards/bulk-update/route";
import { POST as bulkReorderCards } from "@/app/api/cards/bulk-reorder/route";
import { POST as createColumn } from "@/app/api/columns/route";
import {
  PATCH as updateColumn,
  DELETE as deleteColumn,
} from "@/app/api/columns/[id]/route";
import { POST as bulkUpdateColumns } from "@/app/api/columns/bulk-update/route";
import { createClient } from "@/lib/supabase/server";
import {
  getBoardMutationAuthorization,
  getBoardRoleForUser,
} from "@/lib/board-access";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/board-access", () => ({
  getBoardMutationAuthorization: vi.fn(),
  getBoardRoleForUser: vi.fn(),
}));

const BOARD_ID = "11111111-1111-4111-8111-111111111111";
const CARD_ID = "22222222-2222-4222-8222-222222222222";
const AUTH_USER = { id: "33333333-3333-4333-8333-333333333333" };

const mockCreateClient = vi.mocked(createClient);
const mockGetBoardMutationAuthorization = vi.mocked(
  getBoardMutationAuthorization,
);
const mockGetBoardRoleForUser = vi.mocked(getBoardRoleForUser);

const buildRequest = (path: string, method: string, body?: unknown) =>
  body !== undefined
    ? new NextRequest(`http://localhost:3000${path}`, {
        method,
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      })
    : new NextRequest(`http://localhost:3000${path}`, { method });

const createSupabaseMock = (
  fromImplementation: (table: string) => unknown,
) => ({
  auth: {
    getUser: vi.fn().mockResolvedValue({
      data: { user: AUTH_USER },
      error: null,
    }),
  },
  from: vi.fn(fromImplementation),
});

describe("board mutation routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetBoardMutationAuthorization.mockResolvedValue({
      ok: false,
      status: 403,
      error: "Insufficient permissions",
    });
    mockGetBoardRoleForUser.mockResolvedValue("viewer");
  });

  it("rejects viewer card creation", async () => {
    const supabase = createSupabaseMock(() => {
      throw new Error(
        "from() should not be called before authorization rejection",
      );
    });
    mockCreateClient.mockResolvedValue(supabase as never);

    const response = await createCard(
      buildRequest("/api/cards", "POST", {
        boardId: BOARD_ID,
        columnId: 1,
        title: "New card",
        priority: "medium",
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Insufficient permissions",
    });
    expect(mockGetBoardMutationAuthorization).toHaveBeenCalledWith(
      supabase,
      BOARD_ID,
      AUTH_USER.id,
    );
  });

  it("rejects viewer card updates and deletes", async () => {
    const cardsTable = {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { id: CARD_ID, board_id: BOARD_ID, column_id: 1 },
            error: null,
          }),
        })),
      })),
      delete: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
    };
    const supabase = createSupabaseMock((table) => {
      if (table === "cards") return cardsTable;
      throw new Error(`Unexpected table: ${table}`);
    });
    mockCreateClient.mockResolvedValue(supabase as never);

    const patchResponse = await updateCard(
      buildRequest(`/api/cards/${CARD_ID}`, "PATCH", { title: "Updated" }),
      {
        params: Promise.resolve({ id: CARD_ID }),
      },
    );
    const deleteResponse = await deleteCard(
      buildRequest(`/api/cards/${CARD_ID}`, "DELETE"),
      {
        params: Promise.resolve({ id: CARD_ID }),
      },
    );

    expect(patchResponse.status).toBe(403);
    await expect(patchResponse.json()).resolves.toEqual({
      error: "Insufficient permissions",
    });
    expect(deleteResponse.status).toBe(403);
    await expect(deleteResponse.json()).resolves.toEqual({
      error: "Insufficient permissions",
    });
  });

  it("rejects viewer card bulk updates and reorders", async () => {
    const cards = [{ id: CARD_ID, board_id: BOARD_ID }];
    const columns = [{ id: 1, board_id: BOARD_ID }];
    const cardsTable = {
      select: vi.fn(() => ({
        in: vi.fn().mockResolvedValue({ data: cards, error: null }),
      })),
      update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
    };
    const columnsTable = {
      select: vi.fn(() => ({
        in: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ data: columns, error: null }),
        })),
      })),
    };
    const supabase = createSupabaseMock((table) => {
      if (table === "cards") return cardsTable;
      if (table === "columns") return columnsTable;
      throw new Error(`Unexpected table: ${table}`);
    });
    mockCreateClient.mockResolvedValue(supabase as never);

    const bulkUpdateResponse = await bulkUpdateCards(
      buildRequest("/api/cards/bulk-update", "POST", {
        updates: [{ id: CARD_ID, columnId: 1, position: 1 }],
      }),
    );
    const bulkReorderResponse = await bulkReorderCards(
      buildRequest("/api/cards/bulk-reorder", "POST", {
        updates: [{ id: CARD_ID, columnId: 1, position: 1 }],
      }),
    );

    expect(bulkUpdateResponse.status).toBe(403);
    await expect(bulkUpdateResponse.json()).resolves.toEqual({
      error: "Insufficient permissions",
    });
    expect(bulkReorderResponse.status).toBe(403);
    await expect(bulkReorderResponse.json()).resolves.toEqual({
      error: "Insufficient permissions",
    });
  });

  it("rejects viewer column creation and updates", async () => {
    const boardsTable = {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi
            .fn()
            .mockResolvedValue({ data: { id: BOARD_ID }, error: null }),
        })),
      })),
    };
    const columnsTable = {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi
            .fn()
            .mockResolvedValue({
              data: { id: 1, board_id: BOARD_ID },
              error: null,
            }),
        })),
      })),
    };
    const supabase = createSupabaseMock((table) => {
      if (table === "boards") return boardsTable;
      if (table === "columns") return columnsTable;
      throw new Error(`Unexpected table: ${table}`);
    });
    mockCreateClient.mockResolvedValue(supabase as never);

    const createResponse = await createColumn(
      buildRequest("/api/columns", "POST", {
        boardId: BOARD_ID,
        title: "Done",
      }),
    );
    const patchResponse = await updateColumn(
      buildRequest("/api/columns/1", "PATCH", { title: "Ready" }),
      {
        params: Promise.resolve({ id: "1" }),
      },
    );

    expect(createResponse.status).toBe(403);
    await expect(createResponse.json()).resolves.toEqual({
      error: "Insufficient permissions",
    });
    expect(patchResponse.status).toBe(403);
    await expect(patchResponse.json()).resolves.toEqual({
      error: "Insufficient permissions",
    });
  });

  it("rejects viewer column deletion and bulk updates", async () => {
    const columnsTable = {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi
            .fn()
            .mockResolvedValue({
              data: { id: 1, board_id: BOARD_ID },
              error: null,
            }),
        })),
        in: vi
          .fn()
          .mockResolvedValue({
            data: [{ id: 1, board_id: BOARD_ID }],
            error: null,
          }),
      })),
      delete: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
      update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
    };
    const supabase = createSupabaseMock((table) => {
      if (table === "columns") return columnsTable;
      throw new Error(`Unexpected table: ${table}`);
    });
    mockCreateClient.mockResolvedValue(supabase as never);

    const deleteResponse = await deleteColumn(
      buildRequest("/api/columns/1", "DELETE"),
      {
        params: Promise.resolve({ id: "1" }),
      },
    );
    const bulkResponse = await bulkUpdateColumns(
      buildRequest("/api/columns/bulk-update", "POST", {
        updates: [{ id: 1, position: 2 }],
      }),
    );

    expect(deleteResponse.status).toBe(403);
    await expect(deleteResponse.json()).resolves.toEqual({
      error:
        "Insufficient permissions. Only board owners and admins can delete columns.",
    });
    expect(bulkResponse.status).toBe(403);
    await expect(bulkResponse.json()).resolves.toEqual({
      error: "Insufficient permissions",
    });
  });

  it("allows admins to create columns", async () => {
    const newColumn = {
      id: 7,
      board_id: BOARD_ID,
      title: "Review",
      position: 3,
      created_at: "2026-03-05T12:00:00Z",
    };
    const insert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({ data: newColumn, error: null }),
      })),
    }));
    const boardsTable = {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi
            .fn()
            .mockResolvedValue({ data: { id: BOARD_ID }, error: null }),
        })),
      })),
    };
    const columnsTable = {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi
              .fn()
              .mockResolvedValue({ data: [{ position: 2 }], error: null }),
          })),
        })),
      })),
      insert,
    };
    const supabase = createSupabaseMock((table) => {
      if (table === "boards") return boardsTable;
      if (table === "columns") return columnsTable;
      throw new Error(`Unexpected table: ${table}`);
    });
    mockCreateClient.mockResolvedValue(supabase as never);
    mockGetBoardMutationAuthorization.mockResolvedValue({
      ok: true,
      role: "admin",
    });

    const response = await createColumn(
      buildRequest("/api/columns", "POST", {
        boardId: BOARD_ID,
        title: "Review",
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      id: 7,
      boardId: BOARD_ID,
      title: "Review",
      position: 3,
      createdAt: "2026-03-05T12:00:00Z",
    });
    expect(insert).toHaveBeenCalledWith({
      board_id: BOARD_ID,
      title: "Review",
      position: 3,
    });
  });
});
