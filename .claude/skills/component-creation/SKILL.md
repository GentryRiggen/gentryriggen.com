---
name: component-creation
description: This skill should be used when the user asks to "create a component", "add a new component", "build a section", "scaffold a component", or when creating any new React component for the site.
---

# Component Creation Skill

Follow these patterns when creating new components for gentryriggen.com.

## File Structure

Components go in `components/` at the project root:
```
components/
├── MyComponent.tsx
├── hooks/
│   └── useMyHook.ts
└── __tests__/
    └── MyComponent.test.tsx
```

## Component Patterns

### Server Component (default)
Use when the component has no interactivity, state, or browser APIs:

```tsx
interface MyComponentProps {
  title: string;
}

export default function MyComponent({ title }: MyComponentProps) {
  return <div>{title}</div>;
}
```

### Client Component
Add `"use client"` only when the component uses hooks, event handlers, or browser APIs:

```tsx
"use client";

import { useState } from "react";

interface MyComponentProps {
  initialValue: string;
}

export default function MyComponent({ initialValue }: MyComponentProps) {
  const [value, setValue] = useState(initialValue);
  return <button onClick={() => setValue("clicked")}>{value}</button>;
}
```

### Key Conventions
- Use `export default function` (not arrow functions)
- Define TypeScript `interface` for props (not `type`)
- Use `ReactNode` for children: `import { ReactNode } from "react"`
- Import path alias: `@/components/...`, `@/app/...`

## Testing Pattern

Every component needs a test file at `components/__tests__/ComponentName.test.tsx`.

### Basic Test Template

```tsx
import { render, screen } from "@testing-library/react";
import MyComponent from "../MyComponent";

describe("MyComponent", () => {
  it("renders expected content", () => {
    render(<MyComponent title="Hello" />);
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });
});
```

### When Mocking next/image

```tsx
jest.mock("next/image", () => ({
  __esModule: true,
  default: ({
    fill: _fill,
    priority: _priority,
    ...props
  }: React.ComponentPropsWithoutRef<"img"> & {
    fill?: boolean;
    priority?: boolean;
  }) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));
```

### Testing Interactive Components

```tsx
import { render, screen, fireEvent, act } from "@testing-library/react";

// Use jest.useFakeTimers() for timer-dependent tests
beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  act(() => jest.runOnlyPendingTimers());
  jest.useRealTimers();
});
```

### Testing Hooks

Custom hooks go in `components/hooks/` with tests in `components/__tests__/`:

```tsx
import { renderHook, act } from "@testing-library/react";
import { useMyHook } from "../hooks/useMyHook";

describe("useMyHook", () => {
  it("returns expected value", () => {
    const { result } = renderHook(() => useMyHook());
    expect(result.current.value).toBe("expected");
  });
});
```

## Styling Rules

- Use Tailwind CSS classes exclusively (no inline styles, no CSS modules)
- Always support dark mode: `text-gray-900 dark:text-white`
- Mobile-first responsive: base styles, then `sm:`, `md:`, `lg:`
- See the `frontend-design` skill for full styling guidelines

## Running Tests

```bash
npm test             # Run all unit tests
npm test -- --watch  # Watch mode
npm run test:e2e     # Run Playwright E2E tests
```

## Key Files

- `jest.config.js` - Jest configuration (jsdom environment)
- `jest.setup.js` - Test setup (imports @testing-library/jest-dom)
- `playwright.config.ts` - E2E test configuration
- `e2e/home.spec.ts` - Existing E2E tests
