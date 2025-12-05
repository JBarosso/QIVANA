# Components

This folder contains all reusable components for the Qivana application.

## Structure

- **`/react`** → React components (TSX) for interactive features
- **Root** → Astro components (.astro) for static/lightly interactive elements

## Naming Convention

Use BEM naming for CSS classes:

- Block: `.component-name`
- Element: `.component-name__element`
- Modifier: `.component-name--modifier`

## Style Files

Each component should have a corresponding SCSS file in:

`/src/styles/component/_component-name.scss`

## Guidelines

1. **Default to Astro components** unless you need:
   - Complex client-side state
   - Advanced interactivity
   - Real-time updates

2. **Always follow BEM naming**
3. **No inline styles**
4. **Use Design System tokens** (variables, mixins)

---

Components will be created starting from Milestone 2.
