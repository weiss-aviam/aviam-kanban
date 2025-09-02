# Development Guide

This guide covers development practices, architecture decisions, and contribution guidelines for the Aviam Kanban project.

## Architecture Overview

### Frontend Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Next.js App   │    │   React Hooks   │    │  UI Components  │
│     Router      │◄──►│   & Context     │◄──►│   (shadcn/ui)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  API Routes     │    │  State Mgmt     │    │  Drag & Drop    │
│  (Server Side)  │    │  (React State)  │    │   (@dnd-kit)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Backend Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Supabase      │    │   Drizzle ORM   │    │   PostgreSQL    │
│   Auth & RT     │◄──►│   Type Safety   │◄──►│   Database      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Row Level      │    │  API Validation │    │  Real-time      │
│  Security       │    │     (Zod)       │    │  Subscriptions  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Development Setup

### Prerequisites

- Node.js 18+
- pnpm (recommended package manager)
- Git
- VS Code (recommended editor)

### Recommended VS Code Extensions

```json
{
  "recommendations": [
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "ms-vscode.vscode-typescript-next",
    "formulahendry.auto-rename-tag",
    "christian-kohler.path-intellisense"
  ]
}
```

### Environment Setup

1. **Clone and Install**
   ```bash
   git clone <repository>
   cd kanban-app
   pnpm install
   ```

2. **Environment Variables**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your values
   ```

3. **Database Setup**
   ```bash
   pnpm run db:push
   pnpm run db:seed
   ```

## Code Style and Standards

### TypeScript Guidelines

1. **Strict Mode**: Always use strict TypeScript
2. **Type Definitions**: Define types in `src/types/`
3. **No Any**: Avoid `any` type, use `unknown` instead
4. **Interfaces**: Use interfaces for object shapes

```typescript
// Good
interface User {
  id: string;
  email: string;
  name?: string;
}

// Avoid
const user: any = { id: "1", email: "test@example.com" };
```

### React Guidelines

1. **Functional Components**: Use function components with hooks
2. **Custom Hooks**: Extract reusable logic into custom hooks
3. **Props Interface**: Always define props interfaces

```typescript
interface ButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

export function Button({ children, onClick, variant = 'primary' }: ButtonProps) {
  return (
    <button onClick={onClick} className={`btn btn-${variant}`}>
      {children}
    </button>
  );
}
```

### CSS Guidelines

1. **Tailwind First**: Use Tailwind CSS classes
2. **Component Variants**: Use cva for component variants
3. **Responsive Design**: Mobile-first approach

```typescript
import { cva } from 'class-variance-authority';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);
```

## Database Development

### Schema Changes

1. **Modify Schema**: Update files in `src/db/schema/`
2. **Generate Migration**: `pnpm run db:generate`
3. **Apply Migration**: `pnpm run db:push`
4. **Update Types**: TypeScript types are auto-generated

### Query Patterns

```typescript
// Good: Use Drizzle ORM
const boards = await db
  .select()
  .from(boardsTable)
  .where(eq(boardsTable.ownerId, userId))
  .orderBy(boardsTable.createdAt);

// Avoid: Raw SQL (unless necessary)
const boards = await db.execute(sql`SELECT * FROM boards WHERE owner_id = ${userId}`);
```

### RLS Policies

When adding new tables:

1. Enable RLS: `ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;`
2. Create policies for each operation (SELECT, INSERT, UPDATE, DELETE)
3. Test policies thoroughly
4. Document policy logic

## API Development

### Route Structure

```
src/app/api/
├── auth/
│   └── sync-profile/
├── boards/
│   ├── route.ts          # GET, POST /api/boards
│   └── [id]/
│       └── route.ts      # GET, PATCH, DELETE /api/boards/:id
├── cards/
│   ├── route.ts          # GET, POST /api/cards
│   ├── [id]/
│   │   └── route.ts      # GET, PATCH, DELETE /api/cards/:id
│   └── bulk-reorder/
│       └── route.ts      # PATCH /api/cards/bulk-reorder
└── ...
```

### API Route Pattern

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const createSchema = z.object({
  name: z.string().min(1).max(100),
});

export async function POST(request: NextRequest) {
  try {
    // 1. Authentication
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Validation
    const body = await request.json();
    const validation = createSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      );
    }

    // 3. Business Logic
    const result = await performOperation(validation.data, user.id);

    // 4. Response
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

## Component Development

### Component Structure

```
src/components/
├── ui/                   # Base UI components (shadcn/ui)
│   ├── button.tsx
│   ├── input.tsx
│   └── ...
├── kanban/              # Feature-specific components
│   ├── KanbanBoard.tsx
│   ├── KanbanColumn.tsx
│   ├── KanbanCard.tsx
│   └── ...
└── layout/              # Layout components
    ├── Header.tsx
    ├── Sidebar.tsx
    └── ...
```

### Component Guidelines

1. **Single Responsibility**: Each component should have one clear purpose
2. **Composition**: Prefer composition over inheritance
3. **Props Interface**: Always define and export props interface
4. **Default Props**: Use default parameters instead of defaultProps

```typescript
interface CardProps {
  title: string;
  description?: string;
  onClick?: () => void;
  className?: string;
}

export function Card({ 
  title, 
  description, 
  onClick, 
  className 
}: CardProps) {
  return (
    <div className={cn('card', className)} onClick={onClick}>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
    </div>
  );
}
```

## State Management

### Local State

Use React's built-in state management:

```typescript
// Simple state
const [isLoading, setIsLoading] = useState(false);

// Complex state with reducer
const [state, dispatch] = useReducer(reducer, initialState);

// Custom hooks for reusable logic
function useBoard(boardId: string) {
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchBoard(boardId).then(setBoard).finally(() => setLoading(false));
  }, [boardId]);
  
  return { board, loading };
}
```

### Global State

For global state, use React Context:

```typescript
interface AppContextType {
  user: User | null;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
```

## Testing Strategy

### Unit Tests

Test individual functions and components:

```typescript
// utils.test.ts
import { formatDate } from './utils';

describe('formatDate', () => {
  it('should format date correctly', () => {
    const date = new Date('2024-01-01');
    expect(formatDate(date)).toBe('Jan 1, 2024');
  });
});
```

### Integration Tests

Test component interactions:

```typescript
// KanbanCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { KanbanCard } from './KanbanCard';

describe('KanbanCard', () => {
  it('should call onClick when clicked', () => {
    const onClick = jest.fn();
    render(<KanbanCard title="Test" onClick={onClick} />);
    
    fireEvent.click(screen.getByText('Test'));
    expect(onClick).toHaveBeenCalled();
  });
});
```

### E2E Tests

Test complete user flows:

```typescript
// e2e/board.spec.ts
import { test, expect } from '@playwright/test';

test('should create and manage board', async ({ page }) => {
  await page.goto('/dashboard');
  await page.click('text=Create Board');
  await page.fill('input[name="name"]', 'Test Board');
  await page.click('button[type="submit"]');
  
  await expect(page.locator('text=Test Board')).toBeVisible();
});
```

## Performance Guidelines

### React Performance

1. **Memoization**: Use React.memo for expensive components
2. **Callbacks**: Use useCallback for event handlers
3. **Effects**: Optimize useEffect dependencies

```typescript
const ExpensiveComponent = React.memo(({ data }: { data: Data[] }) => {
  const processedData = useMemo(() => {
    return data.map(item => expensiveOperation(item));
  }, [data]);

  return <div>{/* render processed data */}</div>;
});
```

### Bundle Optimization

1. **Dynamic Imports**: Use dynamic imports for large components
2. **Tree Shaking**: Import only what you need
3. **Code Splitting**: Split routes and features

```typescript
// Dynamic import
const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <Skeleton />,
});

// Tree shaking
import { format } from 'date-fns/format';
// Instead of: import { format } from 'date-fns';
```

## Security Guidelines

### Input Validation

Always validate inputs on both client and server:

```typescript
// Client-side validation
const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

// Server-side validation (required)
export async function POST(request: NextRequest) {
  const body = await request.json();
  const validation = schema.safeParse(body);
  
  if (!validation.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }
  
  // Process validated data
}
```

### Authentication

Always check authentication in API routes:

```typescript
export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Proceed with authenticated user
}
```

## Debugging

### Development Tools

1. **React DevTools**: Debug component state and props
2. **Network Tab**: Monitor API requests
3. **Console Logs**: Use structured logging

```typescript
// Structured logging
console.log('User action:', {
  action: 'create_card',
  userId: user.id,
  boardId: board.id,
  timestamp: new Date().toISOString(),
});
```

### Error Handling

Implement comprehensive error handling:

```typescript
try {
  const result = await riskyOperation();
  return result;
} catch (error) {
  // Log error for debugging
  console.error('Operation failed:', error);
  
  // Return user-friendly error
  throw new Error('Unable to complete operation. Please try again.');
}
```

## Contributing

### Pull Request Process

1. **Branch**: Create feature branch from main
2. **Develop**: Implement feature with tests
3. **Test**: Ensure all tests pass
4. **Review**: Submit PR for code review
5. **Merge**: Squash and merge after approval

### Commit Messages

Use conventional commits:

```
feat: add drag and drop functionality
fix: resolve authentication redirect issue
docs: update API documentation
test: add unit tests for card component
refactor: simplify board state management
```

### Code Review Checklist

- [ ] Code follows style guidelines
- [ ] Tests are included and passing
- [ ] Documentation is updated
- [ ] No security vulnerabilities
- [ ] Performance considerations addressed
- [ ] Accessibility requirements met
