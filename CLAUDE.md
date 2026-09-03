# Chess Analytics Engine

## Project Overview

Chess Analytics Engine is a full-stack TypeScript application for exploring Chess.com player data and analyzing games. It includes player profiles, statistics, comparisons, opening insights, activity visualizations, authenticated game analysis, and a Stockfish-powered analysis board.

## Repository Structure

- `index.ts`: Express API entry point.
- `src/config/`: MongoDB and Passport configuration.
- `src/controllers/`: HTTP request handlers.
- `src/middleware/`: Authentication, database readiness, and rate limiting.
- `src/models/`: Mongoose models for users, analyses, comments, and visitors.
- `src/routes/`: Express route definitions.
- `src/services/`: Chess.com integration, caching, authentication, and analysis logic.
- `src/utils/`: JWT, Chess.com, and shared helper utilities.
- `client/src/`: React frontend.
- `client/src/components/analysis/`: Game list and analysis board UI.
- `client/src/engine/`: Stockfish web worker and move-teaching logic.

## Technology Stack

### Backend

- Node.js, Express 5, and TypeScript.
- MongoDB with Mongoose.
- Chess.com public API through `chess-web-api` and direct archive requests.
- Node-cache for in-memory external API caching.
- JWT access and refresh tokens.
- Email/password authentication with bcryptjs.
- Google OAuth through Passport.
- Express rate limiting and CORS.

### Frontend

- React 19, Vite, and TypeScript.
- React Router for client-side navigation.
- Tailwind CSS, Radix UI, and reusable local UI components.
- Recharts for analytics visualizations.
- Chess.js for PGN parsing and board state.
- Stockfish 16 in a web worker for engine analysis.
- Motion animations and Web Audio API move sounds.

## Local Development

Install dependencies in both application directories:

```bash
npm install
cd client
npm install
```


```env
PORT=3000
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>/<database>
GOOGLE_CLIENT_ID=<google-client-id>
GOOGLE_CLIENT_SECRET=<google-client-secret>
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
JWT_ACCESS_SECRET=<long-access-secret>
JWT_REFRESH_SECRET=<long-refresh-secret>
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
CLIENT_URL=http://localhost:5173
NODE_ENV=development
```

The frontend may use `client/.env` for:

```env
VITE_API_URL=http://localhost:3000
```

Run the backend from the repository root:

```bash
npm run dev
```

Run the frontend in a second terminal:

```bash
cd client
npm run dev
```

## Verification Commands

Backend typecheck/build:

```bash
npm run build
```

Frontend production build:

```bash
cd client
npm run build
```

Frontend lint:

```bash
cd client
npm run lint
```

MongoDB connectivity smoke test:

```bash
npx ts-node test-db.ts
```

## API Conventions

The backend uses the following route groups:

- `/auth`: registration, login, Google OAuth, token refresh, logout, profile updates, and Chess.com account linking.
- `/player`: player profiles, statistics, clubs, matches, insights, and game archives.
- `/analysis`: authenticated saved-game analyses and evaluated moves.
- `/health`: server health check.

Authentication uses `Authorization: Bearer <access-token>`. Analysis routes require authentication. External Chess.com responses are cached in memory to reduce latency and API traffic.

## Analysis Workflow

1. The frontend loads the authenticated user's linked Chess.com username.
2. `GET /player/:username/games/last-3-months` retrieves monthly archives covering the rolling three-month date range and filters games by exact timestamps.
3. The user selects a game and posts its PGN to `/analysis`.
4. The analysis board parses the PGN with Chess.js.
5. Stockfish runs in a dedicated worker; the worker queues commands until ready and supports cancellation.
6. Evaluated moves and notes are persisted through protected analysis endpoints.

## Coding Guidelines

- Preserve the routes/controllers/services/models separation.
- Prefer existing helpers and UI components before adding new abstractions.
- Keep external API calls behind backend services rather than calling Chess.com directly from React.
- Validate user input at the controller/service boundary.
- Protect user-owned data with authentication and ownership checks.
- Do not commit `.env` files, credentials, OAuth secrets, JWT secrets, or database passwords.
- Keep changes focused and run the relevant build after editing.
- Do not commit generated `dist` output unless the deployment workflow explicitly requires it.

## Common Troubleshooting

- If Mongoose reports `buffering timed out`, check that MongoDB Atlas is running, the current IP is in Atlas Network Access, and the database credentials are correct.
- If Google OAuth fails, verify the callback URL matches the Google Cloud Console configuration and `CLIENT_URL` is correct.
- If the frontend cannot reach the API, verify `VITE_API_URL`, the backend port, and CORS configuration.
- If Stockfish shows no depth, check the browser console for worker asset errors and confirm the worker receives `ready` before analysis commands.
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

see `.env.example`
. Required keys: `PORT`, `MONGODB_URI`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRY`, `JWT_REFRESH_EXPIRY`, `CLIENT_URL`, `NODE_ENV`. JWT secrets must be ≥32 chars.

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
