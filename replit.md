# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

### WeName (mobile, Expo)
Native rebuild of the Tinder-style baby-name swiping app for couples. Reuses the existing Supabase backend (URL/anon key in `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`). Anonymous-user pattern: a UUID is created server-side on first launch and persisted in AsyncStorage under key `baby_picker_user_id` (mirrors the web app's localStorage key, so devices with the same id see the same data).

Key flow: `app/index.tsx` redirects to `/onboarding` if `wename_onboarded != "true"` in AsyncStorage, otherwise into the tabs (Swipe / Names / Settings). `app/join/[token].tsx` handles deep-link partner invites. Daily free limits (30 swipes / 8 likes / 3 matches) enforced by `hooks/useDailyLimits.ts` with a `PremiumModal` upgrade nudge. Swipe gestures use `react-native-reanimated` + `react-native-gesture-handler`.

**Web font loading**: Font TTF files (Fredoka, PatrickHand, Feather, FontAwesome, FontAwesome5) are committed to `artifacts/wename/assets/fonts/`. The web layout (`_layout.web.tsx`) calls `Font.loadAsync` at module level with direct `require()` calls to these files. This bypasses a Netlify limitation where files in `.pnpm` directories are not served (they start with a dot). CSS `@font-face` rules for italic variants are also injected at module level using hashed asset paths (`[name].[md5hash].ttf`).

### WeName Landing (web, react-vite)
Marketing landing page for the WeName mobile app. Single-page React + Vite app at `artifacts/landing/`, served at preview path `/landing/` in dev and intended to deploy to wename.app at root in production. No backend.

Built by a DESIGN subagent following the storybook-parchment aesthetic of the mobile app. Uses Tailwind v4, Framer Motion for scroll-triggered reveals, Fredoka + Patrick Hand fonts, and the WeName brand palette (parchment cream, deep brown, boy-blue, girl-pink, sun-gold, grass-green). Brand image assets (boy-card-bg.jpg, girl-card-bg.jpg, like_sun.png, butterfly.png, grass-flower-border.png, wename-logo.png, icon.png) are copied into `artifacts/landing/public/brand/` from the mobile app and referenced via `${import.meta.env.BASE_URL}brand/<file>` so they work under both the `/landing/` dev base path and a root production deploy. The body parchment-texture background lives in `artifacts/landing/src/assets/paper-texture.jpg` and is referenced from `src/index.css` via a relative `url('./assets/paper-texture.jpg')` so Vite bundles and rewrites the URL correctly under any base path (avoids dev CSP issues with inline-style backgrounds).
