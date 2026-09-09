/**
 * GameList — month-grouped list of a Chess.com player's recent games
 * with an "Analyze" button per row that creates an analysis record and
 * navigates to /analysis/:id.
 *
 * Backend: GET /player/:username/games/last-3-months
 *          POST /analysis { chessUsername, game }
 */

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import {
    Calendar,
    ChevronDown,
    Clock,
    Loader2,
    Mail,
    PenLine,
    RefreshCw,
    Upload,
    Zap,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface GameSummary {
    gameId: string;
    pgn: string;
    white: { username: string; rating?: number; result: string };
    black: { username: string; rating?: number; result: string };
    endTime: number;
    timeClass: string;
    timeControl: string;
    rated: boolean;
}

interface RollingGamesResponse {
    startDate: string;
    endDate: string;
    games: GameSummary[];
}

const TIME_CLASS_LABEL: Record<string, string> = {
    bullet: "Bullet",
    blitz: "Blitz",
    rapid: "Rapid",
    daily: "Daily",
    unknown: "—",
};

const resultLabel = (result: string): "Win" | "Loss" | "Draw" => {
    if (result === "win") return "Win";
    if (["checkmated", "resigned", "timeout", "abandoned", "lose"].includes(result)) return "Loss";
    return "Draw";
};

const resultBadgeClasses = (label: "Win" | "Loss" | "Draw"): string => {
    switch (label) {
        case "Win":
            return "bg-green-500/15 text-green-700 ring-1 ring-inset ring-green-600/30 dark:text-green-400";
        case "Loss":
            return "bg-red-500/15 text-red-700 ring-1 ring-inset ring-red-600/30 dark:text-red-400";
        default:
            return "bg-gray-500/15 text-gray-600 ring-1 ring-inset ring-gray-500/30 dark:text-gray-300";
    }
};

const monthLabel = (year: number, month: number) => {
    return new Date(year, month - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
};

function timeAgo(timestamp: number): string {
    const seconds = Math.max(0, Math.floor(Date.now() / 1000) - timestamp);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

function openingName(pgn: string): string {
    const urlMatch = pgn.match(/\[ECOUrl\s+"([^"]+)"\]/i);
    if (urlMatch?.[1]) {
        const slug = urlMatch[1].split("/").filter(Boolean).pop();
        if (slug) return slug.replace(/-/g, " ");
    }
    const ecoMatch = pgn.match(/\[ECO\s+"([^"]+)"\]/i);
    if (ecoMatch?.[1]) return ecoMatch[1];

    return "Unknown Opening";
}

function moveCount(pgn: string): number {
    const movetext = pgn
        .replace(/\[[^\]]*\]/g, "")
        .replace(/\{[^}]*\}/g, "")
        .replace(/\([^)]*\)/g, "")
        .replace(/1-0|0-1|1\/2-1\/2|\*/g, "");
    return movetext.trim().split(/\s+/).filter((token) => token && !/^\d+\.{1,3}$/.test(token)).length;
}

function formatTimeControl(timeControl: string): string {
    if (!timeControl) return "";

    if (timeControl.includes("/")) {
        const [, secondsPerMove] = timeControl.split("/");
        const days = Math.round(Number(secondsPerMove) / 86400);
        return days === 1 ? "1 day" : `${days} days`;
    }

    const [baseSecondsStr, incrementStr] = timeControl.split("+");
    const baseSeconds = Number(baseSecondsStr);
    const increment = incrementStr ? Number(incrementStr) : 0;

    if (Number.isNaN(baseSeconds)) return timeControl;

    const minutes = baseSeconds / 60;
    const minutesLabel = Number.isInteger(minutes) ? String(minutes) : minutes.toFixed(1);

    return increment ? `${minutesLabel}+${increment}` : `${minutesLabel} min`;
}

const BOT_PATTERN = /(^|[_-])bot([_-]|\d*$)/i;

function isBotOpponent(username: string): boolean {
    return BOT_PATTERN.test(username);
}

function lastNMonths(n: number) {
    const out: { y: number; m: number }[] = [];
    const now = new Date();
    for (let i = 0; i < n; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        out.push({ y: d.getFullYear(), m: d.getMonth() + 1 });
    }
    return out;
}

function SkeletonGrid() {
    return (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
                <div
                    key={i}
                    className="h-[220px] animate-pulse rounded-3xl border border-neutral-200/60 bg-white/40 backdrop-blur-xl dark:border-neutral-700/60 dark:bg-white/5"
                />
            ))}
        </div>
    );
}

export default function GameList() {
    const { user } = useAuth();
    const navigate = useNavigate();

    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [games, setGames] = useState<GameSummary[]>([]);
    const [range, setRange] = useState<{ startDate: string; endDate: string } | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>("");
    const [submittingId, setSubmittingId] = useState<string | null>(null);
    const [filter, setFilter] = useState<"all" | "bots">("all");

    const username = user?.chessUsername;

    const fetchGames = useCallback(async () => {
        if (!username) return;
        setLoading(true);
        setError("");
        try {
            const apiUrl = (import.meta as any).env?.VITE_API_URL || "http://localhost:3000";
            const token = localStorage.getItem("accessToken");
            const res = await fetch(
                `${apiUrl}/player/${encodeURIComponent(username)}/games/last-3-months`,
                { headers: token ? { Authorization: `Bearer ${token}` } : {} }
            );
            if (!res.ok) throw new Error(`Failed to load games (${res.status})`);
            const data = (await res.json()) as RollingGamesResponse;
            setGames(data.games || []);
            setRange({ startDate: data.startDate, endDate: data.endDate });
        } catch (e: any) {
            setError(e.message || "Failed to load games");
        } finally {
            setLoading(false);
        }
    }, [username]);

    useEffect(() => {
        fetchGames();
    }, [fetchGames]);

    const visibleGames = games
        .filter((game) => {
            const date = new Date(game.endTime * 1000);
            return date.getFullYear() === year && date.getMonth() + 1 === month;
        })
        .filter((game) => {
            if (filter !== "bots") return true;
            const isWhite = game.white.username.toLowerCase() === username?.toLowerCase();
            const oppUsername = isWhite ? game.black.username : game.white.username;
            return isBotOpponent(oppUsername);
        });

    const formatDate = (date: string) =>
        new Date(date).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
        });

    const handleAnalyze = async (game: GameSummary) => {
        if (!username) return;
        setSubmittingId(game.gameId);
        try {
            const apiUrl = (import.meta as any).env?.VITE_API_URL || "http://localhost:3000";
            const token = localStorage.getItem("accessToken");
            const res = await fetch(`${apiUrl}/analysis`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    chessUsername: username,
                    game: {
                        gameId: game.gameId,
                        pgn: game.pgn,
                        white: game.white,
                        black: game.black,
                        endTime: game.endTime,
                        timeClass: game.timeClass,
                    },
                }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || `Failed to create analysis (${res.status})`);
            }
            const data = await res.json();
            navigate(`/analysis/${data.analysis._id}`);
        } catch (e: any) {
            setError(e.message || "Failed to create analysis");
        } finally {
            setSubmittingId(null);
        }
    };

    if (!username) {
        return (
            <div className="max-w-2xl mx-auto p-8 text-center space-y-4">
                <h2 className="text-2xl font-bold">Link your Chess.com account first</h2>
                <p className="text-muted-foreground">
                    Visit your profile page to link a Chess.com username, then come back to analyze your games.
                </p>
            </div>
        );
    }

    return (
        <div className="relative min-h-screen w-full overflow-hidden bg-white dark:bg-black">
            {/* Grid pattern background — same as HeroSection's GridBackground */}
            <div
                className={cn(
                    "absolute inset-0 pointer-events-none",
                    "[background-size:40px_40px]",
                    "[background-image:linear-gradient(to_right,#e4e4e7_1px,transparent_1px),linear-gradient(to_bottom,#e4e4e7_1px,transparent_1px)]",
                    "dark:[background-image:linear-gradient(to_right,#262626_1px,transparent_1px),linear-gradient(to_bottom,#262626_1px,transparent_1px)]"
                )}
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)] dark:bg-black" />

            <div className="relative z-20 px-4 py-8">
                <div className="max-w-5xl mx-auto space-y-6">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div>
                            <h1 className="font-serif text-3xl font-bold tracking-tight text-neutral-800 dark:text-neutral-100">
                                Analyze Your Games
                            </h1>
                            <p className="text-sm text-neutral-500 dark:text-neutral-400">
                                Games from @{username}. Pick any game to get a move-by-move Stockfish review.
                            </p>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <button
                                type="button"
                                title="Upload games (coming soon)"
                                onClick={() => {
                                    // TODO: wire up manual PGN/game upload flow
                                }}
                                className="rounded-full border border-neutral-200/70 bg-white/50 p-2 text-neutral-600 shadow-sm backdrop-blur-md transition-colors hover:bg-white/80 dark:border-neutral-700/70 dark:bg-white/5 dark:text-neutral-300 dark:hover:bg-white/10"
                            >
                                <Upload className="h-4 w-4" />
                            </button>
                            <button
                                type="button"
                                title="Refresh games"
                                onClick={() => fetchGames()}
                                disabled={loading}
                                className="rounded-full border border-neutral-200/70 bg-white/50 p-2 text-neutral-600 shadow-sm backdrop-blur-md transition-colors hover:bg-white/80 disabled:opacity-50 dark:border-neutral-700/70 dark:bg-white/5 dark:text-neutral-300 dark:hover:bg-white/10"
                            >
                                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                            </button>
                            <Calendar className="h-4 w-4 text-neutral-400" />
                            <select
                                value={`${year}-${month}`}
                                onChange={(e) => {
                                    const [y, m] = e.target.value.split("-").map(Number);
                                    setYear(y);
                                    setMonth(m);
                                }}
                                className="rounded-full border border-neutral-200/70 bg-white/50 px-3 py-1.5 text-neutral-700 shadow-sm backdrop-blur-md outline-none dark:border-neutral-700/70 dark:bg-white/5 dark:text-neutral-200"
                            >
                                {lastNMonths(4).map(({ y, m }) => (
                                    <option key={`${y}-${m}`} value={`${y}-${m}`}>
                                        {monthLabel(y, m)}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {error && (
                        <div className="rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-600 backdrop-blur-md dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400">
                            {error}
                        </div>
                    )}

                    {loading ? (
                        <SkeletonGrid />
                    ) : visibleGames.length === 0 ? (
                        <div className="rounded-3xl border border-neutral-200/70 bg-white/50 p-8 text-center text-neutral-500 backdrop-blur-xl dark:border-neutral-700/70 dark:bg-white/5 dark:text-neutral-400">
                            {range
                                ? `No games found for ${monthLabel(year, month)}. Showing games from the rolling last 3 months: ${formatDate(range.startDate)} to ${formatDate(range.endDate)}.`
                                : "No games found in the rolling last 3 months."}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setFilter("all")}
                                    className={`rounded-full px-4 py-2 text-sm font-semibold shadow-sm backdrop-blur-md transition-colors ${
                                        filter === "all"
                                            ? "bg-amber-500 text-white"
                                            : "border border-neutral-200/70 bg-white/50 text-neutral-600 hover:bg-white/80 dark:border-neutral-700/70 dark:bg-white/5 dark:text-neutral-300 dark:hover:bg-white/10"
                                    }`}
                                >
                                    All
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFilter("bots")}
                                    className={`rounded-full px-4 py-2 text-sm font-semibold shadow-sm backdrop-blur-md transition-colors ${
                                        filter === "bots"
                                            ? "bg-amber-500 text-white"
                                            : "border border-neutral-200/70 bg-white/50 text-neutral-600 hover:bg-white/80 dark:border-neutral-700/70 dark:bg-white/5 dark:text-neutral-300 dark:hover:bg-white/10"
                                    }`}
                                >
                                    Bots
                                </button>
                            </div>

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {visibleGames.map((g, index) => {
                                    const isWhite = g.white.username.toLowerCase() === username.toLowerCase();
                                    const myResult = resultLabel(isWhite ? g.white.result : g.black.result);

                                    return (
                                        <motion.div
                                            key={g.gameId}
                                            initial={{ opacity: 0, y: 4 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.03 }}
                                        >
                                            <Card
                                                className="relative overflow-hidden rounded-3xl border border-white/60 bg-white/40
                                                           shadow-[0_8px_32px_0_rgba(31,38,135,0.08)] backdrop-blur-xl
                                                           transition-all duration-300 hover:-translate-y-1 hover:bg-white/60
                                                           hover:shadow-[0_12px_40px_0_rgba(31,38,135,0.15)]
                                                           dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                                            >
                                                {/* Glossy top shine */}
                                                <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-3xl bg-gradient-to-b from-white/50 to-transparent dark:from-white/10" />

                                                <CardContent className="relative space-y-4 p-4">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                                                            {g.timeClass === "rapid" ? (
                                                                <Clock className="h-4 w-4" />
                                                            ) : g.timeClass === "daily" ? (
                                                                <PenLine className="h-4 w-4" />
                                                            ) : g.timeClass === "unknown" ? (
                                                                <Mail className="h-4 w-4" />
                                                            ) : (
                                                                <Zap className="h-4 w-4" />
                                                            )}
                                                            <span>{TIME_CLASS_LABEL[g.timeClass] || g.timeClass}</span>
                                                            <span className="truncate">{formatTimeControl(g.timeControl)}</span>
                                                            <span className="hidden text-neutral-400 sm:inline">Chess.com</span>
                                                        </div>
                                                        <span
                                                            className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide backdrop-blur-md ${resultBadgeClasses(
                                                                myResult
                                                            )}`}
                                                        >
                                                            {myResult}
                                                        </span>
                                                    </div>

                                                    <div className="space-y-2 border-y border-neutral-200/60 py-3 dark:border-white/10">
                                                        {[
                                                            { player: isWhite ? g.black : g.white, isCurrentUser: false, isWhite: !isWhite },
                                                            { player: isWhite ? g.white : g.black, isCurrentUser: true, isWhite },
                                                        ].map(({ player, isCurrentUser, isWhite: playerIsWhite }) => (
                                                            <div key={player.username} className="flex items-center gap-3 text-sm">
                                                                <span
                                                                    className={`h-3.5 w-3.5 rounded-sm border border-neutral-300 dark:border-white/30 ${
                                                                        playerIsWhite ? "bg-white" : "bg-neutral-800 dark:bg-black"
                                                                    }`}
                                                                />
                                                                <span
                                                                    className={`min-w-0 flex-1 truncate ${
                                                                        isCurrentUser
                                                                            ? "font-bold text-neutral-800 dark:text-neutral-100"
                                                                            : "text-neutral-500 dark:text-neutral-400"
                                                                    }`}
                                                                >
                                                                    @{player.username}
                                                                </span>
                                                                <span className="text-xs text-neutral-400">{player.rating || "—"}</span>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    <span className="inline-flex max-w-full truncate rounded-full border border-amber-200/60 bg-amber-50/70 px-3 py-1 text-xs capitalize text-amber-700 backdrop-blur-md dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400">
                                                        {openingName(g.pgn)}
                                                    </span>

                                                    <div className="flex items-center justify-between gap-3">
                                                        <div className="text-xs text-neutral-400">
                                                            <span>{moveCount(g.pgn)} moves</span>
                                                            <span className="mx-1.5">·</span>
                                                            <span>{timeAgo(g.endTime)}</span>
                                                        </div>
                                                        <button
                                                            disabled={submittingId === g.gameId}
                                                            onClick={() => handleAnalyze(g)}
                                                            className="flex items-center gap-2 rounded-full bg-neutral-800 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-amber-500 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-amber-400"
                                                        >
                                                            {submittingId === g.gameId ? (
                                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                            ) : (
                                                                <ChevronDown className="h-3 w-3" />
                                                            )}
                                                            Analyze
                                                        </button>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}