import { useCallback, useEffect, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, FlipHorizontal2, Maximize2, Minimize2, RotateCcw, Settings2, Swords, Volume2, VolumeX } from "lucide-react";
import { Chessboard } from "react-chessboard";
import { GridBackground } from "@/components/ui/grid-background";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { getBestMove, getPositionEvaluation, type EngineDifficulty } from "@/engine/play-engine";

type PlayerColor = "white" | "black";
type SoundEvent = "move" | "capture" | "check" | "checkmate";
type MoveRecord = { san: string; fen: string; from: string; to: string; captured?: string; timestamp: number };
type SavedGameStatus = "idle" | "active" | "resigned" | "checkmate" | "draw";
type SavedGameState = {
    version: 1;
    fen: string;
    moveHistory: MoveRecord[];
    settings: { playerColor: PlayerColor; difficulty: EngineDifficulty; botDelay: number; audioEnabled: boolean };
    status: SavedGameStatus;
    boardOrientation: PlayerColor;
    savedAt: number;
};

const SAVED_GAME_KEY = "chess_engine_game_state";

const difficultyLabels: Record<EngineDifficulty, string> = {
    easy: "Easy",
    medium: "Medium",
    hard: "Hard",
};

export default function PlayWithEngine() {
    const { user } = useAuth();
    const [game, setGame] = useState(() => new Chess());
    const [playerColor, setPlayerColor] = useState<PlayerColor>("white");
    const [difficulty, setDifficulty] = useState<EngineDifficulty>("medium");
    const [botDelay, setBotDelay] = useState(500);
    const [showSettings, setShowSettings] = useState(true);
    const [thinking, setThinking] = useState(false);
    const [gameActive, setGameActive] = useState(false);
    const [resigned, setResigned] = useState(false);
    const [focusMode, setFocusMode] = useState(false);
    const [audioEnabled, setAudioEnabled] = useState(true);
    const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
    const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
    const [moveHistory, setMoveHistory] = useState<MoveRecord[]>([]);
    const [reviewPly, setReviewPly] = useState<number | null>(null);
    const [boardOrientation, setBoardOrientation] = useState<PlayerColor>("white");
    const gameRef = useRef(game);
    const engineTimerRef = useRef<number | null>(null);
    const boardRef = useRef<HTMLDivElement | null>(null);
    const restoredRef = useRef(false);

    const playSound = (event: SoundEvent) => {
        if (!audioEnabled) return;
        const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextClass) return;

        const context = new AudioContextClass();
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const settings: Record<SoundEvent, { frequency: number; duration: number; type: OscillatorType }> = {
            move: { frequency: 420, duration: 0.09, type: "sine" },
            capture: { frequency: 280, duration: 0.14, type: "triangle" },
            check: { frequency: 650, duration: 0.18, type: "square" },
            checkmate: { frequency: 190, duration: 0.42, type: "sawtooth" },
        };
        const sound = settings[event];
        oscillator.type = sound.type;
        oscillator.frequency.value = sound.frequency;
        gain.gain.setValueAtTime(0.08, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + sound.duration);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start();
        oscillator.stop(context.currentTime + sound.duration);
        window.setTimeout(() => void context.close(), sound.duration * 1000 + 50);
    };

    const playMoveSound = (position: Chess, captured: boolean) => {
        if (position.isCheckmate()) playSound("checkmate");
        else if (position.inCheck()) playSound("check");
        else playSound(captured ? "capture" : "move");
    };

    const reset = () => {
        if (engineTimerRef.current !== null) window.clearTimeout(engineTimerRef.current);
        const next = new Chess();
        gameRef.current = next;
        setGame(next);
        setLastMove(null);
        setSelectedSquare(null);
        setMoveHistory([]);
        setReviewPly(null);
        setThinking(false);
        setGameActive(false);
        setResigned(false);
        setFocusMode(false);
        window.localStorage.removeItem(SAVED_GAME_KEY);
    };

    const recordMove = (move: { san: string; from: string; to: string; captured?: string }, position: Chess) => {
        setMoveHistory((history) => [...history, { ...move, fen: position.fen(), timestamp: Date.now() }]);
        setReviewPly(null);
    };

    const scheduleEngineMove = (position: Chess, color: PlayerColor, level: EngineDifficulty) => {
        const engineColor = color === "white" ? "b" : "w";
        if (position.isGameOver() || position.turn() !== engineColor) return;
        setThinking(true);
        engineTimerRef.current = window.setTimeout(() => {
            const current = gameRef.current;
            if (current !== position || current.isGameOver()) {
                setThinking(false);
                return;
            }
            const san = getBestMove(current.fen(), level);
            if (san) {
                const move = current.move(san);
                playMoveSound(current, Boolean(move.captured));
                setLastMove({ from: move.from, to: move.to });
                setSelectedSquare(null);
                recordMove(move, current);
                setGame(new Chess(current.fen()));
                if (current.isGameOver()) {
                    setGameActive(false);
                    setFocusMode(false);
                }
            }
            setThinking(false);
        }, botDelay);
    };

    useEffect(() => () => {
        if (engineTimerRef.current !== null) window.clearTimeout(engineTimerRef.current);
    }, []);

    /* Restore external persisted state once when the page mounts. */
    useEffect(() => {
        if (restoredRef.current) return;
        restoredRef.current = true;
        try {
            const raw = window.localStorage.getItem(SAVED_GAME_KEY);
            if (!raw) return;
            const saved = JSON.parse(raw) as SavedGameState;
            if (saved.version !== 1 || !saved.fen || !Array.isArray(saved.moveHistory)) return;
            const restoredGame = new Chess(saved.fen);
            gameRef.current = restoredGame;
            setGame(restoredGame);
            setMoveHistory(saved.moveHistory);
            setPlayerColor(saved.settings.playerColor);
            setDifficulty(saved.settings.difficulty);
            setBotDelay(saved.settings.botDelay);
            setAudioEnabled(saved.settings.audioEnabled);
            setBoardOrientation(saved.boardOrientation);
            setResigned(saved.status === "resigned");
            setGameActive(saved.status === "active");
            setFocusMode(saved.status === "active");
            const restoredMove = saved.moveHistory.at(-1);
            setLastMove(restoredMove ? { from: restoredMove.from, to: restoredMove.to } : null);
            if (saved.status === "active" && restoredGame.turn() === (saved.settings.playerColor === "white" ? "b" : "w")) {
                window.setTimeout(() => scheduleEngineMove(restoredGame, saved.settings.playerColor, saved.settings.difficulty), 0);
            }
        } catch (error) {
            console.error("Failed to restore saved chess game:", error);
            window.localStorage.removeItem(SAVED_GAME_KEY);
        }
        // The restore effect intentionally runs once; its engine callback uses the saved snapshot.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!restoredRef.current) return;
        const status: SavedGameStatus = resigned
            ? "resigned"
            : game.isCheckmate()
                ? "checkmate"
                : game.isDraw()
                    ? "draw"
                    : gameActive ? "active" : "idle";
        const snapshot: SavedGameState = {
            version: 1,
            fen: game.fen(),
            moveHistory,
            settings: { playerColor, difficulty, botDelay, audioEnabled },
            status,
            boardOrientation,
            savedAt: Date.now(),
        };
        window.localStorage.setItem(SAVED_GAME_KEY, JSON.stringify(snapshot));
    }, [game, moveHistory, playerColor, difficulty, botDelay, audioEnabled, gameActive, resigned, boardOrientation]);

    const startGame = () => {
        if (game.isGameOver() || resigned || moveHistory.length > 0) {
            reset();
        }
        setResigned(false);
        setGameActive(true);
        setFocusMode(true);
        setSelectedSquare(null);
        boardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        boardRef.current?.focus({ preventScroll: true });
        if (playerColor === "black") {
            window.setTimeout(() => scheduleEngineMove(gameRef.current, playerColor, difficulty), 0);
        }
    };

    const resign = () => {
        if (!gameActive) return;
        if (engineTimerRef.current !== null) window.clearTimeout(engineTimerRef.current);
        setThinking(false);
        setGameActive(false);
        setResigned(true);
        setFocusMode(false);
        setSelectedSquare(null);
    };

    const makePlayerMove = (sourceSquare: string, targetSquare: string) => {
        if (!gameActive || thinking || gameRef.current.isGameOver()) return false;
        const current = gameRef.current;
        const isPlayerTurn = (current.turn() === "w") === (playerColor === "white");
        if (!isPlayerTurn) return false;
        try {
            const move = current.move({ from: sourceSquare, to: targetSquare, promotion: "q" });
            playMoveSound(current, Boolean(move.captured));
            setLastMove({ from: move.from, to: move.to });
            setSelectedSquare(null);
            recordMove(move, current);
            const next = new Chess(current.fen());
            gameRef.current = next;
            setGame(next);
            if (next.isGameOver()) {
                setGameActive(false);
                setFocusMode(false);
            } else {
                scheduleEngineMove(next, playerColor, difficulty);
            }
            return true;
        } catch {
            return false;
        }
    };

    const onPieceDrop = ({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string }) =>
        reviewPly === null ? makePlayerMove(sourceSquare, targetSquare) : false;

    const handleSquareClick = (square: string) => {
        if (reviewPly !== null || !gameActive || thinking || gameRef.current.isGameOver()) {
            setSelectedSquare(null);
            return;
        }

        const current = gameRef.current;
        const isPlayerTurn = (current.turn() === "w") === (playerColor === "white");
        if (!isPlayerTurn) {
            setSelectedSquare(null);
            return;
        }

        if (selectedSquare) {
            const destinationIsLegal = current.moves({ square: selectedSquare, verbose: true })
                .some((move) => move.to === square);
            if (destinationIsLegal) {
                makePlayerMove(selectedSquare, square);
                return;
            }
        }

        const piece = current.get(square as Square);
        if (piece?.color === current.turn()) {
            setSelectedSquare(square as Square);
        } else {
            setSelectedSquare(null);
        }
    };

    const activePly = reviewPly ?? moveHistory.length;
    const displayGame = reviewPly === null
        ? game
        : reviewPly === 0
            ? new Chess()
            : new Chess(moveHistory[reviewPly - 1]?.fen);
    const displayedMove = activePly > 0 ? moveHistory[activePly - 1] : undefined;
    const legalMoves = reviewPly === null && selectedSquare
        ? displayGame.moves({ square: selectedSquare, verbose: true })
        : [];
    const squareStyles: Record<string, React.CSSProperties> = {};
    if (displayedMove || lastMove) {
        const move = displayedMove ?? lastMove;
        if (move) {
            squareStyles[move.from] = { backgroundColor: "rgba(255, 255, 0, 0.25)" };
            squareStyles[move.to] = { backgroundColor: "rgba(255, 255, 0, 0.35)" };
        }
    }
    if (selectedSquare) {
        squareStyles[selectedSquare] = {
            ...squareStyles[selectedSquare],
            backgroundColor: "rgba(20, 184, 166, 0.55)",
            boxShadow: "inset 0 0 0 3px rgba(13, 148, 136, 0.9)",
        };
    }
    for (const move of legalMoves) {
        squareStyles[move.to] = {
            ...squareStyles[move.to],
            background: move.captured
                ? "radial-gradient(circle, transparent 48%, rgba(20, 83, 45, 0.72) 51%, rgba(20, 83, 45, 0.72) 60%, transparent 63%)"
                : "radial-gradient(circle, rgba(20, 83, 45, 0.55) 0 18%, transparent 20%)",
        };
    }

    const evaluation = getPositionEvaluation(displayGame.fen());
    const status = reviewPly !== null
        ? "Reviewing a past position"
        : game.isCheckmate()
            ? `Checkmate — ${game.turn() === "w" ? "Black" : "White"} wins`
            : game.isDraw()
            ? "Draw"
            : game.inCheck()
                    ? `${game.turn() === "w" ? "White" : "Black"} is in check`
                    : thinking ? "Engine is thinking…" : `${game.turn() === "w" ? "White" : "Black"} to move`;
    const gameEnded = resigned || game.isGameOver();

    const jumpToPly = useCallback((ply: number) => {
        setSelectedSquare(null);
        setReviewPly(ply >= moveHistory.length ? null : Math.max(0, ply));
    }, [moveHistory.length]);

    const undo = () => {
        if (!gameActive || thinking || moveHistory.length === 0) return;
        const removeCount = moveHistory.length >= 2 ? 2 : 1;
        const remaining = moveHistory.slice(0, -removeCount);
        const next = remaining.length ? new Chess(remaining[remaining.length - 1].fen) : new Chess();
        if (engineTimerRef.current !== null) window.clearTimeout(engineTimerRef.current);
        gameRef.current = next;
        setGame(next);
        setMoveHistory(remaining);
        setReviewPly(null);
        setLastMove(remaining.at(-1) ?? null);
        setSelectedSquare(null);
        setThinking(false);
    };

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            if (["INPUT", "SELECT", "TEXTAREA"].includes((event.target as HTMLElement).tagName)) return;
            if (moveHistory.length === 0) return;
            event.preventDefault();
            const current = reviewPly ?? moveHistory.length;
            jumpToPly(event.key === "ArrowLeft" ? Math.max(0, current - 1) : Math.min(moveHistory.length, current + 1));
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [jumpToPly, moveHistory.length, reviewPly]);

    return (
        <GridBackground>
            {!focusMode && <div className="animate-in fade-in duration-300"><Navbar /></div>}
            <main className={`h-[calc(100vh-4rem)] overflow-hidden px-2 py-2 transition-[padding] duration-300 sm:px-4 ${focusMode ? "h-screen" : ""}`}>
                <div className="mx-auto flex w-full max-w-[1180px] flex-col">
                    {!focusMode && (
                        <div className="mb-2 flex animate-in fade-in items-center justify-between duration-300">
                            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Play with Engine</h1>
                            <Button variant="outline" size="sm" onClick={reset}><RotateCcw className="h-4 w-4" /> New game</Button>
                        </div>
                    )}

                    <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-center gap-6 overflow-hidden p-2 lg:flex-row lg:items-stretch">
                        <section className="flex w-full min-w-0 flex-col items-center lg:max-w-[600px]">
                            <PlayerBanner name="StockBot" rating="800" flag="🇺🇸" avatar="🤖" />
                            <div className={`w-full max-w-[600px] rounded-b-xl border border-t-0 border-slate-200 bg-white p-3 shadow-sm sm:p-4 ${focusMode ? "sm:p-3" : ""}`}>
                                <div className="mb-2 flex items-center justify-between px-1 text-xs text-slate-500">
                                    <span className={thinking ? "text-emerald-400" : ""}>{status}</span>
                                    <span className="font-mono">{evaluation >= 0 ? "+" : ""}{(evaluation / 100).toFixed(1)}</span>
                                </div>
                                <div ref={boardRef} tabIndex={-1} className="mx-auto flex w-full max-w-[min(570px,calc(100vh-160px))] items-stretch gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">
                                    <EvaluationBar evaluation={evaluation} />
                                    <div className="aspect-square w-full min-w-0 max-w-[min(560px,calc(100vh-160px))] overflow-hidden rounded-md shadow-xl">
                                        <div className="h-full w-full">
                                            <Chessboard options={{
                                                position: displayGame.fen(),
                                                onPieceDrop,
                                                onSquareClick: ({ square }: { square: string }) => handleSquareClick(square),
                                                onPieceClick: ({ square }: { square: string }) => handleSquareClick(square),
                                                boardOrientation,
                                                animationDurationInMs: 200,
                                                allowDragging: reviewPly === null && gameActive && !thinking && !game.isGameOver(),
                                                boardStyle: { borderRadius: "0px" },
                                                darkSquareStyle: { backgroundColor: "#779952" },
                                                lightSquareStyle: { backgroundColor: "#edeed1" },
                                                squareStyles,
                                            }} />
                                        </div>
                                    </div>
                                </div>
                                {reviewPly !== null && <div className="mt-2 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300">Review Mode · live play paused</div>}
                            </div>
                            <PlayerBanner
                                name={user?.name || user?.email?.split("@")[0] || "Guest"}
                                rating=""
                                flag="🇮🇳"
                                avatar={user?.avatar || user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || "G"}
                                avatarUrl={user?.avatar}
                                isPlayer
                            />
                        </section>

                        <aside className="flex w-full min-h-0 flex-shrink-0 flex-col overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 text-slate-900 shadow-sm lg:h-auto lg:w-[380px]">
                            <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 px-5 py-4">
                                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-lg">♟</div>
                                <div><p className="font-semibold text-slate-900">Play with Engine</p><p className="text-xs text-slate-500">{thinking ? "StockBot is thinking…" : "A friendly chess challenge"}</p></div>
                            </div>
                            <div className="shrink-0 border-b border-slate-200 px-3 py-2">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-300 to-rose-500 text-3xl">🤖</div>
                                    <div className="relative rounded-xl rounded-bl-sm bg-slate-100 px-3 py-2 text-xs text-slate-800 shadow-sm">
                                        {game.isGameOver() ? "Well played! Start a new game to try again." : gameActive ? "Stay focused — find the best move!" : "Good luck, have fun, and may the best chess player win!"}
                                    </div>
                                </div>
                            </div>
                            <div className="flex min-h-0 flex-1 flex-col gap-4 p-5">
                                <MoveHistory history={moveHistory} activePly={activePly} onSelect={jumpToPly} onFirst={() => jumpToPly(0)} onPrevious={() => jumpToPly(Math.max(0, activePly - 1))} onNext={() => jumpToPly(Math.min(moveHistory.length, activePly + 1))} onLive={() => jumpToPly(moveHistory.length)} />
                                <div className="flex shrink-0 flex-col gap-2">
                                    <Button className="w-full min-w-0 whitespace-nowrap bg-[#6f873b] px-4 text-white transition hover:bg-[#5f7630] hover:bg-opacity-90" onClick={gameActive ? resign : startGame}><Swords className="h-4 w-4 shrink-0" />{gameActive ? "Resign" : gameEnded ? "Play Again" : "Play"}</Button>
                                    <div className="grid grid-cols-5 gap-2">
                                        <ToolbarButton label="Undo / Takeback" disabled={!gameActive || thinking || moveHistory.length === 0 || reviewPly !== null} onClick={undo}><RotateCcw className="h-4 w-4" /></ToolbarButton>
                                        <ToolbarButton label="Flip board" onClick={() => setBoardOrientation((orientation) => orientation === "white" ? "black" : "white")}><FlipHorizontal2 className="h-4 w-4" /></ToolbarButton>
                                        <ToolbarButton label={audioEnabled ? "Mute sounds" : "Enable sounds"} onClick={() => setAudioEnabled((enabled) => !enabled)}>{audioEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}</ToolbarButton>
                                        <ToolbarButton label="Game settings" onClick={() => setShowSettings((visible) => !visible)}><Settings2 className="h-4 w-4" /></ToolbarButton>
                                        <ToolbarButton label={focusMode ? "Exit focus mode" : "Enter focus mode"} onClick={() => setFocusMode((focused) => !focused)}>{focusMode ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</ToolbarButton>
                                    </div>
                                </div>
                            </div>
                            {!gameActive && showSettings && (
                                <div className="shrink-0 border-t border-slate-200 px-5 pb-6 pt-4">
                                    <div className="mb-4 flex items-center justify-between leading-5"><h2 className="text-sm font-semibold text-slate-800">Game settings</h2></div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <DarkSelect label="Play as" value={playerColor} disabled={gameActive} onChange={(value) => { setPlayerColor(value as PlayerColor); reset(); }} options={[["white", "White"], ["black", "Black"]]} />
                                        <DarkSelect label="Difficulty" value={difficulty} disabled={gameActive} onChange={(value) => setDifficulty(value as EngineDifficulty)} options={Object.entries(difficultyLabels)} />
                                        <DarkSelect label="Bot Move Delay" value={String(botDelay)} disabled={gameActive} onChange={(value) => setBotDelay(Number(value))} options={[["300", "300 ms"], ["500", "500 ms"], ["800", "800 ms"]]} />
                                    </div>
                                </div>
                            )}
                        </aside>
                    </div>
                </div>
            </main>
        </GridBackground>
    );
}

function PlayerBanner({ name, rating, flag, avatar, avatarUrl, isPlayer = false }: { name: string; rating: string; flag: string; avatar: string; avatarUrl?: string; isPlayer?: boolean }) {
    return (
        <div className={`flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm ${isPlayer ? "mt-2" : "mb-2"}`}>
            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
                {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : avatar}
            </div>
            <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-800">{name}{rating && <span className="ml-1 font-normal text-xs text-slate-500">({rating})</span>}</span>
                <span aria-label={`${name} country`}>{flag}</span>
            </div>
            {isPlayer && <span className="ml-auto text-xs text-slate-500">You</span>}
        </div>
    );
}

function DarkSelect({ label, value, disabled, onChange, options }: { label: string; value: string; disabled?: boolean; onChange: (value: string) => void; options: string[][] }) {
    return (
        <label className="block text-xs font-medium leading-5 text-slate-700">
            {label}
            <select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="mt-1.5 w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-800 outline-none hover:bg-slate-100 focus:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-50">
                {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
            </select>
        </label>
    );
}

function ToolbarButton({ children, label, onClick, disabled = false }: { children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
    return (
        <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 flex-shrink-0 justify-self-center border-slate-200 bg-white text-slate-700 transition hover:bg-slate-100 hover:bg-opacity-90"
            disabled={disabled}
            onClick={onClick}
            title={label}
            aria-label={label}
        >
            {children}
        </Button>
    );
}

function EvaluationBar({ evaluation }: { evaluation: number }) {
    const clamped = Math.max(-1000, Math.min(1000, evaluation));
    const whitePercent = 50 + (clamped / 1000) * 50;
    const label = `${evaluation >= 0 ? "+" : ""}${(evaluation / 100).toFixed(1)}`;

    return (
        <div className="flex min-h-0 w-7 shrink-0 flex-col items-center gap-2">
            <div className="relative h-full min-h-0 w-5 flex-1 overflow-hidden rounded-sm border border-slate-200 bg-slate-800 shadow-inner">
                <div
                    className="absolute bottom-0 left-0 right-0 bg-white transition-[height] duration-500 ease-out"
                    style={{ height: `${whitePercent}%` }}
                    aria-label={`White evaluation ${label}`}
                />
                <div className="absolute inset-x-0 top-1/2 border-t border-neutral-500/50" />
            </div>
            <span className="font-mono text-[11px] font-medium tabular-nums text-muted-foreground">{label}</span>
        </div>
    );
}

function MoveHistory({
    history,
    activePly,
    onSelect,
    onFirst,
    onPrevious,
    onNext,
    onLive,
}: {
    history: MoveRecord[];
    activePly: number;
    onSelect: (ply: number) => void;
    onFirst: () => void;
    onPrevious: () => void;
    onNext: () => void;
    onLive: () => void;
}) {
    const bottomRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, [history.length]);

    return (
        <div className="flex h-[240px] min-h-[200px] flex-none flex-col border-t border-border pt-3">
            <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-800">Move History</p>
                <span className="text-xs text-slate-500">{history.length} ply</span>
            </div>
            <div className="mb-3 flex items-center gap-1">
                <HistoryButton label="First move" onClick={onFirst}><ChevronsLeft className="h-4 w-4" /></HistoryButton>
                <HistoryButton label="Previous move" onClick={onPrevious}><ChevronLeft className="h-4 w-4" /></HistoryButton>
                <HistoryButton label="Next move" onClick={onNext}><ChevronRight className="h-4 w-4" /></HistoryButton>
                <HistoryButton label="Live position" onClick={onLive} wide className="ml-auto text-xs">Live <ChevronsRight className="h-4 w-4" /></HistoryButton>
            </div>
            <div className="h-[240px] min-h-[200px] overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-2">
                {history.length === 0 ? (
                    <p className="py-5 text-center text-xs text-slate-500">Moves will appear here after the game starts.</p>
                ) : (
                    <div className="space-y-1">
                        {Array.from({ length: Math.ceil(history.length / 2) }, (_, index) => {
                            const whitePly = index * 2 + 1;
                            const blackPly = whitePly + 1;
                            return (
                                <div key={index} className={`grid grid-cols-[2rem_1fr_1fr] items-center gap-1 rounded-md px-1 text-sm ${index % 2 === 0 ? "bg-white" : "bg-slate-50"}`}>
                                    <span className="text-xs text-muted-foreground">{index + 1}.</span>
                                    <MoveButton active={activePly === whitePly} onClick={() => onSelect(whitePly)}>{history[whitePly - 1].san}</MoveButton>
                                    {history[blackPly - 1] ? (
                                        <MoveButton active={activePly === blackPly} onClick={() => onSelect(blackPly)}>{history[blackPly - 1].san}</MoveButton>
                                    ) : <span />}
                                </div>
                            );
                        })}
                    </div>
                )}
                <div ref={bottomRef} aria-hidden="true" />
            </div>
        </div>
    );
}

function HistoryButton({ children, label, onClick, className = "", wide = false }: { children: React.ReactNode; label: string; onClick: () => void; className?: string; wide?: boolean }) {
    return <Button variant="outline" size={wide ? "default" : "icon"} className={`${wide ? "h-8 px-3" : "h-8 w-8"} border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 ${className}`} title={label} aria-label={label} onClick={onClick}>{children}</Button>;
}

function MoveButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`rounded px-2 py-1 text-left transition-colors ${active ? "bg-emerald-100 font-semibold text-emerald-800 ring-1 ring-emerald-200" : "text-slate-700 hover:bg-slate-100"}`}
        >
            {children}
        </button>
    );
}
