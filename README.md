# Chess Analytics Engine

A full-stack TypeScript application for exploring Chess.com player data, comparing players, reviewing opening trends, and analyzing saved games with a Stockfish-powered board.

## Overview

This project combines a Node.js/Express backend with a React + Vite frontend to provide a complete Chess analytics workflow:

- Search and view Chess.com player profiles
- Compare two players side by side
- Review insights such as activity heatmaps, win rates, and opening stats
- Browse recent games and archive data for a username
- Authenticate users and save analysis sessions
- Analyze a game with a chess engine and review evaluated moves

## Key Features

- Player profile and stats dashboard
- Two-player comparison views
- Insights dashboard with activity heatmaps and win-rate summaries
- Opening explorer and repertoire analysis
- Game archive retrieval for recent Chess.com activity
- Authenticated user workflows with Google OAuth and JWT
- Saved game analysis and notes
- Stockfish browser engine analysis board
- Feedback and contact form

## Tech Stack

### Backend
- Node.js
- Express 5
- TypeScript
- MongoDB + Mongoose
- Passport + Google OAuth
- JWT access and refresh tokens
- Node-cache in-memory caching
- Chess.com public API integration via chess-web-api and direct archive requests

### Frontend
- React 19
- Vite
- TypeScript
- Tailwind CSS
- Radix UI
- Recharts
- Chess.js
- react-chessboard
- Framer Motion / Motion
- Sonner for notifications

## Repository Structure

```text
.
├── index.ts                    # Express entry point
├── package.json                # Backend scripts and dependencies
├── tsconfig.json               # Backend TypeScript config
├── test-db.ts                  # MongoDB connectivity smoke check
├── get_avatars.js              # Standalone avatar utility
├── README.md
├── client/                     # React frontend
│   ├── package.json
│   ├── src/
│   ├── public/
│   └── vite.config.ts
├── src/
│   ├── config/                 # DB and Passport config
│   ├── controllers/            # HTTP handlers
│   ├── middleware/             # auth, rate limiting, DB readiness
│   ├── models/                 # Mongoose schemas
│   ├── routes/                 # Express routes
│   ├── services/               # Chess.com / auth / cache logic
│   └── utils/                  # helpers, JWT, chess utilities
└── Chess_Stats_API.postman_collection.json
```

## Prerequisites

- Node.js 18 or newer
- MongoDB instance or MongoDB Atlas cluster
- A Chess.com username to query
- Google OAuth credentials for login

## Installation

1. Clone the repository:

```bash
git clone <repo-url>
cd Chess-Analytics-Engine-
```

2. Install backend dependencies:

```bash
npm install
```

3. Install frontend dependencies:

```bash
cd client
npm install
```

## Environment Variables

Create a `.env` file in the project root with the following values:

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

The frontend also uses a `client/.env` file:

```env
VITE_API_URL=http://localhost:3000
```

> If the MongoDB URI is not set, the server will still start, but database-backed routes such as auth and comments will fail until MongoDB is available.

## Running the App

### Backend

From the project root:

```bash
npm run dev
```

This starts the Express API on `http://localhost:3000`.

### Frontend

In a second terminal:

```bash
cd client
npm run dev
```

Vite typically serves the app at `http://localhost:5173`.

## Production Build

### Backend

```bash
npm run build
```

### Frontend

```bash
cd client
npm run build
```

### Linting

```bash
cd client
npm run lint
```

## API Notes

The backend exposes route groups including:

- `/auth` for registration, login, Google OAuth, refresh, logout, and profile updates
- `/player` for chess profile, stats, archives, comparisons, insights, and activity data
- `/analysis` for authenticated saved-game analyses and evaluated moves
- `/health` for server health checks

Protected routes require `Authorization: Bearer <access-token>`.

## Stockfish-Powered Engine Analysis

The analysis experience is powered by a browser-based Stockfish 16 NNUE engine running inside a Web Worker. This keeps heavy engine computation off the main UI thread while allowing the app to evaluate positions, moves, and game states in real time.

### How it works

- The frontend creates a dedicated worker from `client/src/engine/stockfish.worker.ts`.
- The worker initializes Stockfish, loads the NNUE weights, and sends a `ready` signal once it is prepared to receive commands.
- Each position is analyzed by sending a FEN string and a target search depth. The worker returns engine lines such as `info depth ... pv ...` and the final `bestmove`.
- The app uses those outputs to compute a centipawn evaluation, identify the best move, and compare it against the actual move played.
- Each move is scored in terms of how much it deviates from the engine’s best continuation.

### Evaluation pipeline

The engine flow is intentionally layered:

1. Parse the PGN with Chess.js
2. Reconstruct the position for each move using FEN states
3. Ask Stockfish for the best move and evaluation at the current position
4. Compare the played move against the engine’s recommendation
5. Classify the move as a blunder, mistake, inaccuracy, good move, or best move
6. Surface a human-friendly explanation and visual signal in the analysis UI

This is handled in the client engine pipeline under `client/src/engine/`, where the worker emits live evaluation data and the teaching layer converts raw engine output into player-friendly coaching feedback.

### Why this matters

Instead of simply showing a raw numeric score, the app turns engine analysis into a learning tool. It can answer questions like:

- Was this move objectively best?
- Did the player miss a tactical shot?
- How much worse was the move compared to the engine line?
- Which moves were critical turning points in the game?

This makes the engine not just a calculator, but a move-review assistant that helps users understand the tactical and strategic quality of their play.

## Key Architecture Notes

- External Chess.com requests are wrapped in backend services and cached in memory for performance.
- All public chess-data service methods use cache keys based on username or comparison request.
- Google OAuth redirects through Passport and issues JWT access and refresh tokens.
- The analysis workflow parses PGN data using Chess.js and runs engine evaluation via a dedicated Stockfish worker.
- MongoDB is optional at startup, but required for auth and other database-backed features.

## Troubleshooting

- If MongoDB times out, verify the Atlas network settings and connection string.
- If Google OAuth fails, ensure the callback URL matches your Google console configuration.
- If the frontend cannot reach the API, check `VITE_API_URL` and the backend port.
- If the analysis board shows no engine depth, inspect the browser console and ensure the worker has started correctly.

## Notes

- There is no automated test suite in this repository; manual verification is done via local development servers and the Postman collection.
- The app is designed for local development and experimentation, with `.env` values kept out of source control.
