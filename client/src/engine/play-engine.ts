import { Chess, type Piece } from "chess.js";

export type EngineDifficulty = "easy" | "medium" | "hard";

const PIECE_VALUES: Record<Piece["type"], number> = {
    p: 100,
    n: 320,
    b: 330,
    r: 500,
    q: 900,
    k: 0,
};

const PST: Record<Piece["type"], number[]> = {
    p: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0],
    n: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
    b: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -20],
    r: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
    q: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
    k: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
};

function evaluateBoard(game: Chess): number {
    if (game.isCheckmate()) return game.turn() === "w" ? -50000 : 50000;
    if (game.isDraw() || game.isStalemate()) return 0;

    return game.board().reduce((score, row, rowIndex) => score + row.reduce((rowScore, piece, col) => {
        if (!piece) return rowScore;
        const index = piece.color === "w" ? rowIndex * 8 + col : (7 - rowIndex) * 8 + col;
        const value = PIECE_VALUES[piece.type] + (PST[piece.type][index] ?? 0) / 10;
        return rowScore + (piece.color === "w" ? value : -value);
    }, 0), 0);
}

function minimax(game: Chess, depth: number, alpha: number, beta: number, maximizing: boolean): number {
    if (depth === 0 || game.isGameOver()) return evaluateBoard(game);

    if (maximizing) {
        let best = -Infinity;
        for (const move of game.moves()) {
            game.move(move);
            best = Math.max(best, minimax(game, depth - 1, alpha, beta, false));
            game.undo();
            alpha = Math.max(alpha, best);
            if (beta <= alpha) break;
        }
        return best;
    }

    let best = Infinity;
    for (const move of game.moves()) {
        game.move(move);
        best = Math.min(best, minimax(game, depth - 1, alpha, beta, true));
        game.undo();
        beta = Math.min(beta, best);
        if (beta <= alpha) break;
    }
    return best;
}

export function getPositionEvaluation(fen: string): number {
    return evaluateBoard(new Chess(fen));
}

export function getBestMove(fen: string, difficulty: EngineDifficulty = "medium"): string | null {
    const game = new Chess(fen);
    const moves = game.moves();
    if (!moves.length) return null;
    if (difficulty === "easy") return moves[Math.floor(Math.random() * moves.length)] ?? null;

    const maximizing = game.turn() === "w";
    const depth = difficulty === "medium" ? 2 : 3;
    let bestMove = moves[0];
    let bestScore = maximizing ? -Infinity : Infinity;

    for (const move of [...moves].sort(() => Math.random() - 0.5)) {
        game.move(move);
        const score = minimax(game, depth - 1, -Infinity, Infinity, !maximizing);
        game.undo();
        if (maximizing ? score > bestScore : score < bestScore) {
            bestScore = score;
            bestMove = move;
        }
    }
    return bestMove;
}
