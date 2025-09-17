import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock environment variables
Object.assign(process.env, {
  NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  NODE_ENV: 'test'
});

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/test-path',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      admin: {
        inviteUserByEmail: vi.fn(),
        updateUserById: vi.fn(),
        deleteUser: vi.fn(),
      },
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
          order: vi.fn(() => ({
            range: vi.fn(),
          })),
        })),
        ilike: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              range: vi.fn(),
            })),
          })),
        })),
      })),
      insert: vi.fn(),
      update: vi.fn(() => ({
        eq: vi.fn(),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(),
      })),
    })),
  })),
}));

// Mock date-fns
vi.mock('date-fns', () => ({
  formatDistanceToNow: vi.fn(() => '2 hours'),
  format: vi.fn(() => '2023-01-01 12:00:00'),
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => {
  const MockIcon = ({ className, ...props }: any) => {
    return { className, 'data-testid': 'mock-icon', ...props };
  };

  return new Proxy({}, {
    get: () => MockIcon,
  });
});

// Global test utilities
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock window.scrollTo
Object.defineProperty(window, 'scrollTo', {
  writable: true,
  value: vi.fn(),
});

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// Test helpers
export const createMockUser = (overrides = {}) => ({
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  createdAt: new Date('2023-01-01'),
  ...overrides,
});

export const createMockBoard = (overrides = {}) => ({
  id: 'test-board-id',
  name: 'Test Board',
  isArchived: false,
  createdAt: '2023-01-01T00:00:00Z',
  ownerId: 'test-owner-id',
  role: 'admin',
  columns: [],
  members: [],
  labels: [],
  ...overrides,
});

export const createMockMembership = (overrides = {}) => ({
  id: 'test-membership-id',
  email: 'member@example.com',
  name: 'Test Member',
  role: 'member',
  joinedAt: '2023-01-01T00:00:00Z',
  createdAt: '2023-01-01T00:00:00Z',
  activity: {
    assignedCards: 5,
    comments: 10,
  },
  ...overrides,
});

export const createMockAuditLog = (overrides = {}) => ({
  id: 'test-audit-log-id',
  action: 'invite_user',
  details: {
    email: 'newuser@example.com',
    role: 'member',
  },
  createdAt: '2023-01-01T00:00:00Z',
  adminUser: {
    id: 'admin-user-id',
    email: 'admin@example.com',
    name: 'Admin User',
  },
  targetUser: {
    id: 'target-user-id',
    email: 'target@example.com',
    name: 'Target User',
  },
  ipAddress: '127.0.0.1',
  userAgent: 'test-agent',
  ...overrides,
});

// Mock fetch for API tests
export const mockFetch = (response: any, options: { ok?: boolean; status?: number } = {}) => {
  const { ok = true, status = 200 } = options;
  
  global.fetch = vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(response),
    text: () => Promise.resolve(JSON.stringify(response)),
  });
};

// Cleanup function for tests
export const cleanup = () => {
  vi.clearAllMocks();
  vi.resetAllMocks();
};

// Custom render function for React components with providers
import { render, RenderOptions } from '@testing-library/react';
import { ReactElement } from 'react';

const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return children as React.ReactElement;
};

export const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

// Re-export everything from testing library
export * from '@testing-library/react';
export { customRender as render };
