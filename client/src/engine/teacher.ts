/**
 * Teaching layer: turns raw Stockfish evals into a classification, a
 * pedagogical theme, and a one-line human explanation. Pure TypeScript,
 * no network calls — easy to extend with new themes.
 *
 * Input: a sequence of moves with their before/after centipawn evals
 * (side-to-move-relative: positive = side-to-move winning).
 *
 * Output: one EvaluatedMove per ply, with classification, theme, and
 * explanation strings ready to render in the analysis UI.
 */

import { Chess, type Move, type Square } from "chess.js";
import { identifyOpening } from "./eco";

// ----- types -----

export type Classification =
    | "blunder"
    | "mistake"
    | "inaccuracy"
    | "good"
    | "best"
    | "brilliant";

export type Theme =
    | "hanging_piece"
    | "missed_fork"
    | "back_rank"
    | "opening_deviation"
    | "time_pressure"
    | "none";

export interface RawEvaluatedMove {
    ply: number;            // 1 = white's first move
    fen: string;            // FEN BEFORE the move
    playedMove: string;     // SAN
    bestMove: string;       // SAN
    evalBefore: number;     // centipawns, side-to-move-relative
    evalAfter: number;      // centipawns, side-to-move-relative after played move
    bestEvalAfter: number;  // centipawns, side-to-move-relative after best move
    mateBefore?: number;    // mate in N for side-to-move, if any
    mateAfter?: number;
    timeRemainingMs?: number; // clock time before this move
}

export interface EvaluatedMove {
    ply: number;
    playedMove: string;
    bestMove: string;
    evalBefore: number;
    evalAfter: number;
    classification: Classification;
    theme: Theme;
    explanation: string;
}

// ----- classification -----

const MATE_SCORE = 100000; // centipawns-equivalent we treat as "winning"

/**
 * Classify a single move. The eval is always side-to-move-relative, so
 * a negative swing means the side-to-move hurt themselves.
 *
 * @param raw - the move's raw data
 * @param bestIsMate - whether the best move led to mate
 */
export function classifyMove(raw: RawEvaluatedMove, bestIsMate: boolean): Classification {
    // Lost mate -> always a blunder regardless of centipawns
    if (raw.mateBefore !== undefined && raw.mateAfter === undefined) return "blunder";
    // Found a forced mate when there wasn't one before — brilliant
    if (raw.mateBefore === undefined && bestIsMate) return "brilliant";

    // delta is positive when the move cost the side-to-move
    const delta = raw.evalAfter - raw.evalBefore;

    if (delta >= 300) return "blunder";
    if (delta >= 100) return "mistake";
    if (delta >= 50) return "inaccuracy";
    if (delta <= -10) return "best"; // actively improved
    return "good";
}

// ----- theme detection -----

/**
 * Detect a pedagogical theme. Each detector is pure: it takes the FEN
 * and the move objects, returns true if the theme applies.
 */
const isHangingPiece = (
    chessBefore: Chess,
    chessAfter: Chess,
    _played: Move,
    isWhite: boolean
): boolean => {
    // The side-to-move just made a move. We look at the position AFTER
    // the move: did they leave a non-pawn, non-king piece attacked AND
    // undefended (or insufficiently defended)?
    const color = isWhite ? "w" : "b";
    const board = chessAfter.board();

    for (let r = 0; r < 8; r++) {
        for (let f = 0; f < 8; f++) {
            const sq = board[r][f];
            if (!sq || sq.color !== color) continue;
            if (sq.type === "p" || sq.type === "k") continue;

            const squareName = String.fromCharCode(97 + f) + (8 - r) as Square;

            // Is this square attacked by the opponent?
            const isAttacked = chessAfter.isAttacked(squareName, color === "w" ? "b" : "w");
            if (!isAttacked) continue;

            // Is it defended by a friendly piece?
            const defenders = chessAfter.attackers(squareName, color);
            const attackers = chessAfter.attackers(squareName, color === "w" ? "b" : "w");
            if (defenders.length >= attackers.length) continue;

            // Was this square defended BEFORE the move and is no longer?
            const wasDefended = chessBefore
                .attackers(squareName, color).length > 0;

            if (wasDefended) return true;
        }
    }
    return false;
};

const isMissedFork = (
    chessBefore: Chess,
    _best: Move,
    isWhite: boolean
): boolean => {
    // The best move attacks at least two enemy non-pawn, non-king pieces.
    // The played move didn't.
    if (!_best) return false;
    const to = _best.to;
    if (!to) return false;

    const enemyColor = isWhite ? "b" : "w";
    const board = chessBefore.board();
    let attackedNonPawnNonKingCount = 0;

    for (let r = 0; r < 8; r++) {
        for (let f = 0; f < 8; f++) {
            const sq = board[r][f];
            if (!sq || sq.color !== enemyColor) continue;
            if (sq.type === "p" || sq.type === "k") continue;

            const squareName = String.fromCharCode(97 + f) + (8 - r);
            if (chessBefore.isAttacked(squareName as Square, isWhite ? "w" : "b")) {
                attackedNonPawnNonKingCount++;
            }
        }
    }

    return attackedNonPawnNonKingCount >= 2;
};

const isBackRankWeakness = (chess: Chess, isWhite: boolean): boolean => {
    // King on its back rank with no escape squares AND a rook/queen file.
    const color = isWhite ? "w" : "b";
    const kingSquare = findKingSquare(chess, color);
    if (!kingSquare) return false;
    const rank = parseInt(kingSquare[1], 10);
    const backRank = isWhite ? 1 : 8;
    if (rank !== backRank) return false;

    // King has no escape squares (no legal king moves to a different rank)
    const kingFile = kingSquare[0];
    const escapes: Square[] = [];
    for (const df of [-1, 0, 1]) {
        for (const dr of [-1, 0, 1]) {
            if (df === 0 && dr === 0) continue;
            const newFile = String.fromCharCode(kingFile.charCodeAt(0) + df);
            const newRank = rank + (isWhite ? dr : -dr);
            if (newFile < "a" || newFile > "h" || newRank < 1 || newRank > 8) continue;
            const target = (newFile + newRank) as Square;
            if (chess.isAttacked(target, isWhite ? "b" : "w")) continue;
            escapes.push(target);
        }
    }
    if (escapes.length > 0) return false;

    // Is there an enemy rook or queen on the same file?
    const enemyColor = isWhite ? "b" : "w";
    for (let r = 0; r < 8; r++) {
        const sq = chess.board()[r][kingFile.charCodeAt(0) - 97];
        if (sq && sq.color === enemyColor && (sq.type === "r" || sq.type === "q")) {
            return true;
        }
    }
    return false;
};

const findKingSquare = (chess: Chess, color: "w" | "b"): Square | null => {
    const board = chess.board();
    for (let r = 0; r < 8; r++) {
        for (let f = 0; f < 8; f++) {
            const sq = board[r][f];
            if (sq && sq.type === "k" && sq.color === color) {
                return (String.fromCharCode(97 + f) + (8 - r)) as Square;
            }
        }
    }
    return null;
};

/**
 * Apply the detectors in order, returning the first matching theme.
 * Detection only runs for non-good moves — there's no point finding a
 * missed fork on a best move.
 */
export function detectTheme(
    raw: RawEvaluatedMove,
    played: Move,
    best: Move | null
): Theme {
    if (raw.ply > 40) return "none"; // not opening anymore

    const isWhite = raw.ply % 2 === 1;
    const openingMoves = extractOpeningMoves(raw, 20);
    const isInBook = identifyOpening(openingMoves) !== null;

    // Time pressure first — if the player was low on time, that's often
    // the real story even if a tactic is present.
    if (raw.timeRemainingMs !== undefined && raw.timeRemainingMs < 30_000) {
        return "time_pressure";
    }

    if (isWhite && raw.ply < 20 && !isInBook) {
        return "opening_deviation";
    }

    // Need a chess instance for board queries
    let chessBefore: Chess;
    let chessAfter: Chess;
    try {
        chessBefore = new Chess(raw.fen);
        chessAfter = new Chess(raw.fen);
        chessAfter.move(played.san);
    } catch {
        return "none";
    }

    if (isBackRankWeakness(chessBefore, isWhite)) return "back_rank";
    if (isHangingPiece(chessBefore, chessAfter, played, isWhite)) return "hanging_piece";
    if (best && isMissedFork(chessBefore, best, isWhite)) return "missed_fork";

    return "none";
}

/**
 * Best-effort: pull the first N SAN moves from a FEN by stepping back
 * via move history. Used for opening identification. Since we don't
 * have the full move list here, we instead fall back to the PGN in the
 * caller when available; this function is a stub that returns empty.
 */
function extractOpeningMoves(_raw: RawEvaluatedMove, _n: number): string[] {
    return [];
}

// ----- explanation strings -----

const THEME_EXPLANATIONS: Record<Theme, (ctx: { move: string; best: string; deltaCp: number }) => string> = {
    hanging_piece: ({ move, deltaCp }) =>
        `Hanging piece: a piece you left undefended can be captured. Lost about ${Math.abs(Math.round(deltaCp))}cp. The safer move was the engine's suggestion.`,
    missed_fork: ({ best }) =>
        `Missed tactic: ${best} would have attacked two enemy pieces at once. Look for forks — they win material for free.`,
    back_rank: () =>
        `Back-rank weakness: your king is stuck on the back rank with no escape squares. Watch for rook/queen files aiming at g8/g1 or h8/h1.`,
    opening_deviation: () =>
        `Opening deviation: this move isn't in the main book lines for this position. You're likely out of theory — focus on piece development and king safety.`,
    time_pressure: () =>
        `Time pressure: under 30s on the clock. When rushed, prioritize checks, captures, and threats (CCT) over long plans.`,
    none: ({ deltaCp }) => {
        if (deltaCp >= 300) return `Blunder. This move loses significant material or positional ground.`;
        if (deltaCp >= 100) return `Mistake. The engine finds a substantially better continuation.`;
        if (deltaCp >= 50) return `Inaccuracy. Slightly imprecise — there's a cleaner move in this position.`;
        return ``;
    },
};

export function explainMove(theme: Theme, move: string, best: string, deltaCp: number): string {
    return THEME_EXPLANATIONS[theme]({ move, best, deltaCp });
}

// ----- public API -----

/**
 * Main entry point. Given a list of raw moves, returns the same list
 * with classification, theme, and explanation filled in. Pure function.
 */
export function annotateMoves(rawMoves: RawEvaluatedMove[]): EvaluatedMove[] {
    return rawMoves.map((raw) => {
        const bestIsMate = false; // not exposed in the raw shape yet
        const classification = classifyMove(raw, bestIsMate);

        // We need Move objects for theme detection. Reconstruct from SAN.
        let played: Move | null = null;
        let best: Move | null = null;
        try {
            const chessForPlayed = new Chess(raw.fen);
            const moveObj = chessForPlayed.move(raw.playedMove);
            if (moveObj) played = moveObj;
            const chessForBest = new Chess(raw.fen);
            const bestObj = chessForBest.move(raw.bestMove);
            if (bestObj) best = bestObj;
        } catch {
            // ignore — fall through with nulls
        }

        const theme = played
            ? detectTheme(raw, played, best)
            : "none";

        // Only bother with theme explanation for bad moves
        const effectiveTheme: Theme =
            classification === "best" || classification === "good" || classification === "brilliant"
                ? "none"
                : theme;

        const deltaCp = raw.evalAfter - raw.evalBefore;
        const explanation = effectiveTheme !== "none"
            ? explainMove(effectiveTheme, raw.playedMove, raw.bestMove, deltaCp)
            : (classification === "blunder" || classification === "mistake" || classification === "inaccuracy")
                ? explainMove("none", raw.playedMove, raw.bestMove, deltaCp)
                : (classification === "brilliant" ? "Brilliant! This move finds a resource the engine considers decisive." : "");

        return {
            ply: raw.ply,
            playedMove: raw.playedMove,
            bestMove: raw.bestMove,
            evalBefore: raw.evalBefore,
            evalAfter: raw.evalAfter,
            classification,
            theme: effectiveTheme,
            explanation,
        };
    });
}
