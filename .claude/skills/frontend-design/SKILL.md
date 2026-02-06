---
name: frontend-design
description: This skill should be used when the user asks to "style a component", "update the design", "change colors", "fix the layout", "add dark mode support", "make it responsive", "add an animation", or any UI/visual styling task.
---

# Frontend Design Skill

Apply these design patterns when styling components for gentryriggen.com.

## Tech Stack

- **Tailwind CSS 4** via `@import "tailwindcss"` in `app/globals.css`
- **Dark mode**: class-based strategy (`.dark` class on `<html>`)
- **Custom variant**: `@custom-variant dark (&:where(.dark, .dark *));` in globals.css
- **Font**: Inter (Google Font, variable `--font-inter`)
- **Config**: `tailwind.config.ts` uses defaults with `darkMode: "class"`

## Color System

### Theme Colors
- **Light background**: white (`#ffffff`) / `bg-white`
- **Dark background**: slate-950 (`#020617`) / `dark:bg-slate-950`
- **Light text**: gray-900 / `text-gray-900`
- **Dark text**: white / `dark:text-white`
- **Accent**: purple-600 (light) / purple-500 (dark) for interactive elements

### Every element MUST support both light and dark mode

Pattern: `bg-gray-100 dark:bg-white/5 text-gray-900 dark:text-white`

## Glass Morphism Card Pattern

Use this for card containers:
```
bg-gray-100/80 dark:bg-white/5 backdrop-blur-sm border border-gray-300/50 dark:border-white/10 rounded-2xl sm:rounded-3xl
```

## Responsive Breakpoints

Use Tailwind defaults, mobile-first:
- Base: mobile
- `sm:` (640px)
- `md:` (768px)
- `lg:` (1024px)

Example responsive padding: `p-8 sm:p-8 md:p-10 lg:p-12`
Example responsive text: `text-lg sm:text-lg md:text-xl`

## Interactive Elements

Buttons and links use:
```
transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-110 active:scale-95
```

Social button pattern:
```
p-4 bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600 rounded-full text-white
```

## Accessibility

- All interactive elements need `aria-label`
- Focus styles defined globally in `globals.css`:
  ```css
  a:focus-visible, button:focus-visible {
    outline: 2px solid rgb(147, 51, 234);
    outline-offset: 2px;
    border-radius: 0.5rem;
  }
  ```

## Animation Patterns

Custom animations live in `app/globals.css`. Existing animations:
- `animate-gradient` - 3s gradient position loop
- `animate-float-1` through `animate-float-7` - floating orb movement (18-30s)
- `animate-bounce-click` - click feedback (0.4s)
- `animate-shake-no` - cooldown shake (0.5s)
- `animate-mesh` - opacity/rotation effect (15s)

When adding new animations, define `@keyframes` and utility class in `globals.css`.

## Layout Patterns

- Max content width: `max-w-4xl mx-auto w-full`
- Page container: `min-h-screen` with flex centering
- Background layers use `fixed inset-0` with negative z-index
- Main content uses `relative z-10`

## Key Files

- `app/globals.css` - Global styles, animations, custom Tailwind variant
- `tailwind.config.ts` - Tailwind configuration
- `app/layout.tsx` - Root layout, font setup, theme initialization
- `components/ThemeProvider.tsx` - Theme context (light/dark toggle)
- `components/AnimatedBackground.tsx` - Floating gradient orbs with parallax
