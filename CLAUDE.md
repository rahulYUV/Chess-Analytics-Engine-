# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chess-Analytics-Engine is a full-stack web application that provides analytics and insights for Chess.com players. It supports player profile viewing, two-player comparison, opening repertoires, activity heatmaps, and a feedback form. The stack is split between a Node/Express backend and a React/Vite frontend.

## Common Commands

### Backend (root directory)

```bash
npm install              # install backend deps
npm run dev              # start backend (nodemon on index.ts), http://localhost:3000
npm run build            # tsc → dist/
npm start                # node dist/index.js (production)
npx ts-node test-db.ts   # quick MongoDB connectivity smoke test
```

There is no test runner — `npm test` just echoes an error and exits. `test-db.ts` is a manual connectivity check, not a test.

### Frontend (`client/` directory)

```bash
cd client
npm install
npm run dev              # vite dev server, usually http://localhost:5173
npm run build            # vite build
npm run preview          # preview production build
npm run lint             # eslint .
```

### One-off utility

`get_avatars.js` (root) is a standalone script that writes `avatars.json` for the hard-coded "famous players" list. Run with `node get_avatars.js` — no package install needed beyond deps already in root `package.json`.

### Postman collection

`Chess_Stats_API.postman_collection.json` documents the full backend API and can be imported into Postman for manual testing.

## Environment Setup

Create a `.env` at the repo root (see `.env.example`). Required keys: `PORT`, `MONGODB_URI`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRY`, `JWT_REFRESH_EXPIRY`, `CLIENT_URL`, `NODE_ENV`. JWT secrets must be ≥32 chars.

The frontend reads `VITE_API_URL` from `client/.env` (see `client/.env.example`), defaulting to `http://localhost:3000`.

## High-Level Architecture

### Backend (root `index.ts` + `src/`)

Classic Express + Mongoose layered architecture:

- **`index.ts`** — entry point. Loads env, connects DB, configures Passport, mounts CORS/JSON/cookie/Passport middleware, mounts the central router, registers a 404 handler and a global error handler, then starts the HTTP server with graceful SIGTERM/SIGINT shutdown.
- **`src/routes/index.ts`** — top-level router that mounts `/auth`, `/player`, and `/` (general).
- **`src/routes/{auth,player,general}.routes.ts`** — route definitions; controllers are wired in here, not in controllers.
- **`src/controllers/`** — thin handlers: parse request → call service → respond (or `handleError` from `utils/helpers.ts`).
- **`src/services/`** — business logic.
  - **`chess.service.ts`** — wraps the `chess-web-api` library and adds a single source of truth for fetching/aggregating player data, comparisons, monthly archives, and derived insights (heatmap, openings, color win rates, recent games).
  - **`cache.service.ts`** — singleton in-memory `node-cache` (default 24h TTL) with a `getOrSet(key, fetchFn)` helper. Every public method in `chess.service` is wrapped in `cacheService.getOrSet`.
  - **`auth.service.ts`** — user lookup/creation, refresh-token rotation (capped at 5 per user).
- **`src/middleware/auth.middleware.ts`** — JWT bearer-token verification; attaches `req.user = {userId, email, role}`. Variants: `authMiddleware` (required), `adminMiddleware` (role guard), `optionalAuthMiddleware`.
- **`src/config/`** — DB connection (warns but does not crash if `MONGODB_URI` is missing) and Passport Google OAuth strategy.
- **`src/models/`** — Mongoose schemas: `User` (with `refreshTokens[]` for multi-device logout), `Visitor` (single global counter), `Comment`.
- **`src/utils/`** — `helpers.ts` (`handleError`, `processData` adds `*_formatted` siblings to numeric timestamps, `mapWithConcurrency` for bounded-parallel archive fetches), `jwt.utils.ts`, `chesscom.utils.ts` (axios-based username validation).

### Frontend (`client/src/`)

React 19 + Vite + TypeScript SPA. Three routes (see `App.tsx`): `/`, `/profile`, `/auth/callback`.

- **`App.tsx`** — owns the search/mode/loading state for the home view; uses an `AbortController` ref to cancel in-flight fetches on mode change. Mode switch (`profile` / `stats` / `compare` / `insights`) maps to backend endpoints.
- **`contexts/AuthContext.tsx`** — wraps the app, persists `accessToken`/`refreshToken` in `localStorage`, decodes the JWT to detect expiry, silently refreshes on mount, exposes `login`/`logout`/`refreshAccessToken`.
- **`components/`** — feature components (`stats-grid`, `comparison-view`, `insights-view`, `feedback-form`, etc.) and a `ui/` directory of shadcn/ui primitives (Radix + Tailwind). Custom shadcn components live in `components/shadcn-studio/` and `components/ui/`.
- **`types.ts`** — `PlayerData` and `ComparisonData` shared shapes.

## Key Architectural Notes

- **Caching strategy**: every public `chess.service` method keys its cache on the player username(s). `getPlayerFull`, `getPlayerStats`, `getPlayerInsights`, and `comparePlayers` all return cached results until TTL expires or someone calls `POST /cache/flush`. Be aware that stale data is possible and that the cache lives in process memory (no Redis).
- **Auth flow**: Google OAuth → Passport → JWT access + refresh tokens issued → tokens passed back to the client via URL query on `/auth/callback` → client stores in `localStorage` and attaches `Authorization: Bearer <accessToken>` on private endpoints. Refresh tokens are server-tracked (rotated, capped at 5 per user in `User.refreshTokens`).
- **Compare endpoint lives under `/compare/:p1/:p2`**, not under `/player/`, because it is a 2-player aggregation. The merged history forward-fills missing player data points.
- **Insights aggregation** fetches the last 3 monthly archives concurrently (concurrency=5) and derives: a 7×24 weekday-hour activity heatmap, top 10 openings split by color, white/black win rates, and the last 30 days of games (used by the opening explorer). All inside one cached call.
- **MongoDB is optional at startup** — `connectDB` only warns on failure, so backend routes that hit Mongo (auth, comments, visitor count) will 500 if it isn't running, but chess-data routes work fine.
- **`processData`** recursively adds `*_formatted` ISO strings for any numeric `date` / `joined` / `last_online` field, so the frontend can read either raw epoch or formatted strings off the same payload.
- **TypeScript settings**: `strict: true`, `noImplicitAny: false` (be explicit anyway), `module: commonjs`, `outDir: dist/`. The frontend is a separate Vite project with its own `tsconfig` and uses the `@/` path alias (configured via `vite-tsconfig-paths`/Vite).
- **No automated test suite exists** in either backend or frontend. Manual verification is via the Postman collection, the dev servers, and `test-db.ts`.

## Conventions

- New backend endpoints: add to the appropriate `src/routes/*.routes.ts`, implement handler in `src/controllers/*.controller.ts`, and put any logic in `src/services/`. If it touches Chess.com data, wrap the body in `cacheService.getOrSet`.
- New authenticated endpoints: add `authMiddleware` to the route. Use `adminMiddleware` after it for role-restricted routes.
- Frontend uses Tailwind + shadcn/ui primitives in `client/src/components/ui/`. New shared UI should go there; feature-specific UI in `client/src/components/`.
- Use the `PlayerData` / `ComparisonData` types in `client/src/types.ts` for API responses; extend them rather than creating ad-hoc shapes.
