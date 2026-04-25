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
