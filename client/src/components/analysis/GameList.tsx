/**
 * GameList — month-grouped list of a Chess.com player's recent games
 * with an "Analyze" button per row that creates an analysis record and
 * navigates to /analysis/:id.
 *
 * Backend: GET /player/:username/games/last-3-months
 *          POST /analysis { chessUsername, game }
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { Calendar, ChevronDown, Loader2, Swords } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";

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

const resultColor = (result: string, isWhite: boolean): string => {
    const won = result === "win";
    const lost = ["checkmated", "resigned", "timeout", "abandoned", "lose"].includes(result);
    if (won) return "text-green-500";
    if (lost) return "text-red-500";
    return "text-yellow-500";
};

const resultLabel = (result: string): string => {
    if (result === "win") return "Win";
    if (["checkmated", "resigned", "timeout", "abandoned", "lose"].includes(result)) return "Loss";
    return "Draw";
};

const monthLabel = (year: number, month: number) => {
    return new Date(year, month - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
};

export default function GameList() {
    const { user } = useAuth();
    const navigate = useNavigate();

    // Default to current year/month
    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [games, setGames] = useState<GameSummary[]>([]);
    const [range, setRange] = useState<{ startDate: string; endDate: string } | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>("");
    const [submittingId, setSubmittingId] = useState<string | null>(null);

    const username = user?.chessUsername;

    useEffect(() => {
        if (!username) return;
        let cancelled = false;
        const load = async () => {
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
                const data = await res.json() as RollingGamesResponse;
                if (!cancelled) {
                    setGames(data.games || []);
                    setRange({ startDate: data.startDate, endDate: data.endDate });
                }
            } catch (e: any) {
                if (!cancelled) setError(e.message || "Failed to load games");
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [username]);

    const visibleGames = games.filter((game) => {
        const date = new Date(game.endTime * 1000);
        return date.getFullYear() === year && date.getMonth() + 1 === month;
    });

    const formatDate = (date: string) => new Date(date).toLocaleDateString("en-US", {
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
        <div className="max-w-5xl mx-auto p-4 space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-3xl font-bold">Analyze your games</h1>
                    <p className="text-sm text-muted-foreground">
                        Games from @{username}. Pick any game to get a move-by-move Stockfish review.
                    </p>
                </div>
                <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <select
                        value={`${year}-${month}`}
                        onChange={(e) => {
                            const [y, m] = e.target.value.split("-").map(Number);
                            setYear(y);
                            setMonth(m);
                        }}
                        className="bg-neutral-100 dark:bg-neutral-800 rounded-md px-2 py-1"
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
                <div className="text-red-500 text-sm bg-red-500/10 px-4 py-2 rounded-lg border border-red-500/20">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center p-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            ) : visibleGames.length === 0 ? (
                <Card>
                    <CardContent className="p-8 text-center text-muted-foreground">
                        {range
                            ? `No games found for ${monthLabel(year, month)}. Showing games from the rolling last 3 months: ${formatDate(range.startDate)} to ${formatDate(range.endDate)}.`
                            : "No games found in the rolling last 3 months."}
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-2">
                    {visibleGames.map((g) => {
                        const isWhite = g.white.username.toLowerCase() === username.toLowerCase();
                        const myResult = isWhite ? g.white.result : g.black.result;
                        const oppUsername = isWhite ? g.black.username : g.white.username;
                        const oppRating = isWhite ? g.black.rating : g.white.rating;
                        const myRating = isWhite ? g.white.rating : g.black.rating;
                        return (
                            <motion.div
                                key={g.gameId}
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                            >
                                <Card>
                                    <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                            <Swords className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-semibold">
                                                        vs @{oppUsername}
                                                    </span>
                                                    {oppRating && (
                                                        <span className="text-xs text-muted-foreground">
                                                            ({oppRating})
                                                        </span>
                                                    )}
                                                    <span className={`text-xs font-medium ${resultColor(myResult, isWhite)}`}>
                                                        {resultLabel(myResult)}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                                                    <span>{TIME_CLASS_LABEL[g.timeClass] || g.timeClass}</span>
                                                    <span>·</span>
                                                    <span>{g.rated ? "Rated" : "Casual"}</span>
                                                    {myRating && (
                                                        <>
                                                            <span>·</span>
                                                            <span>You: {myRating}</span>
                                                        </>
                                                    )}
                                                    <span>·</span>
                                                    <span>{new Date(g.endTime * 1000).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            disabled={submittingId === g.gameId}
                                            onClick={() => handleAnalyze(g)}
                                            className="px-4 py-2 rounded-full bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-800 transition-colors disabled:opacity-50 flex items-center gap-2"
                                        >
                                            {submittingId === g.gameId ? (
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                            ) : (
                                                <ChevronDown className="h-3 w-3" />
                                            )}
                                            Analyze
                                        </button>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        );
                    })}
                </div>
            )}
        </div>
    );
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
