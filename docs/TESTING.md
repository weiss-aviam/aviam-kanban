# Testing Guide

This document provides comprehensive information about testing the user management functionality and the overall Kanban application.

## Testing Stack

- **Test Runner**: Vitest
- **Testing Library**: React Testing Library
- **Environment**: jsdom
- **Coverage**: v8 provider
- **Mocking**: Vitest built-in mocking

## Test Structure

```
src/
├── __tests__/
│   ├── setup.ts                    # Test setup and global mocks
│   ├── api/
│   │   └── admin/
│   │       ├── users.test.ts       # API endpoint tests
│   │       ├── memberships.test.ts
│   │       └── audit-logs.test.ts
│   ├── components/
│   │   └── admin/
│   │       ├── UserManagementModal.test.tsx
│   │       ├── UserList.test.tsx
│   │       ├── InviteUserForm.test.tsx
│   │       └── MembershipTable.test.tsx
│   ├── hooks/
│   │   ├── useUserManagement.test.ts
│   │   ├── useBoardMemberships.test.ts
│   │   └── useAuditLogs.test.ts
│   └── lib/
│       ├── security/
│       │   ├── admin-security.test.ts
│       │   ├── rate-limiter.test.ts
│       │   └── input-sanitizer.test.ts
│       └── validations/
│           └── admin.test.ts
```

## Running Tests

### Basic Commands

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

### Specific Test Categories

```bash
# Run API tests only
npm run test -- api

# Run component tests only
npm run test -- components

# Run hook tests only
npm run test -- hooks

# Run security tests only
npm run test -- security
```

### Test Patterns

```bash
# Run specific test file
npm run test -- UserManagementModal

# Run tests matching pattern
npm run test -- --grep "invite user"

# Run tests in specific directory
npm run test -- src/__tests__/api/
```

## Test Categories

### 1. API Endpoint Tests

Test all admin API endpoints with comprehensive scenarios:

```typescript
describe("/api/admin/users", () => {
  it("should return unauthorized when user is not authenticated", async () => {
    // Test authentication failure
  });

  it("should return forbidden when user is not admin", async () => {
    // Test authorization failure
  });

  it("should return paginated users when request is valid", async () => {
    // Test successful operation
  });

  it("should handle validation errors", async () => {
    // Test input validation
  });
});
```

**Coverage Areas:**

- Authentication and authorization
- Input validation and sanitization
- Rate limiting
- Error handling
- Success scenarios
- Edge cases

### 2. React Component Tests

Test all user management UI components:

```typescript
describe("UserManagementModal", () => {
  it("should render modal when open is true", () => {
    // Test component rendering
  });

  it("should switch tabs when clicked", async () => {
    // Test user interactions
  });

  it("should handle user actions and trigger refresh", () => {
    // Test event handling
  });
});
```

**Coverage Areas:**

- Component rendering
- User interactions
- State management
- Props handling
- Event callbacks
- Accessibility

### 3. Custom Hook Tests

Test all custom hooks with React Testing Library:

```typescript
describe("useUserManagement", () => {
  it("should fetch users successfully", async () => {
    // Test successful API calls
  });

  it("should handle fetch errors", async () => {
    // Test error handling
  });

  it("should manage loading state correctly", async () => {
    // Test loading states
  });
});
```

**Coverage Areas:**

- API integration
- State management
- Error handling
- Loading states
- Optimistic updates
- Cache management

### 4. Security Tests

Test security utilities and middleware:

```typescript
describe("AdminSecurityMiddleware", () => {
  it("should validate admin permissions correctly", async () => {
    // Test permission validation
  });

  it("should apply rate limiting", async () => {
    // Test rate limiting
  });

  it("should sanitize input data", async () => {
    // Test input sanitization
  });
});
```

**Coverage Areas:**

- Authentication validation
- Authorization checks
- Rate limiting
- Input sanitization
- XSS prevention
- SQL injection prevention

## Test Utilities

### Mock Helpers

The test setup provides several mock helpers:

```typescript
import {
  createMockUser,
  createMockBoard,
  createMockMembership,
  createMockAuditLog,
  mockFetch,
  cleanup,
} from "@/__tests__/setup";

// Create mock data
const user = createMockUser({ role: "admin" });
const board = createMockBoard({ name: "Test Board" });

// Mock API responses
mockFetch({ users: [user], pagination: {} });

// Cleanup after tests
afterEach(cleanup);
```

### Custom Render

Use the custom render function for components that need providers:

```typescript
import { render, screen } from '@/__tests__/setup';

test('component with providers', () => {
  render(<MyComponent />);
  expect(screen.getByText('Hello')).toBeInTheDocument();
});
```

## Mocking Strategy

### External Dependencies

All external dependencies are mocked at the setup level:

- **Supabase**: Mocked with configurable responses
- **Next.js Router**: Mocked navigation functions
- **Date Functions**: Mocked for consistent test results
- **Icons**: Mocked to simple div elements

### API Calls

API calls are mocked using the global fetch mock:

```typescript
// Mock successful response
mockFetch({
  users: [mockUser],
  pagination: { total: 1 },
});

// Mock error response
mockFetch({ error: "User not found" }, { ok: false, status: 404 });
```

### Environment Variables

Test environment variables are set in the setup file:

```typescript
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
```

## Coverage Requirements

### Minimum Coverage Thresholds

- **Branches**: 80%
- **Functions**: 80%
- **Lines**: 80%
- **Statements**: 80%

### Coverage Reports

Coverage reports are generated in multiple formats:

- **Text**: Console output
- **JSON**: Machine-readable format
- **HTML**: Interactive browser report

View HTML coverage report:

```bash
npm run test:coverage
open coverage/index.html
```

## Best Practices

### Test Organization

1. **Group related tests** using `describe` blocks
2. **Use descriptive test names** that explain the scenario
3. **Follow AAA pattern**: Arrange, Act, Assert
4. **Test one thing at a time**

### Test Data

1. **Use factory functions** for creating test data
2. **Keep test data minimal** and focused
3. **Use realistic data** that matches production
4. **Avoid hardcoded values** when possible

### Async Testing

1. **Use async/await** for async operations
2. **Wait for state changes** with `waitFor`
3. **Test loading states** explicitly
4. **Handle promise rejections** properly

### Error Testing

1. **Test both success and failure scenarios**
2. **Verify error messages** are user-friendly
3. **Test error recovery** mechanisms
4. **Check error logging** is working

## Debugging Tests

### Common Issues

1. **Async timing issues**: Use `waitFor` and `act`
2. **Mock not working**: Check mock setup and imports
3. **Component not rendering**: Verify props and providers
4. **API calls failing**: Check fetch mock configuration

### Debug Tools

```bash
# Run single test with debug output
npm run test -- --reporter=verbose UserManagement

# Run tests with browser debugging
npm run test:ui

# Check test coverage for specific file
npm run test:coverage -- --reporter=html UserManagement
```

### Console Debugging

Add debug output to tests:

```typescript
import { screen, debug } from '@testing-library/react';

test('debug component', () => {
  render(<MyComponent />);

  // Print component tree
  debug();

  // Print specific element
  debug(screen.getByRole('button'));
});
```

## Continuous Integration

### GitHub Actions

Tests run automatically on:

- Pull requests
- Pushes to main branch
- Scheduled runs (daily)

### Test Pipeline

1. **Install dependencies**
2. **Run linting**
3. **Run type checking**
4. **Run tests with coverage**
5. **Upload coverage reports**
6. **Fail on coverage below threshold**

### Performance

- **Parallel execution**: Tests run in parallel for speed
- **Smart caching**: Dependencies and build artifacts cached
- **Selective testing**: Only run tests for changed files (future)

## Maintenance

### Regular Tasks

1. **Update test dependencies** monthly
2. **Review and update mocks** when APIs change
3. **Add tests for new features**
4. **Refactor tests** when code changes
5. **Monitor coverage trends**

### Test Health

- **Remove flaky tests** or fix root causes
- **Keep tests fast** (< 10 seconds per test)
- **Maintain high coverage** (> 80%)
- **Update documentation** when patterns change
