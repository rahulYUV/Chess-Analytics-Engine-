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
    mateAfter?: number;     // mate in N after the PLAYED move (opponent's perspective)
    bestMateAfter?: number; // mate in N after the BEST move (opponent's perspective), if any
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

/**
 * Classify a single move using centipawn LOSS: how much worse the
 * played move was compared to the engine's best move, both converted
 * to the mover's own perspective.
 *
 * evalAfter / bestEvalAfter are side-to-move-relative for whoever
 * moves NEXT (the opponent), since the turn has switched after either
 * move. We flip both back to the original mover's perspective before
 * comparing them — this is what makes centipawn-loss meaningful.
 */
export function classifyMove(raw: RawEvaluatedMove, bestIsMate: boolean): Classification {
    // Lost a forced mate that existed before the move -> always a blunder
    if (raw.mateBefore !== undefined && raw.mateAfter === undefined) return "blunder";

    // Found a forced mate with the best move when there wasn't one
    // available before, AND the played move didn't also find it
    if (raw.mateBefore === undefined && bestIsMate && raw.mateAfter === undefined) {
        return "brilliant";
    }

    // Playing the engine's own top choice is always at least "best"
    if (normalizeSan(raw.playedMove) === normalizeSan(raw.bestMove)) {
        return "best";
    }

    // Flip both to the mover's own perspective
    const moverEvalAfterPlayed = -raw.evalAfter;
    const moverEvalAfterBest = -raw.bestEvalAfter;

    // How much worse was the played move than the best move,
    // measured in the mover's own favor (positive = lost ground)
    const cpLoss = moverEvalAfterBest - moverEvalAfterPlayed;

    if (cpLoss >= 300) return "blunder";
    if (cpLoss >= 100) return "mistake";
    if (cpLoss >= 50) return "inaccuracy";
    if (cpLoss <= -10) return "best"; // played move actually beat the engine's line (rare, but possible with different depths)
    return "good";
}

function normalizeSan(san: string): string {
    // Strip check/mate/annotation symbols so "Bb5+" === "Bb5"
    return san.replace(/[+#!?]/g, "").trim();
}

// ----- theme detection -----

/**
 * Safe wrapper around chess.js's attackers() — not all versions expose
 * it the same way, so we guard against a runtime crash and just treat
 * an error as "no attackers found" rather than blowing up the whole
 * analysis pass.
 */
function safeAttackers(chess: Chess, square: Square, color: "w" | "b"): Square[] {
    try {
        const anyChess = chess as any;
        if (typeof anyChess.attackers === "function") {
            return anyChess.attackers(square, color) || [];
        }
    } catch {
        // fall through
    }
    return [];
}

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

            const squareName = (String.fromCharCode(97 + f) + (8 - r)) as Square;

            // Is this square attacked by the opponent?
            const isAttacked = chessAfter.isAttacked(squareName, color === "w" ? "b" : "w");
            if (!isAttacked) continue;

            // Is it defended by a friendly piece?
            const defenders = safeAttackers(chessAfter, squareName, color);
            const attackers = safeAttackers(chessAfter, squareName, color === "w" ? "b" : "w");
            if (defenders.length >= attackers.length) continue;

            // Was this square defended BEFORE the move and is no longer?
            const wasDefended = safeAttackers(chessBefore, squareName, color).length > 0;

            if (wasDefended) return true;
        }
    }
    return false;
};

const isMissedFork = (
    chessBefore: Chess,
    best: Move,
    played: Move,
    isWhite: boolean
): boolean => {
    // A fork must be created by the best move, not merely be possible in
    // the position before either move. Compare the resulting positions so
    // the played move cannot trigger a false missed-fork explanation.
    try {
        const chessAfterBest = new Chess(chessBefore.fen());
        const chessAfterPlayed = new Chess(chessBefore.fen());
        chessAfterBest.move(best);
        chessAfterPlayed.move(played);

        return countAttackedTargets(chessAfterBest, isWhite) >= 2
            && countAttackedTargets(chessAfterPlayed, isWhite) < 2;
    } catch {
        return false;
    }
};

function countAttackedTargets(chess: Chess, isWhite: boolean): number {
    const enemyColor = isWhite ? "b" : "w";
    const attackerColor = isWhite ? "w" : "b";
    let count = 0;
    const board = chess.board();

    for (let rank = 0; rank < 8; rank++) {
        for (let file = 0; file < 8; file++) {
            const piece = board[rank][file];
            if (!piece || piece.color !== enemyColor || piece.type === "p" || piece.type === "k") continue;
            const square = (String.fromCharCode(97 + file) + (8 - rank)) as Square;
            if (chess.isAttacked(square, attackerColor)) count++;
        }
    }
    return count;
}

const isBackRankWeakness = (chess: Chess, isWhite: boolean): boolean => {
    // King on its back rank with no escape squares AND a rook/queen file.
    const color = isWhite ? "w" : "b";
    const kingSquare = findKingSquare(chess, color);
    if (!kingSquare) return false;
    const rank = parseInt(kingSquare[1], 10);
    const backRank = isWhite ? 1 : 8;
    if (rank !== backRank) return false;

    // King has no escape squares (no legal king moves to a different rank).
    // Board ranks/files are absolute — a king can step in any of the 8
    // directions regardless of its color, so we don't flip dr by color.
    const kingFile = kingSquare[0];
    const escapes: Square[] = [];
    for (const df of [-1, 0, 1]) {
        for (const dr of [-1, 0, 1]) {
            if (df === 0 && dr === 0) continue;
            const newFile = String.fromCharCode(kingFile.charCodeAt(0) + df);
            const newRank = rank + dr;
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
 *
 * @param openingMovesSoFar - the actual played SAN moves from ply 1 up
 * to and including this move, in order. Used to check whether the
 * game is still "in book" per the ECO table.
 */
export function detectTheme(
    raw: RawEvaluatedMove,
    played: Move,
    best: Move | null,
    openingMovesSoFar: string[]
): Theme {
    if (raw.ply > 40) return "none"; // not opening anymore

    const isWhite = raw.ply % 2 === 1;
    const isInBook = identifyOpening(openingMovesSoFar) !== null;

    // Time pressure first — if the player was low on time, that's often
    // the real story even if a tactic is present.
    if (raw.timeRemainingMs !== undefined && raw.timeRemainingMs < 30_000) {
        return "time_pressure";
    }

    if (raw.ply < 20 && !isInBook) {
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
    if (best && isMissedFork(chessBefore, best, played, isWhite)) return "missed_fork";

    return "none";
}

// ----- explanation strings -----

const THEME_EXPLANATIONS: Record<Theme, (ctx: { move: string; best: string; deltaCp: number }) => string> = {
    hanging_piece: ({ deltaCp }) =>
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
        // deltaCp here is centipawn LOSS from the mover's perspective
        // (positive = lost ground). See classifyMove for how it's derived.
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
 * Main entry point. Given a list of raw moves (in game order, ply 1
 * first), returns the same list with classification, theme, and
 * explanation filled in. Pure function.
 */
export function annotateMoves(rawMoves: RawEvaluatedMove[]): EvaluatedMove[] {
    // Accumulated actual game history in SAN, built up as we go, so
    // detectTheme/identifyOpening can check "is this still book?"
    // against the real moves played — not a stubbed-out empty array.
    const playedHistorySoFar: string[] = [];

    return rawMoves.map((raw) => {
        const bestIsMate = raw.mateBefore === undefined && raw.bestMateAfter !== undefined;
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

        // Record the actual played move in history BEFORE detecting the
        // theme for this ply, since "in book up to and including this
        // move" is what we want to check.
        if (played) playedHistorySoFar.push(played.san);

        const theme = played
            ? detectTheme(raw, played, best, playedHistorySoFar)
            : "none";

        // Only bother with theme explanation for bad moves
        const effectiveTheme: Theme =
            classification === "best" || classification === "good" || classification === "brilliant"
                ? "none"
                : theme;

        // Centipawn loss from the mover's own perspective (positive =
        // lost ground), consistent with classifyMove's cpLoss.
        const deltaCp = -raw.bestEvalAfter - -raw.evalAfter;
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