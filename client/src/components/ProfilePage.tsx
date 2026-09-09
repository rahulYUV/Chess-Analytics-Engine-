import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, Flame, RefreshCw, Snowflake, Swords, Target, Trophy, TrendingDown, TrendingUp, UserRound } from "lucide-react";
import { Line, LineChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAuth } from "../contexts/AuthContext";
import { GridBackground } from "./ui/grid-background";
import { Navbar } from "./Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

type ResultStats = { wins: number; loss: number; draw: number; total: number };
type ModeStats = { last?: { rating?: number }; best?: { rating?: number }; record?: { win?: number; loss?: number; draw?: number } };
type RatingHistory = { date: string; rating: number }[];
type PuzzleStats = { solved?: number; rushBest?: number; tacticsRating?: number };
type ProfileData = {
    username: string;
    avatar?: string;
    name?: string;
    joined?: number;
    stats?: Record<string, ModeStats>;
    history?: RatingHistory;
    puzzleStats?: PuzzleStats;
};
type OpeningStat = { name: string; wins: number; loss: number; draw: number; total: number; color: "white" | "black" };
type StreakInfo = { type: "win" | "loss" | "none"; count: number; longestWin: number };
type InsightsData = {
    summary?: ResultStats;
    colorStats?: { white: ResultStats; black: ResultStats };
    openings?: OpeningStat[];
    streak?: StreakInfo;
};

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

const modeCards = [
    ["chess_bullet", "Bullet"],
    ["chess_blitz", "Blitz"],
    ["chess_rapid", "Rapid"],
    ["chess_daily", "Daily / Classical"],
    ["puzzles", "Puzzles"],
] as const;

const RANGE_DAYS: Record<string, number | null> = { "30D": 30, "90D": 90, "1Y": 365, All: null };

function percent(value: number, total: number): number {
    return total ? Math.round((value / total) * 100) : 0;
}

function formatDate(timestamp?: number): string {
    return timestamp ? new Date(timestamp * 1000).toLocaleDateString(undefined, { month: "short", year: "numeric" }) : "Unavailable";
}

function Skeleton({ className = "h-24" }: { className?: string }) {
    return <div className={`animate-pulse rounded-2xl bg-neutral-200/70 dark:bg-neutral-800/70 ${className}`} />;
}

function StatCard({ label, value, icon: Icon, tone = "text-emerald-600" }: { label: string; value: string | number; icon: typeof Trophy; tone?: string }) {
    return (
        <Card className="border-neutral-200/70 bg-white/80 shadow-sm dark:border-neutral-800/70 dark:bg-neutral-900/75">
            <CardContent className="flex items-center justify-between p-5">
                <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div>
                <Icon className={`h-5 w-5 ${tone}`} />
            </CardContent>
        </Card>
    );
}

function StreakCard({ streak }: { streak: StreakInfo }) {
    const isWin = streak.type === "win";
    const isLoss = streak.type === "loss";
    return (
        <Card className="border-neutral-200/70 bg-white/80 shadow-sm dark:border-neutral-800/70 dark:bg-neutral-900/75">
            <CardContent className="flex items-center justify-between p-5">
                <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current streak</p>
                    <p className={`mt-1 text-2xl font-bold ${isWin ? "text-emerald-600" : isLoss ? "text-rose-600" : ""}`}>
                        {streak.type === "none" ? "—" : `${streak.count} ${isWin ? "wins" : "losses"}`}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">Longest win streak: {streak.longestWin}</p>
                </div>
                {isWin ? <Flame className="h-6 w-6 text-orange-500" /> : <Snowflake className="h-6 w-6 text-sky-500" />}
            </CardContent>
        </Card>
    );
}

function ResultDonut({ summary }: { summary: ResultStats }) {
    const [active, setActive] = useState<"win" | "draw" | "loss" | null>(null);
    const win = percent(summary.wins, summary.total);
    const draw = percent(summary.draw, summary.total);
    const loss = Math.max(0, 100 - win - draw);

    const radius = 52;
    const circumference = 2 * Math.PI * radius;
    const winLen = (win / 100) * circumference;
    const drawLen = (draw / 100) * circumference;
    const lossLen = (loss / 100) * circumference;

    const segments = [
        { key: "win" as const, color: "#16a34a", len: winLen, offset: 0, value: summary.wins, pct: win },
        { key: "draw" as const, color: "#a3a3a3", len: drawLen, offset: winLen, value: summary.draw, pct: draw },
        { key: "loss" as const, color: "#e11d48", len: lossLen, offset: winLen + drawLen, value: summary.loss, pct: loss },
    ];

    const centerLabel = active ? segments.find((s) => s.key === active) : segments[0];

    return (
        <div className="flex items-center gap-5">
            <div className="relative h-32 w-32 shrink-0">
                <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                    <circle cx="60" cy="60" r={radius} fill="none" stroke="currentColor" className="text-neutral-100 dark:text-neutral-800" strokeWidth="12" />
                    {segments.map((segment) =>
                        segment.len > 0 ? (
                            <circle
                                key={segment.key}
                                cx="60"
                                cy="60"
                                r={radius}
                                fill="none"
                                stroke={segment.color}
                                strokeWidth={active === segment.key ? "14" : "12"}
                                strokeDasharray={`${segment.len} ${circumference - segment.len}`}
                                strokeDashoffset={-segment.offset}
                                strokeLinecap="butt"
                                onMouseEnter={() => setActive(segment.key)}
                                onMouseLeave={() => setActive(null)}
                                className="cursor-pointer transition-[stroke-width] duration-150"
                                style={{ transformOrigin: "60px 60px" }}
                            />
                        ) : null
                    )}
                </svg>
                <div className="absolute inset-4 flex flex-col items-center justify-center rounded-full bg-white dark:bg-neutral-900">
                    <strong className="text-2xl">{centerLabel?.pct ?? 0}%</strong>
                    <span className="text-[10px] capitalize text-muted-foreground">{active ?? "wins"}</span>
                </div>
            </div>
            <div className="space-y-2 text-sm">
                <p onMouseEnter={() => setActive("win")} onMouseLeave={() => setActive(null)} className="cursor-pointer"><span className="mr-2 inline-block h-2 w-2 rounded-full bg-green-600" />Win {summary.wins}</p>
                <p onMouseEnter={() => setActive("draw")} onMouseLeave={() => setActive(null)} className="cursor-pointer"><span className="mr-2 inline-block h-2 w-2 rounded-full bg-neutral-400" />Draw {summary.draw}</p>
                <p onMouseEnter={() => setActive("loss")} onMouseLeave={() => setActive(null)} className="cursor-pointer"><span className="mr-2 inline-block h-2 w-2 rounded-full bg-rose-600" />Loss {summary.loss}</p>
            </div>
        </div>
    );
}

function computeStreak(history: RatingHistory): StreakInfo {
    if (!history.length) return { type: "none", count: 0, longestWin: 0 };
    let longestWin = 0;
    let runningWin = 0;
    for (let i = 1; i < history.length; i++) {
        const delta = history[i].rating - history[i - 1].rating;
        if (delta > 0) { runningWin++; longestWin = Math.max(longestWin, runningWin); } else { runningWin = 0; }
    }
    let type: "win" | "loss" | "none" = "none";
    let current = 0;
    for (let i = history.length - 1; i > 0; i--) {
        const delta = history[i].rating - history[i - 1].rating;
        const step: "win" | "loss" = delta >= 0 ? "win" : "loss";
        if (type === "none") { type = step; current = 1; }
        else if (step === type) current++;
        else break;
    }
    return { type, count: current, longestWin };
}

function findPeakAndDip(history: RatingHistory) {
    if (!history.length) return null;
    let peak = history[0];
    let dip = history[0];
    for (const point of history) {
        if (point.rating > peak.rating) peak = point;
        if (point.rating < dip.rating) dip = point;
    }
    return { peak, dip };
}

function filterByRange(history: RatingHistory, range: string) {
    const days = RANGE_DAYS[range];
    if (days == null) return history;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return history.filter((point) => new Date(point.date).getTime() >= cutoff);
}

export const ProfilePage = () => {
    const { user, accessToken, isLoading: authLoading, updateProfile } = useAuth();
    const [chessUsername, setChessUsername] = useState(user?.chessUsername || "");
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [insights, setInsights] = useState<InsightsData | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [range, setRange] = useState("All");

    const loadProfile = useCallback(async () => {
        if (!user?.chessUsername) return;
        setLoading(true); setError("");
        try {
            const headers: HeadersInit = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
            const encoded = encodeURIComponent(user.chessUsername);
            const [profileResponse, insightsResponse] = await Promise.all([
                fetch(`${API_URL}/player/${encoded}/full`, { headers }),
                fetch(`${API_URL}/player/${encoded}/insights`, { headers }),
            ]);
            if (!profileResponse.ok) {
                const body = await profileResponse.json().catch(() => null) as { error?: string } | null;
                throw new Error(body?.error || `Profile stats request failed (${profileResponse.status}).`);
            }
            setProfile(await profileResponse.json() as ProfileData);
            if (insightsResponse.ok) {
                setInsights(await insightsResponse.json() as InsightsData);
            } else {
                setInsights(null);
                setError(`Game insights are temporarily unavailable (${insightsResponse.status}).`);
            }
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : "Chess.com stats could not be loaded.");
        } finally { setLoading(false); }
    }, [accessToken, user?.chessUsername]);

    useEffect(() => { void loadProfile(); }, [loadProfile]);

    const connectAccount = async () => {
        const trimmed = chessUsername.trim();
        if (!trimmed) return;
        setSaving(true); setError("");
        try { await updateProfile({ chessUsername: trimmed }); }
        catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Could not connect Chess.com account."); }
        finally { setSaving(false); }
    };

    const displayName = user?.name || user?.email?.split("@")[0] || "Chess player";
    const summary = insights?.summary || { wins: 0, loss: 0, draw: 0, total: 0 };
    const colorStats = insights?.colorStats || { white: { wins: 0, loss: 0, draw: 0, total: 0 }, black: { wins: 0, loss: 0, draw: 0, total: 0 } };

    const fullHistory = profile?.history || [];
    const history = useMemo(() => filterByRange(fullHistory, range), [fullHistory, range]);
    const streak = insights?.streak || computeStreak(fullHistory);
    const peakDip = useMemo(() => findPeakAndDip(history), [history]);
    const puzzleStats = profile?.puzzleStats;

    return (
        <GridBackground>
            <Navbar />
            <main className="mx-auto min-h-screen max-w-7xl space-y-6 px-4 pb-12 pt-24 sm:px-6 lg:px-8">
                {authLoading ? <div className="space-y-6"><Skeleton className="h-40" /><Skeleton className="h-96" /></div> : !user ? (
                    <Card className="mx-auto max-w-xl border-neutral-200/70 bg-white/80 text-center shadow-sm dark:border-neutral-800/70 dark:bg-neutral-900/75">
                        <CardContent className="space-y-3 p-8">
                            <h1 className="text-2xl font-bold">Sign in to view your profile</h1>
                            <p className="text-sm text-muted-foreground">Your profile and Chess.com analytics are available after signing in.</p>
                        </CardContent>
                    </Card>
                ) : !user.chessUsername ? (
                    <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                        <Card className="overflow-hidden border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-amber-50 dark:border-emerald-900 dark:from-emerald-950/50 dark:via-neutral-950 dark:to-amber-950/30">
                            <CardContent className="p-8 sm:p-12">
                                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#7b8f52] text-2xl font-bold text-white">♞</div>
                                <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Your chess profile</p>
                                <h1 className="max-w-xl text-3xl font-bold tracking-tight sm:text-5xl">Connect your Chess.com account to unlock deep performance analytics</h1>
                                <p className="mt-4 max-w-lg text-muted-foreground">Bring your games, ratings, openings, and results into one focused dashboard.</p>
                                <div className="mt-8 flex max-w-lg flex-col gap-3 sm:flex-row">
                                    <input value={chessUsername} onChange={(event) => setChessUsername(event.target.value)} placeholder="Chess.com username" className="h-11 flex-1 rounded-xl border border-neutral-200 bg-white px-4 outline-none ring-emerald-500 focus:ring-2 dark:border-neutral-700 dark:bg-neutral-900" />
                                    <button onClick={() => void connectAccount()} disabled={saving || !chessUsername.trim()} className="h-11 rounded-xl bg-[#5f713d] px-5 font-semibold text-white transition hover:bg-[#4e6031] disabled:opacity-50">{saving ? "Connecting..." : "Connect Chess.com"}</button>
                                </div>
                                {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
                            </CardContent>
                        </Card>
                        <div className="grid grid-cols-2 gap-4">
                            {["Ratings", "Phase Accuracy", "Eval Trends", "Win / Loss"].map((label) => (
                                <Card key={label} className="border-neutral-200/70 bg-white/70 p-4 dark:border-neutral-800 dark:bg-neutral-900/70">
                                    <Skeleton className="h-24" /><p className="mt-3 text-sm font-medium text-muted-foreground">{label}</p>
                                </Card>
                            ))}
                        </div>
                    </section>
                ) : loading && !profile ? (
                    <div className="space-y-6"><Skeleton className="h-40" /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{modeCards.map(([key]) => <Skeleton key={key} />)}</div><Skeleton className="h-72" /></div>
                ) : (
                    <>
                        <section className="flex flex-col justify-between gap-5 rounded-3xl border border-neutral-200/70 bg-white/80 p-6 shadow-sm dark:border-neutral-800/70 dark:bg-neutral-900/75 sm:flex-row sm:items-center">
                            <div className="flex items-center gap-4">
                                <img src={user.avatar || profile?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=7b8f52&color=fff`} alt={displayName} className="h-20 w-20 rounded-2xl object-cover" />
                                <div>
                                    <h1 className="text-2xl font-bold">{displayName}</h1>
                                    <p className="text-sm text-muted-foreground">@{user.email?.split("@")[0]} · Chess.com <a className="text-emerald-700 hover:underline" href={`https://www.chess.com/member/${user.chessUsername}`} target="_blank" rel="noreferrer">@{user.chessUsername} <ExternalLink className="inline h-3 w-3" /></a></p>
                                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                        <span className="rounded-full bg-neutral-100 px-3 py-1 dark:bg-neutral-800">Member since {formatDate(profile?.joined)}</span>
                                        <span className="rounded-full bg-neutral-100 px-3 py-1 dark:bg-neutral-800">{summary.total} games analyzed</span>
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => void loadProfile()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-200 px-4 py-2 text-sm font-semibold transition hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800">
                                <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />Sync stats
                            </button>
                        </section>

                        {error && <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

                        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                            {modeCards.map(([key, label]) => {
                                const mode = profile?.stats?.[key];
                                const rating = mode?.last?.rating ?? "—";
                                const peak = mode?.best?.rating ?? "—";
                                const trend = typeof rating === "number" && typeof peak === "number" ? rating - peak : 0;
                                return (
                                    <Card key={key} className="border-neutral-200/70 bg-white/80 shadow-sm dark:border-neutral-800/70 dark:bg-neutral-900/75">
                                        <CardContent className="p-5">
                                            <p className="text-sm text-muted-foreground">{label}</p>
                                            <div className="mt-2 flex items-end justify-between">
                                                <strong className="text-3xl">{rating}</strong>
                                                {trend >= 0 ? <TrendingUp className="h-5 w-5 text-emerald-600" /> : <TrendingDown className="h-5 w-5 text-rose-600" />}
                                            </div>
                                            <p className="mt-2 text-xs text-muted-foreground">Peak {peak}</p>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </section>

                        <section className="grid gap-6 lg:grid-cols-3">
                            <Card className="border-neutral-200/70 bg-white/80 dark:border-neutral-800/70 dark:bg-neutral-900/75">
                                <CardHeader><CardTitle className="text-lg">Results breakdown</CardTitle></CardHeader>
                                <CardContent><ResultDonut summary={summary} /></CardContent>
                            </Card>
                            <Card className="border-neutral-200/70 bg-white/80 dark:border-neutral-800/70 dark:bg-neutral-900/75">
                                <CardHeader><CardTitle className="text-lg">Color performance</CardTitle></CardHeader>
                                <CardContent className="space-y-5">
                                    <div>
                                        <div className="mb-1 flex justify-between text-sm"><span>White</span><strong>{percent(colorStats.white.wins, colorStats.white.total)}%</strong></div>
                                        <div className="h-2 rounded-full bg-neutral-200 dark:bg-neutral-700"><div className="h-2 rounded-full bg-neutral-800" style={{ width: `${percent(colorStats.white.wins, colorStats.white.total)}%` }} /></div>
                                    </div>
                                    <div>
                                        <div className="mb-1 flex justify-between text-sm"><span>Black</span><strong>{percent(colorStats.black.wins, colorStats.black.total)}%</strong></div>
                                        <div className="h-2 rounded-full bg-neutral-200 dark:bg-neutral-700"><div className="h-2 rounded-full bg-emerald-600" style={{ width: `${percent(colorStats.black.wins, colorStats.black.total)}%` }} /></div>
                                    </div>
                                </CardContent>
                            </Card>
                            <StreakCard streak={streak} />
                        </section>

                        <section className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
                            <Card className="border-neutral-200/70 bg-white/80 dark:border-neutral-800/70 dark:bg-neutral-900/75">
                                <CardHeader className="flex-row items-center justify-between">
                                    <CardTitle className="text-lg">Rating history</CardTitle>
                                    <div className="flex gap-1">
                                        {["30D", "90D", "1Y", "All"].map((item) => (
                                            <button key={item} onClick={() => setRange(item)} className={`rounded-full px-2.5 py-1 text-xs ${range === item ? "bg-emerald-700 text-white" : "bg-neutral-100 text-muted-foreground dark:bg-neutral-800"}`}>{item}</button>
                                        ))}
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="h-64">
                                        {history.length ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={history}>
                                                    <XAxis dataKey="date" hide />
                                                    <YAxis domain={["dataMin - 50", "dataMax + 50"]} width={35} tick={{ fontSize: 11 }} />
                                                    <Tooltip />
                                                    <Line type="monotone" dataKey="rating" stroke="#16805a" strokeWidth={3} dot={false} />
                                                    {peakDip && (
                                                        <>
                                                            <ReferenceDot x={peakDip.peak.date} y={peakDip.peak.rating} r={5} fill="#16a34a" stroke="white" strokeWidth={2} label={{ value: `Peak ${peakDip.peak.rating}`, position: "top", fontSize: 11 }} />
                                                            <ReferenceDot x={peakDip.dip.date} y={peakDip.dip.rating} r={5} fill="#e11d48" stroke="white" strokeWidth={2} label={{ value: `Low ${peakDip.dip.rating}`, position: "bottom", fontSize: 11 }} />
                                                        </>
                                                    )}
                                                </LineChart>
                                            </ResponsiveContainer>
                                        ) : <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No rating history available.</div>}
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="border-neutral-200/70 bg-white/80 dark:border-neutral-800/70 dark:bg-neutral-900/75">
                                <CardHeader><CardTitle className="text-lg">Opening repertoire</CardTitle></CardHeader>
                                <CardContent className="space-y-3">
                                    {(insights?.openings || []).slice(0, 3).map((opening) => (
                                        <div key={`${opening.name}-${opening.color}`} className="flex items-center justify-between gap-3">
                                            <div className="min-w-0"><p className="truncate text-sm font-semibold">{opening.name}</p><p className="text-xs text-muted-foreground">{opening.total} games · {opening.color}</p></div>
                                            <span className="text-sm font-bold text-emerald-700">{percent(opening.wins, opening.total)}%</span>
                                        </div>
                                    ))}
                                    {!insights?.openings?.length && <p className="text-sm text-muted-foreground">No opening data yet.</p>}
                                </CardContent>
                            </Card>
                        </section>

                        <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                            <StatCard label="Puzzles solved" value={puzzleStats?.solved ?? "—"} icon={Target} tone="text-amber-600" />
                            <StatCard label="Puzzle rush best" value={puzzleStats?.rushBest ?? "—"} icon={Trophy} tone="text-amber-600" />
                            <StatCard label="Analyzed games" value={summary.total} icon={Swords} />
                            <StatCard label="Win rate" value={`${percent(summary.wins, summary.total)}%`} icon={UserRound} />
                        </section>
                    </>
                )}
            </main>
        </GridBackground>
    );
};