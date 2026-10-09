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
import { Chessboard } from "react-chessboard";
import { motion } from "motion/react";
import { ArrowLeft, ChevronLeft, ChevronRight, FlipHorizontal2, Lightbulb, Loader2, RotateCcw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { annotateMoves, type EvaluatedMove, type RawEvaluatedMove } from "@/engine/teacher";
import { StockfishEngine, type EngineResult } from "@/engine/engine";
import { apiFetch } from "@/utils/api";

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

const CLASS_SYMBOL: Record<string, string> = {
    blunder: "??",
    mistake: "?",
    inaccuracy: "?!",
    best: "!",
    brilliant: "!!",
    good: "",
};

type ParsedMove = { san: string; uci: string; before: string; after: string };

function parsePgnMoves(pgn: string): ParsedMove[] {
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
        return {
            san: m.san,
            uci: `${m.from}${m.to}${m.promotion || ""}`,
            before: m.before,
            after: m.after,
        };
    });
}

export default function AnalysisBoard() {
    const { id } = useParams<{ id: string }>();
    const [doc, setDoc] = useState<AnalysisDoc | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [plyIndex, setPlyIndex] = useState(0); // 0 = initial position
    const [hint, setHint] = useState<string | null>(null);
    const [hintLoading, setHintLoading] = useState(false);
    const [depth, setDepth] = useState(0);
    const [currentEval, setCurrentEval] = useState<number | null>(null);
    const [currentMate, setCurrentMate] = useState<number | undefined>(undefined);
    const [noteDraft, setNoteDraft] = useState("");
    const [analysisProgress, setAnalysisProgress] = useState({ completed: 0, total: 0 });
    const [boardOrientation, setBoardOrientation] = useState<"white" | "black">("white");
    const [showBestMove, setShowBestMove] = useState(true);
    const [noteStatus, setNoteStatus] = useState<"saved" | "saving" | "error">("saved");
    const [movesSaveError, setMovesSaveError] = useState("");

    const batchEngineRef = useRef<StockfishEngine | null>(null);
    const interactiveEngineRef = useRef<StockfishEngine | null>(null);
    const moves = useMemo(() => (doc?.pgn ? parsePgnMoves(doc.pgn) : []), [doc?.pgn]);
    const moveButtonRefs = useRef<Record<number, HTMLButtonElement | null>>({});
    const audioContextRef = useRef<AudioContext | null>(null);
    const previousPlyRef = useRef(0);

    // ----- fetch analysis -----
    useEffect(() => {
        if (!id) return;
        let cancelled = false;
        (async () => {
            try {
                const data = await apiFetch<{ analysis: AnalysisDoc }>(`/analysis/${id}`);
                if (cancelled) return;
                setDoc(data.analysis);
                setNoteDraft(data.analysis.note || "");
            } catch (e: any) {
                if (!cancelled) setError(e.message || "Failed to load analysis");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [id]);

    // ----- spawn isolated Stockfish engines -----
    useEffect(() => {
        batchEngineRef.current = new StockfishEngine();
        interactiveEngineRef.current = new StockfishEngine();
        return () => {
            batchEngineRef.current?.terminate();
            interactiveEngineRef.current?.terminate();
            batchEngineRef.current = null;
            interactiveEngineRef.current = null;
        };
    }, []);

    // Keep keyboard navigation available while the analysis page is focused.
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            const target = event.target as HTMLElement;
            if (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;

            event.preventDefault();
            setPlyIndex((current) => event.key === "Home"
                ? 0
                : event.key === "End"
                    ? moves.length
                    : Math.max(0, Math.min(moves.length, current + (event.key === "ArrowRight" ? 1 : -1))));
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [moves.length]);

    useEffect(() => {
        const previousPly = previousPlyRef.current;
        setHint(null);
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
        if (!moves.length) return new Chess();
        return new Chess(plyIndex === 0 ? moves[0].before : moves[Math.min(plyIndex, moves.length) - 1].after);
    }, [moves, plyIndex]);

    // ----- run analysis when analysis doc loads -----
    useEffect(() => {
        if (!doc || !batchEngineRef.current) return;
        if (moves.length === 0) return;

        // If we already have evaluated moves, skip re-analysis
        if (doc.evaluatedMoves && doc.evaluatedMoves.length === moves.length) return;

        const raw: RawEvaluatedMove[] = [];
        const engine = batchEngineRef.current;
        const cache = new Map<string, EngineResult>();
        let cancelled = false;

        (async () => {
            setAnalysisProgress({ completed: 0, total: moves.length });
            for (let i = 0; i < moves.length; i++) {
                if (cancelled) return;
                const before = moves[i].before;
                const after = moves[i].after;
                const beforeResult = await evaluateCached(engine, cache, before, 16);
                const playedResult = await evaluateCached(engine, cache, after, 14);
                const bestMoveUci = beforeResult.bestMove;
                const bestAfterFen = applyMove(before, bestMoveUci);
                const bestResult = bestMoveUci === moves[i].uci
                    ? playedResult
                    : await evaluateCached(engine, cache, bestAfterFen, 14);

                if (cancelled) return;

                raw.push({
                    ply: i + 1,
                    fen: before,
                    playedMove: moves[i].san,
                    bestMove: uciToSan(before, bestMoveUci) || moves[i].san,
                    evalBefore: scoreValue(beforeResult),
                    evalAfter: -scoreValue(playedResult),
                    bestEvalAfter: -scoreValue(bestResult),
                    ...(beforeResult.mate === undefined ? {} : { mateBefore: beforeResult.mate }),
                    ...(playedResult.mate === undefined ? {} : { mateAfter: -playedResult.mate }),
                    ...(bestResult.mate === undefined ? {} : { bestMateAfter: -bestResult.mate }),
                });
                setAnalysisProgress({ completed: i + 1, total: moves.length });
            }

            if (cancelled) return;

            const annotated = annotateMoves(raw);
            setMovesSaveError("");
            // persist
            try {
                await apiFetch(`/analysis/${id}/moves`, { method: "PATCH", body: JSON.stringify({ moves: annotated }) });
                setDoc((d) => d ? { ...d, evaluatedMoves: annotated } : d);
            } catch (e) {
                const message = e instanceof Error ? e.message : "Failed to save evaluated moves";
                setMovesSaveError(message);
                console.error(message);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [doc, id, moves]);

    // Re-evaluate the position shown on the board whenever the active ply changes.
    useEffect(() => {
        const engine = interactiveEngineRef.current;
        if (!engine || !doc || moves.length === 0 || doc.evaluatedMoves.length !== moves.length) return;
        const controller = new AbortController();
        setCurrentEval(null);
        setCurrentMate(undefined);

        engine.evaluate(currentPosition.fen(), 12, { signal: controller.signal }).then((result) => {
            setDepth(result.depth);
            setCurrentEval(scoreValue(result));
            setCurrentMate(result.mate);
        }).catch((error: unknown) => {
            if (!(error instanceof DOMException && error.name === "AbortError")) console.error("Interactive evaluation failed:", error);
        });

        return () => controller.abort();
    }, [currentPosition, doc, moves.length]);

    // ----- hint -----
    const requestHint = async () => {
        if (!interactiveEngineRef.current) return;
        setHintLoading(true);
        setHint(null);
        try {
            const result = await interactiveEngineRef.current.evaluate(currentPosition.fen(), 12, { hint: true });
            setHint(result.bestMove);
        } catch (error) {
            console.error("Hint request failed:", error);
        } finally {
            setHintLoading(false);
        }
    };

    // ----- save note (debounced) -----
    useEffect(() => {
        if (!doc || noteStatus !== "saved" || noteDraft === doc.note) return;
        setNoteStatus("saving");
        const t = setTimeout(async () => {
            try {
                await apiFetch(`/analysis/${id}/note`, { method: "PATCH", body: JSON.stringify({ note: noteDraft }) });
                setDoc((d) => d ? { ...d, note: noteDraft } : d);
                setNoteStatus("saved");
            } catch (e) {
                setNoteStatus("error");
                console.error("Failed to save note:", e);
            }
        }, 700);
        return () => clearTimeout(t);
    }, [noteDraft, id, doc, noteStatus]);

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

    const totalPlies = moves.length;
    const evals = doc.evaluatedMoves.map((move, index) => index % 2 === 0 ? move.evalAfter : -move.evalAfter);
    const moveAt = (i: number) => doc.evaluatedMoves[i];
    const classified = moveAt(plyIndex - 1);
    const storedEval = plyIndex === 0 ? 30 : evals[Math.max(0, plyIndex - 1)] ?? 30;
    const whiteEvaluation = currentEval === null
        ? storedEval
        : currentEval * (currentPosition.turn() === "w" ? 1 : -1);
    const currentMove = plyIndex > 0 ? doc.evaluatedMoves[plyIndex - 1] : undefined;
    const badMove = currentMove && ["blunder", "mistake", "inaccuracy"].includes(currentMove.classification);
    const bestArrow = showBestMove && badMove && moves[plyIndex - 1]
        ? (() => {
            const best = new Chess(moves[plyIndex - 1].before).move(currentMove.bestMove);
            return best ? { startSquare: best.from, endSquare: best.to, color: "#2563eb" } : undefined;
        })()
        : undefined;
    const mistakePlies = doc.evaluatedMoves.filter((move) => ["blunder", "mistake", "inaccuracy"].includes(move.classification)).map((move) => move.ply);
    const lastMove = plyIndex > 0 ? (() => {
        const entry = moves[plyIndex - 1];
        return entry ? { from: entry.uci.slice(0, 2), to: entry.uci.slice(2, 4) } : undefined;
    })() : undefined;

    return (
        <div className="mx-auto flex h-screen max-w-7xl flex-col overflow-y-auto px-4 py-3 lg:overflow-hidden">
            <div className="mb-3 flex shrink-0 items-center gap-2 text-sm">
                <Link to="/analysis" className="inline-flex items-center gap-1 text-slate-500 transition hover:text-slate-900">
                    <ArrowLeft className="h-4 w-4" /> Games
                </Link>
                <span className="text-slate-300">·</span>
                <span className="font-semibold text-slate-800">{doc.white.username} vs {doc.black.username}</span>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
                <div className="flex min-h-0 min-w-0 flex-col items-center gap-3 overflow-y-auto pb-2">
                <Card className="w-full max-w-[620px] shrink-0 rounded-xl border border-slate-200 bg-white shadow-sm">
                    <CardContent className="p-3">
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

                <div className="flex min-h-0 w-full max-w-[620px] items-stretch justify-center gap-2">
                    <EvalBar evaluation={whiteEvaluation} mate={currentMate} />
                    <div className="min-w-0 flex-1">
                        <BoardView fen={currentPosition.fen()} lastMove={lastMove} hint={hint} bestArrow={bestArrow} boardOrientation={boardOrientation} />
                        <div className="mx-auto mt-2 flex max-w-full flex-wrap items-center justify-center gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-sm">
                            <button
                                type="button"
                                onClick={() => setPlyIndex(0)}
                                aria-label="Go to first position"
                                className="rounded-full px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
                            >
                                <RotateCcw className="h-4 w-4 inline" />
                            </button>
                            <button
                                type="button"
                                onClick={() => setPlyIndex((p) => Math.max(0, p - 1))}
                                disabled={plyIndex === 0}
                                aria-label="Previous move"
                                className="rounded-full px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                            >
                                <ChevronLeft className="h-4 w-4 inline" />
                            </button>
                            <button
                                type="button"
                                onClick={() => setPlyIndex((p) => Math.min(totalPlies, p + 1))}
                                disabled={plyIndex === totalPlies}
                                aria-label="Next move"
                                className="rounded-full px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                            >
                                <ChevronRight className="h-4 w-4 inline" />
                            </button>
                            <span className="px-2 text-xs font-medium text-slate-500">
                                Move {Math.ceil(plyIndex / 2)}{plyIndex > 0 ? (plyIndex % 2 === 1 ? " (W)" : " (B)") : ""}
                            </span>
                            <button
                                type="button"
                                onClick={requestHint}
                                disabled={hintLoading}
                                className="rounded-full bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-200"
                            >
                                {hintLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Lightbulb className="h-3 w-3" />}
                                    Hint
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowBestMove((visible) => !visible)}
                                className={`rounded-full border px-2.5 py-1.5 text-xs ${showBestMove ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-500"}`}
                            >
                                Best arrow
                            </button>
                            {mistakePlies.length > 0 && (
                                <>
                                    <button type="button" onClick={() => setPlyIndex(mistakePlies.find((ply) => ply > plyIndex) || mistakePlies[0])} className="rounded-full border border-slate-200 px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-100">Next mistake</button>
                                    <button type="button" onClick={() => setPlyIndex([...mistakePlies].reverse().find((ply) => ply < plyIndex) || mistakePlies[mistakePlies.length - 1])} className="rounded-full border border-slate-200 px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-100">Prev mistake</button>
                                </>
                            )}
                            <button
                                type="button"
                                onClick={() => setBoardOrientation((orientation) => orientation === "white" ? "black" : "white")}
                                className="rounded-full border border-slate-200 px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
                                aria-label="Flip board"
                            >
                                <FlipHorizontal2 className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </div>

                </div>

                <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <Card className="shrink-0 border-0 bg-slate-50 shadow-none">
                        <CardContent className="space-y-2 p-3">
                            <div className="flex items-center justify-between">
                                <h2 className="text-sm font-semibold text-slate-800">Game overview</h2>
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">{doc.white.result === "win" ? "White won" : doc.black.result === "win" ? "Black won" : "Draw"}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-600">{doc.white.username}</span>
                                <span className="font-semibold text-slate-800">{doc.white.rating || "—"}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-600">{doc.black.username}</span>
                                <span className="font-semibold text-slate-800">{doc.black.rating || "—"}</span>
                            </div>
                            {classified && <p className="border-t border-slate-200 pt-2 text-xs text-slate-600">{classified.classification.toUpperCase()} · {classified.explanation || "Solid move."}</p>}
                            <AccuracySummary moves={doc.evaluatedMoves} />
                        </CardContent>
                    </Card>

                    <Card className="shrink-0 rounded-xl border border-slate-200 shadow-sm">
                    <CardContent className="space-y-2 p-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold">Moves</h3>
                            <span className="text-xs text-muted-foreground">Depth: {depth}{currentMate !== undefined ? ` · M${Math.abs(currentMate)}` : currentEval !== null ? ` · ${currentEval > 0 ? "+" : ""}${(currentEval / 100).toFixed(1)}` : ""}</span>
                        </div>
                        <div className="grid h-[260px] grid-cols-2 gap-1 overflow-y-auto rounded-md bg-slate-50 p-1 text-sm">
                            {moves.map((m, i) => {
                                const classified = moveAt(i);
                                const isCurrent = plyIndex === i + 1;
                                return (
                                    <button
                                        type="button"
                                        key={i}
                                        ref={(element) => { moveButtonRefs.current[i] = element; }}
                                        onClick={() => setPlyIndex(i + 1)}
                                        className={`flex items-center gap-1 rounded px-2 py-1 text-left ${isCurrent ? "bg-amber-100 text-amber-900" : "text-slate-700 hover:bg-slate-100"}`}
                                    >
                                        <span className="text-xs text-muted-foreground w-6 inline-block">
                                            {i % 2 === 0 ? `${Math.floor(i / 2) + 1}.` : ""}
                                        </span>
                                        {classified && (
                                            <span className={`inline-block w-1.5 h-1.5 rounded-full ${CLASS_COLOR[classified.classification]}`} />
                                        )}
                                        <span>{m.san}</span>
                                        {classified?.classification && <span className="ml-auto text-xs font-semibold text-slate-500">{CLASS_SYMBOL[classified.classification]}</span>}
                                    </button>
                                );
                            })}
                        </div>
                    </CardContent>
                    </Card>

                <Card className="shrink-0 rounded-xl border border-slate-200 shadow-sm">
                    <CardContent className="p-3">
                        <div className="mb-2 flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-slate-800">Engine evaluation</h3>
                            <span className="text-xs text-slate-500">Depth {depth}</span>
                        </div>
                        <EvalGraph evals={evals} ply={plyIndex} onSelect={(ply) => setPlyIndex(Math.max(0, Math.min(totalPlies, ply)))} />
                        {analysisProgress.total > 0 && analysisProgress.completed < analysisProgress.total && (
                            <div className="space-y-1">
                                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-emerald-500 transition-all" style={{ width: `${(analysisProgress.completed / analysisProgress.total) * 100}%` }} /></div>
                                <p className="text-xs text-slate-500">Analyzing {analysisProgress.completed}/{analysisProgress.total} moves…</p>
                            </div>
                        )}
                        {movesSaveError && <p className="text-xs text-red-600">Could not save evaluations: {movesSaveError}</p>}
                    </CardContent>
                </Card>

                <Card className="shrink-0 rounded-xl border border-slate-200 shadow-sm">
                    <CardContent className="space-y-2 p-3">
                        <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-slate-800">Your notes</h3><span className={`text-xs ${noteStatus === "error" ? "text-red-600" : "text-slate-500"}`}>{noteStatus === "saving" ? "Saving…" : noteStatus === "error" ? "Save failed" : "Saved"}</span></div>
                        <textarea value={noteDraft} onChange={(e) => { setNoteStatus("saved"); setNoteDraft(e.target.value); }} placeholder="What did you learn from this game?" rows={3} className="w-full rounded-md border border-slate-200 bg-slate-50 p-2 text-sm text-slate-800 outline-none focus:border-emerald-500" />
                    </CardContent>
                </Card>
                </aside>
            </div>
        </div>
    );
}

// ----- helpers -----

function scoreValue(result: Pick<EngineResult, "cp" | "mate">): number {
    if (result.mate === undefined) return result.cp;
    return Math.sign(result.mate || 1) * 100000;
}

function uciToSan(fen: string, uci: string): string {
    if (!uci || uci === "(none)") return "";
    try {
        const chess = new Chess(fen);
        const move = chess.move({
            from: uci.slice(0, 2) as never,
            to: uci.slice(2, 4) as never,
            promotion: (uci[4] || undefined) as never,
        });
        return move?.san || "";
    } catch {
        return "";
    }
}

async function evaluateCached(
    engine: StockfishEngine,
    cache: Map<string, EngineResult>,
    fen: string,
    depth: number,
): Promise<EngineResult> {
    const key = `${fen}|${depth}`;
    const cached = cache.get(key);
    if (cached) return cached;
    const result = await engine.evaluate(fen, depth);
    cache.set(key, result);
    return result;
}

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

// ----- subcomponents -----

function BoardView({ fen, lastMove, hint, bestArrow, boardOrientation }: { fen: string; lastMove?: { from: string; to: string }; hint?: string | null; bestArrow?: { startSquare: string; endSquare: string; color: string }; boardOrientation: "white" | "black" }) {
    const hintSquares = useMemo(() => {
        if (!hint) return new Set<string>();
        return new Set([hint.slice(0, 2), hint.slice(2, 4)]);
    }, [hint]);

    return (
        <div className="mx-auto aspect-square w-full max-w-[min(500px,calc(100vh-230px))] overflow-hidden rounded-lg border border-slate-200 shadow-sm">
            <Chessboard options={{
                position: fen,
                boardOrientation,
                animationDurationInMs: 200,
                allowDragging: false,
                boardStyle: { borderRadius: "0px" },
                darkSquareStyle: { backgroundColor: "#779952" },
                lightSquareStyle: { backgroundColor: "#edeed1" },
                squareStyles: {
                    ...(lastMove ? {
                        [lastMove.from]: { backgroundColor: "rgba(255, 255, 0, 0.25)" },
                        [lastMove.to]: { backgroundColor: "rgba(255, 255, 0, 0.35)" },
                    } : {}),
                    ...Array.from(hintSquares).reduce<Record<string, React.CSSProperties>>((styles, square) => {
                        styles[square] = { boxShadow: "inset 0 0 0 4px rgba(59, 130, 246, 0.8)" };
                        return styles;
                    }, {}),
                },
                arrows: bestArrow ? [bestArrow] : [],
                allowDrawingArrows: false,
                showNotation: true,
            }} />
        </div>
    );
}
function EvalBar({ evaluation, mate }: { evaluation: number; mate?: number }) {
    const clamped = Math.max(-1000, Math.min(1000, evaluation));
    const whitePercent = 50 + (clamped / 1000) * 50;
    const label = mate === undefined ? `${evaluation >= 0 ? "+" : ""}${(evaluation / 100).toFixed(1)}` : `M${Math.abs(mate)}`;
    return (
        <div className="flex w-7 shrink-0 flex-col items-center gap-2">
            <div className="relative h-full min-h-0 w-5 flex-1 overflow-hidden rounded-sm border border-slate-200 bg-slate-800 shadow-inner">
                <motion.div
                    animate={{ height: `${whitePercent}%` }}
                    transition={{ duration: 0.45, ease: "easeOut" }}
                    className="absolute bottom-0 left-0 right-0 bg-white"
                />
                <div className="absolute inset-x-0 top-1/2 border-t border-slate-500/50" />
            </div>
            <span className="font-mono text-[11px] font-medium tabular-nums text-slate-600">{label}</span>
        </div>
    );
}

function AccuracySummary({ moves }: { moves: EvaluatedMove[] }) {
    const groups = [
        { label: "White", offset: 0 },
        { label: "Black", offset: 1 },
    ];
    return (
        <div className="grid grid-cols-2 gap-2 border-t border-slate-200 pt-2">
            {groups.map(({ label, offset }) => {
                const playerMoves = moves.filter((move) => (move.ply - 1) % 2 === offset);
                const losses = playerMoves.map((move) => Math.max(0, move.evalBefore - move.evalAfter));
                const averageLoss = losses.length ? Math.round(losses.reduce((sum, loss) => sum + loss, 0) / losses.length) : 0;
                const count = (classification: string) => playerMoves.filter((move) => move.classification === classification).length;
                return (
                    <div key={label} className="rounded-md bg-white p-2 text-xs text-slate-600">
                        <div className="font-medium text-slate-800">{label}</div>
                        <div>Avg loss: {averageLoss} cp</div>
                        <div>?? {count("blunder")} · ? {count("mistake")} · ?! {count("inaccuracy")}</div>
                    </div>
                );
            })}
        </div>
    );
}

function EvalGraph({ evals, ply, onSelect }: { evals: number[]; ply: number; onSelect: (ply: number) => void }) {
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
        <svg viewBox={`0 0 ${W} ${H}`} className="h-20 w-full cursor-pointer" onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            onSelect(Math.round(((event.clientX - rect.left) / rect.width) * (clamped.length - 1)));
        }}>
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
