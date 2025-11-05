# Zustand State Management Integration

## Overview

The Kanban application now uses Zustand for centralized state management, providing consistent state updates across all components and eliminating prop drilling.

## Key Benefits

### ✅ **Consistent State Updates**

- All card operations (create, update, delete, move) update the global state immediately
- No more inconsistent state between components
- Optimistic updates with automatic rollback on errors

### ✅ **Simplified Component Architecture**

- Eliminated complex prop drilling chains
- Components can directly access and update global state
- Cleaner, more maintainable code

### ✅ **Real-time Synchronization**

- All components automatically reflect state changes
- Context menu actions update the UI immediately
- Board state stays synchronized across all views

## Store Structure

```typescript
interface AppState {
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
```

## Usage Examples

### **Card Operations with Immediate Updates**

```typescript
// In any component
import { useAppActions } from "@/store";

function MyComponent() {
  const { updateCard, deleteCard, addCard } = useAppActions();

  // Update card priority - UI updates immediately
  const handlePriorityChange = (card, priority) => {
    updateCard({ ...card, priority });
  };

  // Move card between columns - UI updates immediately
  const handleMoveCard = (card, newColumnId) => {
    updateCard({ ...card, columnId: newColumnId });
  };

  // Delete card - UI updates immediately
  const handleDeleteCard = (cardId) => {
    deleteCard(cardId);
  };
}
```

### **Accessing Current Board State**

```typescript
import { useCurrentBoard, useUserRole } from '@/store';

function BoardComponent() {
  const board = useCurrentBoard();
  const userRole = useUserRole();

  // Board and role are always up-to-date
  const canEdit = ['owner', 'admin', 'member'].includes(userRole);

  return (
    <div>
      <h1>{board?.name}</h1>
      {canEdit && <EditButton />}
    </div>
  );
}
```

### **Optimistic Updates with Error Handling**

```typescript
import { useCardActionsWithStore } from "@/hooks/useCardActionsWithStore";

function CardContextMenu({ card }) {
  const { handlePriorityChange } = useCardActionsWithStore({
    onSuccess: (message) => toast.success(message),
    onError: (error) => toast.error(error),
  });

  const changePriority = async (priority) => {
    // UI updates immediately (optimistic)
    // If API fails, change is automatically reverted
    await handlePriorityChange(card, priority);
  };
}
```

## Migration from Prop Drilling

### **Before (Prop Drilling)**

```typescript
// BoardDetailPage
<KanbanBoard
  boardData={board}
  onBoardDataChange={setBoard}
  onCardUpdated={handleCardUpdated}
  onCardDeleted={handleCardDeleted}
  onCardCreated={handleCardCreated}
/>

// KanbanBoard
<KanbanCard
  card={card}
  onCardUpdated={onCardUpdated}
  onCardDeleted={onCardDeleted}
  onCardCreated={onCardCreated}
/>

// KanbanCard
const { handlePriorityChange } = useCardActions({
  onCardUpdated: onCardUpdated,
  onCardDeleted: onCardDeleted,
  onCardCreated: onCardCreated,
});
```

### **After (Zustand)**

```typescript
// BoardDetailPage
<KanbanBoard boardData={board} />

// KanbanBoard
<KanbanCard card={card} />

// KanbanCard
const { handlePriorityChange } = useCardActionsWithStore();
// State updates happen automatically through the store
```

## Store Actions

### **Card Actions**

- `addCard(card)` - Add new card to board
- `updateCard(card)` - Update existing card (handles column moves)
- `deleteCard(cardId)` - Remove card from board
- `moveCard(cardId, fromColumn, toColumn, position)` - Move card between columns

### **Board Actions**

- `setCurrentBoard(board)` - Set the active board
- `updateBoard(board)` - Update board data
- `addColumn(column)` - Add new column to board
- `updateColumn(column)` - Update existing column
- `deleteColumn(columnId)` - Remove column from board

### **UI Actions**

- `setLoading(boolean)` - Set loading state
- `setError(string)` - Set error message
- `clearError()` - Clear error state

## Selectors

Use these selectors for optimal performance:

```typescript
import {
  useCurrentBoard,
  useUserRole,
  useIsLoading,
  useError,
  useAppActions,
} from "@/store";

// These selectors only re-render when their specific data changes
const board = useCurrentBoard();
const userRole = useUserRole();
const isLoading = useIsLoading();
const error = useError();
const actions = useAppActions();
```

## Context Menu Integration

The context menu now provides immediate visual feedback:

1. **Priority Change**: Card color/badge updates instantly
2. **Move to Column**: Card moves between columns immediately
3. **Delete Card**: Card disappears from board instantly
4. **Duplicate Card**: New card appears immediately

All actions include optimistic updates with automatic rollback on API errors.

## Performance Optimizations

### **Stable Selector References**

The store uses stable selector references to prevent infinite loops:

```typescript
// ✅ Stable reference - prevents infinite loops
const actionsSelector = (state: AppStore) => ({
  updateCard: state.updateCard,
  deleteCard: state.deleteCard,
  // ... other actions
});

export const useAppActions = () => useAppStore(actionsSelector);
```

### **Benefits**

- **Optimistic Updates**: Immediate UI feedback with automatic error recovery
- **Selective Re-renders**: Components only re-render when their specific data changes
- **Stable Selectors**: Actions and state selectors use stable references to prevent infinite loops
- **Memory Efficiency**: Proper cleanup and garbage collection
- **Type Safety**: Complete TypeScript integration with proper type inference

## Development Tools

Zustand includes Redux DevTools integration for debugging:

1. Install Redux DevTools browser extension
2. Open DevTools → Redux tab
3. Monitor all state changes in real-time
4. Time-travel debugging available

## Best Practices

### ✅ **Do**

- Use selectors for specific data access
- Batch related state updates
- Handle errors with optimistic updates
- Use TypeScript for type safety

### ❌ **Don't**

- Mutate state directly (use immer middleware)
- Store derived data in the store
- Ignore error handling
- Access store outside of React components

## Performance

- **Selective Re-renders**: Components only re-render when their selected data changes
- **Optimistic Updates**: UI feels instant with automatic error recovery
- **Minimal Bundle Size**: Zustand adds only ~2KB to bundle
- **No Boilerplate**: Simple, clean API compared to Redux

## Future Enhancements

- **Real-time Sync**: WebSocket integration for multi-user collaboration
- **Offline Support**: Persist state and sync when online
- **Undo/Redo**: Leverage Zustand's time-travel capabilities
- **Advanced Caching**: Implement smart data fetching strategies
