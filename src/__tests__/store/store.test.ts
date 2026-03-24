import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "@/store";
import type { BoardWithDetails } from "@/types/database";

// ─── helpers ────────────────────────────────────────────────────────────────

type Column = BoardWithDetails["columns"][number];
type Card = Column["cards"][number];

const makeCard = (overrides: Partial<Card> = {}): Card => ({
  id: "card-1",
  boardId: "board-1",
  columnId: 1,
  title: "Test card",
  description: null,
  position: 0,
  dueDate: null,
  priority: "medium",
  completedAt: null,
  createdAt: new Date("2026-01-01"),
  assigneeId: null,
  createdBy: null,
  labels: [],
  comments: [],
  ...overrides,
});

const makeColumn = (id: number, cards: Card[] = []): Column => ({
  id,
  boardId: "board-1",
  title: `Column ${id}`,
  position: id,
  isDone: false,
  createdAt: new Date("2026-01-01"),
  cards,
});

const makeBoard = (columns: Column[] = []): BoardWithDetails =>
  ({
    id: "board-1",
    name: "Test Board",
    description: null,
    isArchived: false,
    ownerId: "user-1",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    role: "owner",
    memberCount: 1,
    columns,
    owner: {
      id: "user-1",
      email: "owner@example.com",
      name: "Owner",
      avatarUrl: null,
      createdAt: new Date("2026-01-01"),
    },
    members: [],
    labels: [],
  }) as BoardWithDetails;

// Reset store to initial state before each test
beforeEach(() => {
  useAppStore.getState().reset();
  vi.clearAllMocks();
});

// ─── card mutations ──────────────────────────────────────────────────────────

describe("addCard", () => {
  it("appends a card to the correct column", () => {
    const store = useAppStore.getState();
    store.setCurrentBoard(makeBoard([makeColumn(1)]));

    store.addCard(makeCard({ columnId: 1 }));

    const cards = useAppStore.getState().currentBoard!.columns[0]!.cards;
    expect(cards).toHaveLength(1);
    expect(cards[0]!.title).toBe("Test card");
  });

  it("defaults labels and comments to empty arrays", () => {
    const store = useAppStore.getState();
    store.setCurrentBoard(makeBoard([makeColumn(1)]));

    store.addCard(
      makeCard({
        columnId: 1,
        labels: undefined as never,
        comments: undefined as never,
      }),
    );

    const card = useAppStore.getState().currentBoard!.columns[0]!.cards[0]!;
    expect(card.labels).toEqual([]);
    expect(card.comments).toEqual([]);
  });

  it("is a no-op when there is no current board", () => {
    useAppStore.getState().addCard(makeCard());
    expect(useAppStore.getState().currentBoard).toBeNull();
  });

  it("is a no-op when the target column does not exist", () => {
    const store = useAppStore.getState();
    store.setCurrentBoard(makeBoard([makeColumn(1)]));

    store.addCard(makeCard({ columnId: 99 }));

    expect(useAppStore.getState().currentBoard!.columns[0]!.cards).toHaveLength(
      0,
    );
  });
});

describe("updateCard", () => {
  it("updates a card in the same column", () => {
    const store = useAppStore.getState();
    store.setCurrentBoard(
      makeBoard([makeColumn(1, [makeCard({ id: "c1", title: "Original" })])]),
    );

    store.updateCard(makeCard({ id: "c1", columnId: 1, title: "Updated" }));

    expect(
      useAppStore.getState().currentBoard!.columns[0]!.cards[0]!.title,
    ).toBe("Updated");
  });

  it("moves card to a different column when columnId changes", () => {
    const store = useAppStore.getState();
    store.setCurrentBoard(
      makeBoard([
        makeColumn(1, [makeCard({ id: "c1", columnId: 1 })]),
        makeColumn(2),
      ]),
    );

    store.updateCard(makeCard({ id: "c1", columnId: 2 }));

    const state = useAppStore.getState().currentBoard!;
    expect(state.columns[0]!.cards).toHaveLength(0);
    expect(state.columns[1]!.cards).toHaveLength(1);
    expect(state.columns[1]!.cards[0]!.columnId).toBe(2);
  });

  it("is a no-op when card id does not exist", () => {
    const store = useAppStore.getState();
    store.setCurrentBoard(makeBoard([makeColumn(1, [makeCard({ id: "c1" })])]));

    store.updateCard(
      makeCard({ id: "nonexistent", columnId: 1, title: "Ghost" }),
    );

    expect(
      useAppStore.getState().currentBoard!.columns[0]!.cards[0]!.title,
    ).toBe("Test card");
  });
});

describe("deleteCard", () => {
  it("removes the card from its column", () => {
    const store = useAppStore.getState();
    store.setCurrentBoard(makeBoard([makeColumn(1, [makeCard({ id: "c1" })])]));

    store.deleteCard("c1");

    expect(useAppStore.getState().currentBoard!.columns[0]!.cards).toHaveLength(
      0,
    );
  });

  it("only removes the targeted card, leaving others intact", () => {
    const store = useAppStore.getState();
    store.setCurrentBoard(
      makeBoard([
        makeColumn(1, [
          makeCard({ id: "c1", title: "Keep" }),
          makeCard({ id: "c2", title: "Delete" }),
        ]),
      ]),
    );

    store.deleteCard("c2");

    const cards = useAppStore.getState().currentBoard!.columns[0]!.cards;
    expect(cards).toHaveLength(1);
    expect(cards[0]!.id).toBe("c1");
  });
});

describe("moveCard", () => {
  it("moves a card from one column to another at the correct position", () => {
    const store = useAppStore.getState();
    store.setCurrentBoard(
      makeBoard([
        makeColumn(1, [makeCard({ id: "c1", columnId: 1 })]),
        makeColumn(2),
      ]),
    );

    store.moveCard("c1", 1, 2, 0);

    const state = useAppStore.getState().currentBoard!;
    expect(state.columns[0]!.cards).toHaveLength(0);
    expect(state.columns[1]!.cards[0]!.id).toBe("c1");
    expect(state.columns[1]!.cards[0]!.columnId).toBe(2);
    expect(state.columns[1]!.cards[0]!.position).toBe(0);
  });

  it("reorders within the same column", () => {
    const store = useAppStore.getState();
    store.setCurrentBoard(
      makeBoard([
        makeColumn(1, [
          makeCard({ id: "c1", position: 0 }),
          makeCard({ id: "c2", position: 1 }),
        ]),
      ]),
    );

    store.moveCard("c1", 1, 1, 1);

    const cards = useAppStore.getState().currentBoard!.columns[0]!.cards;
    expect(cards.find((c) => c.id === "c1")?.position).toBe(1);
  });

  it("is a no-op when card id is not found in the source column", () => {
    const store = useAppStore.getState();
    const board = makeBoard([makeColumn(1), makeColumn(2)]);
    store.setCurrentBoard(board);

    store.moveCard("ghost", 1, 2, 0);

    expect(useAppStore.getState().currentBoard!.columns[1]!.cards).toHaveLength(
      0,
    );
  });
});

// ─── column mutations ────────────────────────────────────────────────────────

describe("addColumn", () => {
  it("appends a column to the current board", () => {
    const store = useAppStore.getState();
    store.setCurrentBoard(makeBoard());

    store.addColumn({
      id: 10,
      boardId: "board-1",
      title: "New",
      position: 1,
      isDone: false,
      createdAt: new Date(),
    });

    expect(useAppStore.getState().currentBoard!.columns).toHaveLength(1);
    expect(useAppStore.getState().currentBoard!.columns[0]!.title).toBe("New");
  });

  it("initialises cards to an empty array when not provided", () => {
    const store = useAppStore.getState();
    store.setCurrentBoard(makeBoard());

    store.addColumn({
      id: 10,
      boardId: "board-1",
      title: "New",
      position: 1,
      isDone: false,
      createdAt: new Date(),
    });

    expect(useAppStore.getState().currentBoard!.columns[0]!.cards).toEqual([]);
  });
});

describe("updateColumn", () => {
  it("updates an existing column title", () => {
    const store = useAppStore.getState();
    store.setCurrentBoard(makeBoard([makeColumn(1)]));

    store.updateColumn({
      id: 1,
      boardId: "board-1",
      title: "Renamed",
      position: 1,
      isDone: false,
      createdAt: new Date(),
    });

    expect(useAppStore.getState().currentBoard!.columns[0]!.title).toBe(
      "Renamed",
    );
  });
});

describe("deleteColumn", () => {
  it("removes the column by id", () => {
    const store = useAppStore.getState();
    store.setCurrentBoard(makeBoard([makeColumn(1), makeColumn(2)]));

    store.deleteColumn(1);

    const cols = useAppStore.getState().currentBoard!.columns;
    expect(cols).toHaveLength(1);
    expect(cols[0]!.id).toBe(2);
  });
});

// ─── board list mutations ────────────────────────────────────────────────────

describe("addBoard / removeBoard / updateBoardInList", () => {
  it("addBoard prepends the board to the list", () => {
    const store = useAppStore.getState();
    store.setBoards([makeBoard()]);

    const newBoard = makeBoard();
    newBoard.id = "board-2";
    store.addBoard(newBoard);

    expect(useAppStore.getState().boards[0]!.id).toBe("board-2");
  });

  it("removeBoard removes the board from the list", () => {
    const store = useAppStore.getState();
    store.setBoards([makeBoard()]);

    store.removeBoard("board-1");

    expect(useAppStore.getState().boards).toHaveLength(0);
  });

  it("removeBoard clears currentBoard when the active board is removed", () => {
    const store = useAppStore.getState();
    const board = makeBoard();
    store.setBoards([board]);
    store.setCurrentBoard(board);

    store.removeBoard("board-1");

    const state = useAppStore.getState();
    expect(state.currentBoard).toBeNull();
    expect(state.currentBoardId).toBeNull();
    expect(state.userRole).toBeNull();
  });

  it("updateBoardInList patches only the matching board", () => {
    const store = useAppStore.getState();
    const b1 = makeBoard();
    const b2 = { ...makeBoard(), id: "board-2", name: "Board B" };
    store.setBoards([b1, b2]);

    store.updateBoardInList({ id: "board-1", name: "Patched" });

    const boards = useAppStore.getState().boards;
    expect(boards.find((b) => b.id === "board-1")!.name).toBe("Patched");
    expect(boards.find((b) => b.id === "board-2")!.name).toBe("Board B");
  });
});

// ─── auth state ──────────────────────────────────────────────────────────────

describe("setAuthenticated", () => {
  it("clears all session data when set to false", () => {
    const store = useAppStore.getState();
    store.setUser({
      id: "u1",
      email: "a@b.com",
      name: "A",
      avatarUrl: null,
      createdAt: new Date(),
    });
    store.setCurrentBoard(makeBoard());
    store.setBoards([makeBoard()]);

    store.setAuthenticated(false);

    const state = useAppStore.getState();
    expect(state.user).toBeNull();
    expect(state.currentBoard).toBeNull();
    expect(state.boards).toHaveLength(0);
    expect(state.isAuthenticated).toBe(false);
  });
});

// ─── fetchBoards cache ───────────────────────────────────────────────────────

describe("fetchBoards", () => {
  it("fetches from the API and populates boards on success", async () => {
    const boards = [makeBoard()];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ boards }),
    });

    await useAppStore.getState().fetchBoards(true);

    expect(useAppStore.getState().boards).toHaveLength(1);
    expect(useAppStore.getState().boardsFetchedAt).not.toBeNull();
  });

  it("skips the fetch when data is still fresh", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ boards: [] }),
    });
    global.fetch = fetchMock;

    await useAppStore.getState().fetchBoards(true);
    await useAppStore.getState().fetchBoards(); // should be skipped

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refetches when forced even if data is fresh", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ boards: [] }),
    });
    global.fetch = fetchMock;

    await useAppStore.getState().fetchBoards(true);
    await useAppStore.getState().fetchBoards(true);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("silently keeps stale data on network error", async () => {
    const store = useAppStore.getState();
    store.setBoards([makeBoard()]);
    global.fetch = vi.fn().mockRejectedValue(new Error("network error"));

    await store.fetchBoards(true);

    expect(useAppStore.getState().boards).toHaveLength(1);
  });
});

// ─── reset ───────────────────────────────────────────────────────────────────

describe("reset", () => {
  it("restores initial state completely", () => {
    const store = useAppStore.getState();
    store.setUser({
      id: "u1",
      email: "a@b.com",
      name: "A",
      avatarUrl: null,
      createdAt: new Date(),
    });
    store.setCurrentBoard(makeBoard());
    store.setBoards([makeBoard()]);
    store.setError("oops");

    store.reset();

    const state = useAppStore.getState();
    expect(state.user).toBeNull();
    expect(state.currentBoard).toBeNull();
    expect(state.boards).toHaveLength(0);
    expect(state.error).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });
});
