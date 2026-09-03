/**
 * AnalysisBoard — per-game Stockfish analysis.
 *
 * Renders the position at the current ply, an eval bar, a move list with
 * classification icons, a tiny eval graph, and a personal-note textarea.
 * Talks to a Stockfish Web Worker to evaluate each position; talks to
 * the backend to load the analysis and persist moves/note.
 *
 * This file is intentionally self-contained: it owns its own chess.js
 * instance, the worker lifecycle, and the analysis state machine. The
 * teacher layer annotates the raw Stockfish output.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Chess } from "chess.js";
import { motion } from "motion/react";
import { ArrowLeft, ChevronLeft, ChevronRight, Lightbulb, Loader2, RotateCcw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { annotateMoves, type EvaluatedMove, type RawEvaluatedMove } from "@/engine/teacher";
import StockfishWorker from "@/engine/stockfish.worker?worker";

interface AnalysisDoc {
    _id: string;
    pgn: string;
    white: { username: string; rating?: number; result: string };
    black: { username: string; rating?: number; result: string };
    timeClass: string;
    endTime: number;
    evaluatedMoves: EvaluatedMove[];
    note: string;
    chessUsername: string;
}

const CLASS_COLOR: Record<string, string> = {
    blunder: "bg-red-500",
    mistake: "bg-orange-500",
    inaccuracy: "bg-yellow-500",
    good: "bg-green-500/40",
    best: "bg-green-500",
    brilliant: "bg-blue-500",
};

const CLASS_LABEL: Record<string, string> = {
    blunder: "??",
    mistake: "?",
    inaccuracy: "?!",
    good: "",
    best: "!",
    brilliant: "!!",
};

function parsePgnMoves(pgn: string): { san: string; fen: string }[] {
    // chess.js is the most reliable PGN parser; load the full PGN and
    // walk the history.
    const chess = new Chess();
    try {
        chess.loadPgn(pgn);
    } catch (e) {
        console.error("Failed to parse PGN:", e);
        return [];
    }
    const moves = chess.history({ verbose: true });
    return moves.map((m) => {
        const before = new Chess(m.before);
        return { san: m.san, fen: before.fen() };
    });
}

export default function AnalysisBoard() {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();

    const [doc, setDoc] = useState<AnalysisDoc | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [plyIndex, setPlyIndex] = useState(0); // 0 = initial position
    const [hint, setHint] = useState<string | null>(null);
    const [hintLoading, setHintLoading] = useState(false);
    const [depth, setDepth] = useState(0);
    const [currentEval, setCurrentEval] = useState<number | null>(null);
    const [noteDraft, setNoteDraft] = useState("");

    const workerRef = useRef<Worker | null>(null);
    const movesRef = useRef<{ san: string; fen: string }[]>([]);
    const moveButtonRefs = useRef<Record<number, HTMLButtonElement | null>>({});
    const audioContextRef = useRef<AudioContext | null>(null);
    const previousPlyRef = useRef(0);

    // ----- fetch analysis -----
    useEffect(() => {
        if (!id) return;
        let cancelled = false;
        (async () => {
            try {
                const apiUrl = (import.meta as any).env?.VITE_API_URL || "http://localhost:3000";
                const token = localStorage.getItem("accessToken");
                const res = await fetch(`${apiUrl}/analysis/${id}`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                });
                if (!res.ok) throw new Error(`Failed to load analysis (${res.status})`);
                const data = await res.json();
                if (cancelled) return;
                setDoc(data.analysis);
                setNoteDraft(data.analysis.note || "");
                movesRef.current = parsePgnMoves(data.analysis.pgn);
            } catch (e: any) {
                if (!cancelled) setError(e.message || "Failed to load analysis");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [id]);

    // ----- spawn stockfish worker -----
    useEffect(() => {
        const w = new StockfishWorker();
        workerRef.current = w;
        w.onmessage = (e: MessageEvent) => {
            const msg = e.data;
            if (msg?.type === "info") {
                setDepth((d) => (msg.depth > d ? msg.depth : d));
            }
        };
        return () => { w.postMessage({ type: "stop" }); w.terminate(); workerRef.current = null; };
    }, []);

    // Keep keyboard navigation available while the analysis page is focused.
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            const target = event.target as HTMLElement;
            if (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;

            event.preventDefault();
            setPlyIndex((current) => Math.max(0, Math.min(movesRef.current.length, current + (event.key === "ArrowRight" ? 1 : -1))));
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    useEffect(() => {
        const previousPly = previousPlyRef.current;
        if (previousPly !== plyIndex && Math.abs(previousPly - plyIndex) === 1) {
            playMoveSound();
        }
        previousPlyRef.current = plyIndex;

        if (plyIndex > 0) {
            moveButtonRefs.current[plyIndex - 1]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
    }, [plyIndex]);

    const playMoveSound = () => {
        const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextClass) return;

        const context = audioContextRef.current || new AudioContextClass();
        audioContextRef.current = context;
        if (context.state === "suspended") void context.resume();

        const now = context.currentTime;
        const buffer = context.createBuffer(1, Math.floor(context.sampleRate * 0.045), context.sampleRate);
        const channel = buffer.getChannelData(0);
        for (let index = 0; index < channel.length; index++) {
            const envelope = Math.pow(1 - index / channel.length, 3);
            channel[index] = (Math.random() * 2 - 1) * envelope;
        }

        const noise = context.createBufferSource();
        const filter = context.createBiquadFilter();
        const gain = context.createGain();
        noise.buffer = buffer;
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(1500, now);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.23, now + 0.003);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
        noise.connect(filter).connect(gain).connect(context.destination);
        noise.start(now);
        noise.stop(now + 0.05);
    };

    // ----- derived position -----
    const currentPosition = useMemo(() => {
        if (!movesRef.current.length) return new Chess();
        const c = new Chess();
        for (let i = 0; i < plyIndex; i++) {
            c.move(movesRef.current[i].san);
        }
        return c;
    }, [plyIndex, doc]);

    // ----- run analysis when analysis doc loads -----
    useEffect(() => {
        if (!doc || !workerRef.current) return;
        const moves = movesRef.current;
        if (moves.length === 0) return;

        // If we already have evaluated moves, skip re-analysis
        if (doc.evaluatedMoves && doc.evaluatedMoves.length === moves.length) return;

        const raw: RawEvaluatedMove[] = [];
        const worker = workerRef.current;
        let cancelled = false;

        (async () => {
            if (!worker) return;
            for (let i = 0; i < moves.length; i++) {
                if (cancelled) return;
                const before = moves[i].fen;
                const after = (i + 1 < moves.length) ? moves[i + 1].fen : before;

                // Best move at "before"
                const bestMoveSan: string = await new Promise((resolve) => {
                    const timeout = window.setTimeout(() => {
                        worker.removeEventListener("message", handler);
                        resolve("");
                    }, 15000);
                    const handler = (ev: MessageEvent) => {
                        const m = ev.data;
                        if (m?.type === "bestmove") {
                            worker.removeEventListener("message", handler);
                            window.clearTimeout(timeout);
                            resolve(m.move || "");
                        }
                    };
                    worker.addEventListener("message", handler);
                    worker.postMessage({ type: "analyze", fen: before, depth: 16 });
                });
                const bestAfterFen = applyMove(before, bestMoveSan);

                // Eval at "before" from the side-to-move's perspective
                const evalBefore = await evalAt(worker, before, 14);

                // Eval at the actual played move
                const evalAfterPlayed = await evalAt(worker, after, 14);

                // Eval at the best move
                const evalAfterBest = await evalAt(worker, bestAfterFen, 14);

                if (cancelled) return;

                const isWhite = (i % 2) === 0;
                raw.push({
                    ply: i + 1,
                    fen: before,
                    playedMove: moves[i].san,
                    bestMove: bestMoveSan || moves[i].san,
                    evalBefore: sideRelative(evalBefore, isWhite),
                    evalAfter: sideRelative(evalAfterPlayed, isWhite),
                    bestEvalAfter: sideRelative(evalAfterBest, isWhite),
                });
            }

            if (cancelled) return;

            const annotated = annotateMoves(raw);
            // persist
            try {
                const apiUrl = (import.meta as any).env?.VITE_API_URL || "http://localhost:3000";
                const token = localStorage.getItem("accessToken");
                await fetch(`${apiUrl}/analysis/${id}/moves`, {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                    body: JSON.stringify({ moves: annotated }),
                });
                setDoc((d) => d ? { ...d, evaluatedMoves: annotated } : d);
            } catch (e) {
                console.error("Failed to save evaluated moves:", e);
            }
        })();

        return () => {
            cancelled = true;
            worker?.postMessage({ type: "stop" });
        };
    }, [doc, id]);

    // Re-evaluate the position shown on the board whenever the active ply changes.
    useEffect(() => {
        const worker = workerRef.current;
        if (!worker || !doc || movesRef.current.length === 0 || doc.evaluatedMoves.length !== movesRef.current.length) return;
        let cancelled = false;
        setCurrentEval(null);

        evaluatePosition(worker, currentPosition.fen(), 12).then((evaluation) => {
            if (!cancelled) setCurrentEval(evaluation);
        });

        return () => {
            cancelled = true;
            worker.postMessage({ type: "stop" });
        };
    }, [currentPosition, doc]);

    // ----- hint -----
    const requestHint = async () => {
        if (!workerRef.current) return;
        setHintLoading(true);
        setHint(null);
        const w = workerRef.current;
        const fen = currentPosition.fen();
        w.postMessage({ type: "hint", fen });
        const move = await new Promise<string>((resolve) => {
            const handler = (ev: MessageEvent) => {
                const m = ev.data;
                if (m?.type === "bestmove") {
                    w.removeEventListener("message", handler);
                    resolve(m.move || "");
                }
            };
            w.addEventListener("message", handler);
        });
        setHint(move);
        setHintLoading(false);
    };

    // ----- save note (debounced) -----
    useEffect(() => {
        if (!doc || noteDraft === doc.note) return;
        const t = setTimeout(async () => {
            try {
                const apiUrl = (import.meta as any).env?.VITE_API_URL || "http://localhost:3000";
                const token = localStorage.getItem("accessToken");
                await fetch(`${apiUrl}/analysis/${id}/note`, {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                    body: JSON.stringify({ note: noteDraft }),
                });
                setDoc((d) => d ? { ...d, note: noteDraft } : d);
            } catch (e) {
                console.error("Failed to save note:", e);
            }
        }, 700);
        return () => clearTimeout(t);
    }, [noteDraft, doc, id]);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }
    if (error || !doc) {
        return (
            <div className="max-w-2xl mx-auto p-8 space-y-4">
                <div className="text-red-500">{error || "Analysis not found."}</div>
                <Link to="/analysis" className="text-sm underline">Back to game list</Link>
            </div>
        );
    }

    const totalPlies = movesRef.current.length;
    const evals = doc.evaluatedMoves.map((m) => m.evalAfter);
    const moveAt = (i: number) => doc.evaluatedMoves[i];
    const classified = moveAt(plyIndex - 1);

    return (
        <div className="max-w-7xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm">
                    <Link to="/analysis" className="text-muted-foreground hover:text-primary inline-flex items-center gap-1">
                        <ArrowLeft className="h-4 w-4" /> Games
                    </Link>
                    <span className="text-muted-foreground">·</span>
                    <span className="font-semibold">{doc.white.username} vs {doc.black.username}</span>
                </div>

                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                            <div className="text-center flex-1">
                                <div className="text-sm text-muted-foreground">White</div>
                                <div className="font-semibold">{doc.white.username}</div>
                                {doc.white.rating && <div className="text-xs text-muted-foreground">{doc.white.rating}</div>}
                            </div>
                            <div className="text-2xl font-bold">vs</div>
                            <div className="text-center flex-1">
                                <div className="text-sm text-muted-foreground">Black</div>
                                <div className="font-semibold">{doc.black.username}</div>
                                {doc.black.rating && <div className="text-xs text-muted-foreground">{doc.black.rating}</div>}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-4 items-start">
                    <EvalBar evals={evals} ply={plyIndex} currentEval={currentEval} />
                    <div className="space-y-3">
                        <BoardView fen={currentPosition.fen()} lastMove={movesRef.current[plyIndex - 1]?.san} hint={hint} />
                        <div className="flex items-center gap-2 flex-wrap">
                            <button
                                onClick={() => setPlyIndex(0)}
                                className="px-3 py-1.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-sm"
                            >
                                <RotateCcw className="h-4 w-4 inline" />
                            </button>
                            <button
                                onClick={() => setPlyIndex((p) => Math.max(0, p - 1))}
                                disabled={plyIndex === 0}
                                className="px-3 py-1.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-sm disabled:opacity-50"
                            >
                                <ChevronLeft className="h-4 w-4 inline" />
                            </button>
                            <button
                                onClick={() => setPlyIndex((p) => Math.min(totalPlies, p + 1))}
                                disabled={plyIndex === totalPlies}
                                className="px-3 py-1.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-sm disabled:opacity-50"
                            >
                                <ChevronRight className="h-4 w-4 inline" />
                            </button>
                            <span className="text-sm text-muted-foreground">
                                Move {Math.ceil(plyIndex / 2)}{plyIndex > 0 ? (plyIndex % 2 === 1 ? " (W)" : " (B)") : ""}
                            </span>
                            <button
                                onClick={requestHint}
                                disabled={hintLoading}
                                className="ml-auto px-3 py-1.5 rounded-md bg-yellow-500 text-black text-sm font-medium flex items-center gap-1"
                            >
                                {hintLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Lightbulb className="h-3 w-3" />}
                                Hint
                            </button>
                        </div>
                    </div>
                </div>

                {classified && (
                    <Card>
                        <CardContent className="p-4 space-y-2">
                            <div className="flex items-center gap-2">
                                <span className={`inline-block w-2 h-2 rounded-full ${CLASS_COLOR[classified.classification]}`} />
                                <span className="text-sm font-semibold">
                                    {classified.classification.toUpperCase()}
                                    {CLASS_LABEL[classified.classification] && ` ${CLASS_LABEL[classified.classification]}`}
                                </span>
                                {classified.theme !== "none" && (
                                    <span className="text-xs text-muted-foreground">
                                        · {classified.theme.replace("_", " ")}
                                    </span>
                                )}
                            </div>
                            <p className="text-sm">{classified.explanation || "Solid move."}</p>
                            <div className="text-xs text-muted-foreground">
                                Played: {classified.playedMove} · Best: {classified.bestMove}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {plyIndex === totalPlies && totalPlies > 0 && (
                    <ResultCard doc={doc} username={user?.chessUsername} />
                )}

                <Card>
                    <CardContent className="p-4 space-y-2">
                        <h3 className="text-sm font-semibold">Your notes</h3>
                        <textarea
                            value={noteDraft}
                            onChange={(e) => setNoteDraft(e.target.value)}
                            placeholder="What did you learn from this game? What will you do differently?"
                            rows={4}
                            className="w-full bg-neutral-100 dark:bg-neutral-800 rounded-md p-2 text-sm"
                        />
                    </CardContent>
                </Card>
            </div>

            <div className="space-y-4">
                <Card>
                    <CardContent className="p-4 space-y-2">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold">Moves</h3>
                            <span className="text-xs text-muted-foreground">Depth: {depth}{currentEval !== null ? ` · ${currentEval > 0 ? "+" : ""}${(currentEval / 100).toFixed(1)}` : ""}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1 max-h-[420px] overflow-y-auto text-sm">
                            {movesRef.current.map((m, i) => {
                                const classified = moveAt(i);
                                const isCurrent = plyIndex === i + 1;
                                return (
                                    <button
                                        key={i}
                                        ref={(element) => { moveButtonRefs.current[i] = element; }}
                                        onClick={() => setPlyIndex(i + 1)}
                                        className={`text-left px-2 py-1 rounded flex items-center gap-1 ${isCurrent ? "bg-yellow-500/20" : "hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}
                                    >
                                        <span className="text-xs text-muted-foreground w-6 inline-block">
                                            {i % 2 === 0 ? `${Math.floor(i / 2) + 1}.` : ""}
                                        </span>
                                        {classified && (
                                            <span className={`inline-block w-1.5 h-1.5 rounded-full ${CLASS_COLOR[classified.classification]}`} />
                                        )}
                                        <span>{m.san}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <h3 className="text-sm font-semibold mb-2">Eval graph</h3>
                        <EvalGraph evals={evals} ply={plyIndex} />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

// ----- helpers -----

function applyMove(fen: string, uci: string): string {
    if (!uci || uci === "(none)") return fen;
    const c = new Chess(fen);
    try {
        const from = uci.slice(0, 2);
        const to = uci.slice(2, 4);
        const promo = uci.length > 4 ? uci[4] : undefined;
        c.move({ from: from as any, to: to as any, promotion: promo as any });
    } catch (e) {
        console.error("applyMove failed:", fen, uci, e);
    }
    return c.fen();
}

async function evaluatePosition(worker: Worker, fen: string, depth: number): Promise<number> {
    return new Promise((resolve) => {
        let latestCp = 0;
        let reachedDepth = false;
        const timeout = window.setTimeout(() => {
            worker.removeEventListener("message", handler);
            worker.postMessage({ type: "stop" });
            resolve(latestCp);
        }, 15000);
        const handler = (ev: MessageEvent) => {
            const m = ev.data;
            if (m?.type === "info" && typeof m.cp === "number") {
                latestCp = m.cp;
                if (m.depth >= depth) reachedDepth = true;
            }
            if (m?.type === "bestmove" && reachedDepth) {
                worker.removeEventListener("message", handler);
                window.clearTimeout(timeout);
                resolve(latestCp);
            }
        };
        worker.addEventListener("message", handler);
        worker.postMessage({ type: "analyze", fen, depth });
    });
}

async function evalAt(worker: Worker, fen: string, depth: number): Promise<number> {
    return evaluatePosition(worker, fen, depth);
}

function sideRelative(cp: number, isWhite: boolean): number {
    return isWhite ? cp : -cp;
}

// ----- subcomponents -----

function BoardView({ fen, lastMove, hint }: { fen: string; lastMove?: string; hint?: string | null }) {
    // Lightweight CSS-grid board. We use chess.js for legality, not for
    // the board rendering (avoiding the react-chessboard dep here keeps
    // the analysis feature dependency-light; the project still has
    // react-chessboard installed and we can swap later).
    const c = useMemo(() => new Chess(fen), [fen]);
    const board = c.board();
    const lastMoveSquares = useMemo(() => {
        if (!lastMove) return new Set<string>();
        const chess = new Chess();
        try {
            const m = chess.move(lastMove);
            if (!m) return new Set<string>();
            return new Set([m.from, m.to]);
        } catch {
            return new Set<string>();
        }
    }, [lastMove]);

    const hintSquares = useMemo(() => {
        if (!hint) return new Set<string>();
        return new Set([hint.slice(0, 2), hint.slice(2, 4)]);
    }, [hint]);

    return (
        <div className="w-full max-w-[480px] mx-auto aspect-square grid grid-cols-8 grid-rows-8 border border-neutral-300 dark:border-neutral-700">
            {board.flatMap((row, r) =>
                row.map((sq, f) => {
                    const file = String.fromCharCode(97 + f);
                    const rank = 8 - r;
                    const squareName = `${file}${rank}`;
                    const isLight = (f + r) % 2 === 0;
                    const isLast = lastMoveSquares.has(squareName);
                    const isHint = hintSquares.has(squareName);
                    return (
                        <div
                            key={`${r}-${f}`}
                            className={`relative flex items-center justify-center text-3xl ${isLight ? "bg-amber-100 dark:bg-amber-100" : "bg-amber-700 dark:bg-amber-700"} ${isLast ? "ring-2 ring-yellow-400" : ""} ${isHint ? "ring-2 ring-blue-500" : ""}`}
                        >
                            {sq && (
                                    <span className={`select-none ${sq.color === "w" ? "text-white drop-shadow-[0_0_1px_black]" : "!text-neutral-950 dark:!text-neutral-950"}`}>
                                    {PIECE_GLYPHS[sq.color === "w" ? "w" : "b"][sq.type]}
                                </span>
                            )}
                        </div>
                    );
                })
            )}
        </div>
    );
}

const PIECE_GLYPHS: Record<"w" | "b", Record<string, string>> = {
    w: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
    b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" },
};

function EvalBar({ evals, ply, currentEval }: { evals: number[]; ply: number; currentEval: number | null }) {
    const storedEval = ply === 0 ? 30 : evals[Math.max(0, ply - 1)];
    // Stored evaluations are side-to-move-relative; convert them to White's view.
    const cp = currentEval ?? (storedEval === undefined ? 30 : (ply % 2 === 1 ? storedEval : -storedEval));
    const winChance = 50 + 50 * Math.tanh(cp / 400);
    return (
        <div className="flex flex-col items-center">
            <div className="relative w-6 h-[480px] bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                <motion.div
                    animate={{ height: `${winChance}%` }}
                    transition={{ type: "spring", stiffness: 80, damping: 15 }}
                    className="absolute top-0 left-0 right-0 bg-white"
                />
                <motion.div
                    animate={{ height: `${100 - winChance}%` }}
                    transition={{ type: "spring", stiffness: 80, damping: 15 }}
                    className="absolute bottom-0 left-0 right-0 bg-neutral-900"
                />
            </div>
            <div className="text-xs text-muted-foreground mt-2">
                {cp > 0 ? `+${(cp / 100).toFixed(1)}` : (cp / 100).toFixed(1)}
            </div>
        </div>
    );
}

function ResultCard({ doc, username }: { doc: AnalysisDoc; username?: string }) {
    const isWhite = username?.toLowerCase() === doc.white.username.toLowerCase();
    const result = isWhite ? doc.white.result : doc.black.result;
    const normalized = result.toLowerCase();
    const outcome = normalized === "win"
        ? "Won"
        : ["checkmated", "resigned", "timeout", "abandoned", "lose"].includes(normalized)
            ? "Lost"
            : "Draw";
    const color = outcome === "Won" ? "text-green-600" : outcome === "Lost" ? "text-red-600" : "text-yellow-600";

    return (
        <Card>
            <CardContent className="p-4 text-center">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Game result</p>
                <p className={`mt-1 text-2xl font-bold ${color}`}>{outcome}</p>
                <p className="text-sm text-muted-foreground">Final position reached</p>
            </CardContent>
        </Card>
    );
}

function EvalGraph({ evals, ply }: { evals: number[]; ply: number }) {
    if (evals.length === 0) {
        return <div className="text-xs text-muted-foreground">Running analysis…</div>;
    }
    const W = 280;
    const H = 80;
    const points = [30, ...evals]; // start at +0.3 (white slight)
    const clamped = points.map((p) => Math.max(-1000, Math.min(1000, p)));
    const max = Math.max(...clamped.map(Math.abs), 200);
    const stepX = W / (clamped.length - 1 || 1);
    const toY = (v: number) => H / 2 - (v / max) * (H / 2 - 4);
    const path = clamped.map((v, i) => `${i === 0 ? "M" : "L"} ${i * stepX} ${toY(v)}`).join(" ");
    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-20">
            <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke="currentColor" strokeOpacity="0.2" strokeWidth="1" />
            <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" />
            <line
                x1={ply * stepX}
                y1="0"
                x2={ply * stepX}
                y2={H}
                stroke="rgb(234 179 8)"
                strokeWidth="2"
            />
        </svg>
    );
}
