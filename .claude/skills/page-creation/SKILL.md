---
name: page-creation
description: This skill should be used when the user asks to "add a page", "create a new page", "add a route", "create a new section of the site", or when adding new pages/routes to the website.
---

# Page Creation Skill

Follow these patterns when adding new pages to gentryriggen.com.

## Framework

Next.js 16 with App Router. Pages are file-based routes in `app/`.

## Current Site Structure

```
app/
├── layout.tsx      # Root layout (font, metadata, ThemeProvider)
├── page.tsx        # Home page (/)
├── globals.css     # Global styles
└── __tests__/
    └── page.test.tsx
```

The site is statically exported (`output: "export"` in `next.config.ts`), so all pages must be compatible with static generation. No server-side features (API routes, SSR, middleware, dynamic routes with generateStaticParams missing).

## Adding a New Page

### 1. Create the Route

```
app/
└── about/
    └── page.tsx    # Creates /about route
```

### 2. Page Template

```tsx
import SomeComponent from "@/components/SomeComponent";
import ThemeToggle from "@/components/ThemeToggle";
import AnimatedBackground from "@/components/AnimatedBackground";

export default function AboutPage() {
  return (
    <div className="min-h-screen text-gray-900 dark:text-white transition-colors overflow-visible relative">
      <div className="fixed inset-0 bg-white dark:bg-slate-950 -z-20" />
      <AnimatedBackground />
      <ThemeToggle />
      <main className="overflow-visible relative z-10">
        {/* Page content */}
      </main>
    </div>
  );
}
```

### 3. Page Metadata

Add metadata export for SEO:

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About | Gentry Riggen",
  description: "About Gentry Riggen",
};
```

## Layout Patterns

### Shared Layout Elements
These are used on every page and should be included:
- `AnimatedBackground` - floating gradient orbs
- `ThemeToggle` - dark/light mode switch (fixed top-right)
- Background div: `<div className="fixed inset-0 bg-white dark:bg-slate-950 -z-20" />`

### Content Container
```tsx
<section className="min-h-screen flex flex-col items-center justify-center px-6 sm:px-6 py-4 sm:py-8 md:py-12 lg:py-16">
  <div className="max-w-4xl mx-auto w-full">
    {/* Content */}
  </div>
</section>
```

## Navigation

The site currently has no navigation component. If adding multiple pages, create a `Nav` component following the patterns in the `component-creation` skill.

## Testing

### Unit Test (page.test.tsx)

```tsx
import { render, screen } from "@testing-library/react";
import AboutPage from "../page";

describe("About Page", () => {
  it("renders the page content", () => {
    render(<AboutPage />);
    expect(screen.getByText(/expected text/)).toBeInTheDocument();
  });
});
```

### E2E Test

Add tests to `e2e/` directory:

```ts
import { test, expect } from "@playwright/test";

test.describe("About Page", () => {
  test("should display content", async ({ page }) => {
    await page.goto("/about");
    await expect(page.getByText("About")).toBeVisible();
  });
});
```

## Static Export Constraints

Because of `output: "export"` in `next.config.ts`:
- No `getServerSideProps` or API routes
- Dynamic routes need `generateStaticParams()`
- No `next/headers` or `next/cookies`
- Images use `unoptimized: true`
- All data must be available at build time

## Key Files

- `next.config.ts` - Next.js config (static export enabled)
- `app/layout.tsx` - Root layout wrapping all pages
- `app/page.tsx` - Home page (reference implementation)
- `components/AnimatedBackground.tsx` - Background effect
- `components/ThemeToggle.tsx` - Theme toggle button
