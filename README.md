# 🎮 QIVANA

Plateforme de quiz geek alimentée par l'IA.

## 📋 Status

**Current Milestone:** Milestone 1 - Database Schema ✅ (avec RLS sécurisé)

## 🛠 Tech Stack

- **Framework:** Astro 4.x
- **UI Library:** React (islands only)
- **Language:** TypeScript
- **Styles:** SCSS + BEM
- **Backend:** Supabase
- **Hosting:** Vercel

## 📂 Project Structure

```
/src
  /components       → Reusable components (.astro & React)
  /layouts          → Page layouts
  /pages            → Astro pages (routes)
  /api              → API routes
  /lib              → Utilities, helpers
  /db               → Supabase config
  /types            → TypeScript types
  /styles           → SCSS (Design System)
    /design-system  → Tokens, variables, mixins
    /layout         → Layout SCSS
    /component      → Component SCSS
  /utils            → Utils functions
/public
  /images           → Static images
  /fonts            → Custom fonts
```

## 🚀 Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Setup environment variables

Create a `.env` file at the root with:

```env
PUBLIC_SUPABASE_URL=https://your-project.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
NODE_ENV=development
PUBLIC_APP_URL=http://localhost:4321
```

### 3. Run development server

```bash
npm run dev
```

The app will be available at [http://localhost:4321](http://localhost:4321)

## 📚 Documentation

Documentation complète dans le dossier `/docs/` :

### Core Documentation
- **docs/AI_GUIDE_FRONT.md** → Development guide & formatting rules
- **docs/context.md** → Functional specification
- **docs/roadmap.md** → Development milestones

### Technical Documentation
- **docs/DATABASE_SCHEMA.md** → Database architecture & relations
- **docs/RLS_POLICIES.md** → Row Level Security policies
- **docs/ASTRO_5_MIGRATION.md** → Astro 5 migration notes

### Auxiliary
- **docs/badges.md** → Gamification system (optional reference)
- **SECURITY.md** → Security advisories & npm audit tracking

## 🎨 Design System

All design tokens (colors, typography, spacing, animations) are defined in:

- `src/styles/frameworkCss/_tokens.scss` (Qivana colors + fluid spacing)
- `src/styles/frameworkCss/_mixins.scss` (Responsive, animations, a11y)
- `src/styles/frameworkCss/utilities/` (Tailwind-style utilities)

**Visual Identity:** Neo-Pop-Geek Minimalist

**Colors:**
- Primary: Violet (#7C3AED), Indigo (#4F46E5)
- Accents: Cyan (#0EA5E9), Pink (#EC4899), Gold (#FACC15)

**Typography:**
- Headings: Sora
- Body: Inter

## 🧪 Scripts

```bash
npm run dev         # Start dev server
npm run build       # Build for production
npm run preview     # Preview production build
npm run lint        # Lint code
npm run lint:fix    # Lint and auto-fix
npm run format      # Format with Prettier
```

## 📦 Milestones Progress

- ✅ Milestone 0: Project Initialization
- ✅ Milestone 1: Database Schema
- ⏳ Milestone 2: Authentication
- ⏳ Milestone 3: Core Quiz Engine
- ⏳ Milestone 4: AI Quiz Generator
- ⏳ Milestone 5: Prompt Libre AI Mode
- ⏳ Milestone 6: Advanced Quiz UX
- ⏳ Milestone 7: Salons & Duels
- ⏳ Milestone 8: Profile, Badges, Streaks
- ⏳ Milestone 9: Admin Panel
- ⏳ Milestone 10: Monetization (Stripe)
- ⏳ Milestone 11: Polish & QA

---

**Made with 💜 for geeks, by geeks.**
