# Testing Guide

This document describes the testing setup and how to run tests for the KLAUS application.

## Testing Infrastructure

### Frontend Tests (Vitest)
- **Framework**: Vitest
- **Testing Library**: @testing-library/react
- **Environment**: jsdom
- **Location**: `src/**/__tests__/**/*.test.tsx`

### Backend Tests (Jest)
- **Framework**: Jest
- **Location**: `server/__tests__/**/*.test.js`

## Running Tests

### Frontend Tests

```bash
# Run all frontend tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

### Backend Tests

```bash
cd server

# Run all backend tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Test Structure

### Frontend Test Example

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import MyComponent from '../MyComponent'

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />)
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })
})
```

### Backend Test Example

```javascript
import { describe, it, expect } from '@jest/globals'

describe('API Endpoint', () => {
  it('should return 200 on success', async () => {
    // Test implementation
    expect(true).toBe(true)
  })
})
```

## Writing Tests

### Best Practices

1. **Test Structure**: Use describe blocks to group related tests
2. **Test Names**: Use descriptive test names that explain what is being tested
3. **Arrange-Act-Assert**: Follow the AAA pattern
4. **Isolation**: Each test should be independent and not rely on other tests
5. **Mocking**: Mock external dependencies (APIs, file system, etc.)

### Frontend Testing

- Test user interactions, not implementation details
- Use `screen` queries to find elements
- Test accessibility where possible
- Mock API calls using `vi.mock()`

### Backend Testing

- Test API endpoints with different scenarios
- Test authentication and authorization
- Test error handling
- Use test databases or mock data files

## Coverage Goals

- **Target Coverage**: 80%+
- **Critical Paths**: 100% coverage
- **Focus Areas**:
  - Authentication flows
  - Project CRUD operations
  - Invoice extraction
  - Permission checks

## Continuous Integration

Tests should be run automatically in CI/CD pipeline:
- On every pull request
- Before merging to main
- On every commit (optional)

## Troubleshooting

### Frontend Tests
- If tests fail with module resolution errors, check `vitest.config.ts`
- Ensure `@testing-library/jest-dom` is imported in setup file
- Check that jsdom environment is configured

### Backend Tests
- Ensure `NODE_OPTIONS=--experimental-vm-modules` is set for ES modules
- Check that test data files are properly cleaned up
- Verify Jest configuration matches your setup

## Next Steps

1. Add more comprehensive test coverage
2. Add E2E tests with Playwright or Cypress
3. Set up CI/CD pipeline with automated testing
4. Add performance tests
5. Add accessibility tests




