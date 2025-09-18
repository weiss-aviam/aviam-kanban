import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { useMemo } from 'react';
import type {
  BoardWithDetails,
  Column,
  User,
  BoardMemberRole
} from '@/types/database';

// Canonical card/column types derived from BoardWithDetails
type BoardColumn = BoardWithDetails['columns'][number];
type BoardCard = BoardColumn['cards'][number];
// Back-compat alias used across the app
export type StoreCard = BoardCard;

// Main application state interface
export interface AppState {
  // User state
  user: User | null;
  isAuthenticated: boolean;
  
  // Current board state
  currentBoard: BoardWithDetails | null;
  currentBoardId: string | null;
  userRole: BoardMemberRole | null;
  
  // UI state
  isLoading: boolean;
  error: string | null;
  
  // Board management
  boards: BoardWithDetails[];
  
  // Real-time updates
  lastUpdated: Date | null;
}

// Actions interface
export interface AppActions {
  // User actions
  setUser: (user: User | null) => void;
  setAuthenticated: (isAuthenticated: boolean) => void;

  // Board actions
  setCurrentBoard: (board: BoardWithDetails | null) => void;
  setCurrentBoardId: (boardId: string | null) => void;
  setUserRole: (role: BoardMemberRole | null) => void;
  updateBoard: (board: BoardWithDetails) => void;

  // Card actions
  addCard: (card: StoreCard) => void;
  updateCard: (card: StoreCard) => void;
  deleteCard: (cardId: string) => void;
  moveCard: (cardId: string, fromColumnId: number, toColumnId: number, newPosition: number) => void;

  // Column actions
  addColumn: (column: Column & { cards?: StoreCard[] }) => void;
  updateColumn: (column: Column & { cards?: StoreCard[] }) => void;
  deleteColumn: (columnId: number) => void;
  
  // UI actions
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  
  // Board management actions
  setBoards: (boards: BoardWithDetails[]) => void;
  addBoard: (board: BoardWithDetails) => void;
  removeBoard: (boardId: string) => void;
  
  // Utility actions
  reset: () => void;
  refreshBoard: () => Promise<void>;
}

// Combined store type
export type AppStore = AppState & AppActions;

// Initial state
const initialState: AppState = {
  user: null,
  isAuthenticated: false,
  currentBoard: null,
  currentBoardId: null,
  userRole: null,
  isLoading: false,
  error: null,
  boards: [],
  lastUpdated: null,
};

// Create the store with middleware
export const useAppStore = create<AppStore>()(
  devtools(
    subscribeWithSelector(
      immer((set, get) => ({
        ...initialState,
        
        // User actions
        setUser: (user) => set((state) => {
          state.user = user;
          state.isAuthenticated = !!user;
        }),
        
        setAuthenticated: (isAuthenticated) => set((state) => {
          state.isAuthenticated = isAuthenticated;
          if (!isAuthenticated) {
            state.user = null;
            state.currentBoard = null;
            state.currentBoardId = null;
            state.userRole = null;
            state.boards = [];
          }
        }),
        
        // Board actions
        setCurrentBoard: (board) => set((state) => {
          state.currentBoard = board;
          state.currentBoardId = board?.id || null;
          state.lastUpdated = new Date();
        }),
        
        setCurrentBoardId: (boardId) => set((state) => {
          state.currentBoardId = boardId;
        }),
        
        setUserRole: (role) => set((state) => {
          state.userRole = role;
        }),
        
        updateBoard: (board) => set((state) => {
          if (state.currentBoard && state.currentBoard.id === board.id) {
            state.currentBoard = board;
          }
          const index = state.boards.findIndex(b => b.id === board.id);
          if (index !== -1) {
            state.boards[index] = board;
          }
          state.lastUpdated = new Date();
        }),
        
        // Card actions
        addCard: (card) => set((state) => {
          if (!state.currentBoard) return;

          const columnIndex = state.currentBoard.columns.findIndex(col => col.id === card.columnId);
          if (columnIndex !== -1 && state.currentBoard.columns[columnIndex]) {
            // Ensure card has all required properties
            const cardWithDefaults: BoardCard = {
              ...card,
              labels: (card as BoardCard).labels ?? [],
              comments: (card as BoardCard).comments ?? [],
            };
            state.currentBoard.columns[columnIndex].cards.push(cardWithDefaults);
            state.lastUpdated = new Date();
          }
        }),
        
        updateCard: (card) => set((state) => {
          if (!state.currentBoard) return;

          // Find the current column of the card
          let currentColumnIndex = -1;
          let currentCardIndex = -1;

          for (let i = 0; i < state.currentBoard.columns.length; i++) {
            const column = state.currentBoard.columns[i];
            if (column && column.cards) {
              const cardIndex = column.cards.findIndex(c => c.id === card.id);
              if (cardIndex !== -1) {
                currentColumnIndex = i;
                currentCardIndex = cardIndex;
                break;
              }
            }
          }

          if (currentColumnIndex === -1) return;

          // Check if card moved to a different column
          const targetColumnIndex = state.currentBoard.columns.findIndex(col => col.id === card.columnId);

          // Ensure card has all required properties
          const cardWithDefaults: BoardCard = {
            ...(card as BoardCard),
            labels: (card as BoardCard).labels ?? [],
            comments: (card as BoardCard).comments ?? [],
          };

          const currentColumn = state.currentBoard.columns[currentColumnIndex];
          const targetColumn = state.currentBoard.columns[targetColumnIndex];

          if (currentColumnIndex !== targetColumnIndex && targetColumnIndex !== -1 &&
              currentColumn && targetColumn && currentColumn.cards && targetColumn.cards) {
            // Remove from current column
            currentColumn.cards.splice(currentCardIndex, 1);
            // Add to new column
            targetColumn.cards.push(cardWithDefaults);
          } else if (currentColumn && currentColumn.cards) {
            // Update in same column
            currentColumn.cards[currentCardIndex] = cardWithDefaults;
          }

          state.lastUpdated = new Date();
        }),
        
        deleteCard: (cardId) => set((state) => {
          if (!state.currentBoard) return;
          
          for (const column of state.currentBoard.columns) {
            const cardIndex = column.cards.findIndex(c => c.id === cardId);
            if (cardIndex !== -1) {
              column.cards.splice(cardIndex, 1);
              break;
            }
          }
          state.lastUpdated = new Date();
        }),
        
        moveCard: (cardId, fromColumnId, toColumnId, newPosition) => set((state) => {
          if (!state.currentBoard) return;

          const fromColumn = state.currentBoard.columns.find(col => col.id === fromColumnId);
          const toColumn = state.currentBoard.columns.find(col => col.id === toColumnId);

          if (!fromColumn || !toColumn) return;

          const cardIndex = fromColumn.cards.findIndex(c => c.id === cardId);
          if (cardIndex === -1) return;

          const card = fromColumn.cards[cardIndex];
          if (!card) return;

          // Remove from source column
          fromColumn.cards.splice(cardIndex, 1);

          // Update card's column ID and position
          card.columnId = toColumnId;
          card.position = newPosition;

          // Add to target column at the specified position
          toColumn.cards.splice(newPosition, 0, card);

          state.lastUpdated = new Date();
        }),
        
        // Column actions
        addColumn: (column) => set((state) => {
          if (!state.currentBoard) return;

          // Ensure column has cards array
          const columnWithCards: BoardColumn = {
            ...(column as Column as unknown as BoardColumn),
            cards: (column as { cards?: BoardCard[] }).cards ?? [],
          };
          state.currentBoard.columns.push(columnWithCards);
          state.lastUpdated = new Date();
        }),

        updateColumn: (column) => set((state) => {
          if (!state.currentBoard) return;

          const index = state.currentBoard.columns.findIndex(col => col.id === column.id);
          if (index !== -1) {
            // Ensure column has cards array
            const columnWithCards: BoardColumn = {
              ...(column as Column as unknown as BoardColumn),
              cards: (column as { cards?: BoardCard[] }).cards ?? [],
            };
            state.currentBoard.columns[index] = columnWithCards;
            state.lastUpdated = new Date();
          }
        }),
        
        deleteColumn: (columnId) => set((state) => {
          if (!state.currentBoard) return;
          
          state.currentBoard.columns = state.currentBoard.columns.filter(col => col.id !== columnId);
          state.lastUpdated = new Date();
        }),
        
        // UI actions
        setLoading: (isLoading) => set((state) => {
          state.isLoading = isLoading;
        }),
        
        setError: (error) => set((state) => {
          state.error = error;
        }),
        
        clearError: () => set((state) => {
          state.error = null;
        }),
        
        // Board management actions
        setBoards: (boards) => set((state) => {
          state.boards = boards;
        }),
        
        addBoard: (board) => set((state) => {
          state.boards.unshift(board);
        }),
        
        removeBoard: (boardId) => set((state) => {
          state.boards = state.boards.filter(b => b.id !== boardId);
          if (state.currentBoardId === boardId) {
            state.currentBoard = null;
            state.currentBoardId = null;
            state.userRole = null;
          }
        }),
        
        // Utility actions
        reset: () => set(() => ({ ...initialState })),
        
        refreshBoard: async () => {
          const { currentBoardId, setLoading, setError, setCurrentBoard } = get();
          if (!currentBoardId) return;
          
          setLoading(true);
          setError(null);
          
          try {
            const response = await fetch(`/api/boards/${currentBoardId}`);
            if (!response.ok) {
              throw new Error('Failed to refresh board');
            }
            
            const { board } = await response.json();
            setCurrentBoard(board);
          } catch (error) {
            setError(error instanceof Error ? error.message : 'Failed to refresh board');
          } finally {
            setLoading(false);
          }
        },
      }))
    ),
    {
      name: 'kanban-app-store',
    }
  )
);


// Selectors for common state access patterns
export const useUser = () => useAppStore((state) => state.user);
export const useIsAuthenticated = () => useAppStore((state) => state.isAuthenticated);
export const useCurrentBoard = () => useAppStore((state) => state.currentBoard);
export const useCurrentBoardId = () => useAppStore((state) => state.currentBoardId);
export const useUserRole = () => useAppStore((state) => state.userRole);
export const useIsLoading = () => useAppStore((state) => state.isLoading);
export const useError = () => useAppStore((state) => state.error);
export const useBoards = () => useAppStore((state) => state.boards);

// Combined state selector with stable reference
export const useAppState = () => {
  const user = useUser();
  const isAuthenticated = useIsAuthenticated();
  const currentBoard = useCurrentBoard();
  const currentBoardId = useCurrentBoardId();
  const userRole = useUserRole();
  const isLoading = useIsLoading();
  const error = useError();
  const boards = useBoards();
  const lastUpdated = useAppStore((s) => s.lastUpdated);

  return useMemo(() => ({
    user,
    isAuthenticated,
    currentBoard,
    currentBoardId,
    userRole,
    isLoading,
    error,
    lastUpdated,
    boards,
  }), [
    user,
    isAuthenticated,
    currentBoard,
    currentBoardId,
    userRole,
    isLoading,
    error,
    lastUpdated,
    boards,
  ]);
};

export const useAppActions = () => {
  const setUser = useAppStore((s) => s.setUser);
  const setAuthenticated = useAppStore((s) => s.setAuthenticated);
  const setCurrentBoard = useAppStore((s) => s.setCurrentBoard);
  const setCurrentBoardId = useAppStore((s) => s.setCurrentBoardId);
  const setUserRole = useAppStore((s) => s.setUserRole);
  const updateBoard = useAppStore((s) => s.updateBoard);
  const addCard = useAppStore((s) => s.addCard);
  const updateCard = useAppStore((s) => s.updateCard);
  const deleteCard = useAppStore((s) => s.deleteCard);
  const moveCard = useAppStore((s) => s.moveCard);
  const addColumn = useAppStore((s) => s.addColumn);
  const updateColumn = useAppStore((s) => s.updateColumn);
  const deleteColumn = useAppStore((s) => s.deleteColumn);
  const setLoading = useAppStore((s) => s.setLoading);
  const setError = useAppStore((s) => s.setError);
  const clearError = useAppStore((s) => s.clearError);
  const setBoards = useAppStore((s) => s.setBoards);
  const addBoard = useAppStore((s) => s.addBoard);
  const removeBoard = useAppStore((s) => s.removeBoard);
  const reset = useAppStore((s) => s.reset);
  const refreshBoard = useAppStore((s) => s.refreshBoard);

  return useMemo(() => ({
    setUser,
    setAuthenticated,
    setCurrentBoard,
    setCurrentBoardId,
    setUserRole,
    updateBoard,
    addCard,
    updateCard,
    deleteCard,
    moveCard,
    addColumn,
    updateColumn,
    deleteColumn,
    setLoading,
    setError,
    clearError,
    setBoards,
    addBoard,
    removeBoard,
    reset,
    refreshBoard,
  }), [
    setUser,
    setAuthenticated,
    setCurrentBoard,
    setCurrentBoardId,
    setUserRole,
    updateBoard,
    addCard,
    updateCard,
    deleteCard,
    moveCard,
    addColumn,
    updateColumn,
    deleteColumn,
    setLoading,
    setError,
    clearError,
    setBoards,
    addBoard,
    removeBoard,
    reset,
    refreshBoard,
  ]);
};
