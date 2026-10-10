import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Crown } from "lucide-react";

interface IntroAnimationProps {
    onComplete: () => void;
}

/* ------------------------------------------------------------------ */
/* Timeline (seconds). Tweak these to speed up / slow down the intro.  */
/* ------------------------------------------------------------------ */
const T = {
    panel: 0,         // card + eval bar slide in
    drawStart: 0.35,  // graph line starts drawing, eval bar starts swinging
    drawDur: 0.95,    // how long the draw takes
    land: 1.3,        // crown lands on the peak
    word: 1.4,        // wordmark begins
    split: 2.35,      // the screen cuts diagonally and the halves slide apart
    splitDur: 0.6,    // how long the halves take to leave
    total: 3.0,       // when onComplete fires (after the halves are gone)
};

const EASE = [0.22, 1, 0.36, 1] as const;

/* --------------------------- Graph geometry ------------------------- */

// Rating history, in a 360 x 200 box (smaller y = higher rating).
// Dips below the midline first (eval bar swings to black), then climbs to a peak.
const W = 360;
const H = 200;
const P: [number, number][] = [
    [8, 100],
    [40, 112],
    [62, 92],
    [95, 128],
    [125, 118],
    [150, 138],
    [180, 110],
    [205, 122],
    [235, 84],
    [262, 96],
    [292, 56],
    [318, 68],
    [344, 36],
];
const PEAK = P[P.length - 1];
const SEG = P.slice(1).map((p, i) => Math.hypot(p[0] - P[i][0], p[1] - P[i][1]));
const TOTAL = SEG.reduce((a, b) => a + b, 0);

// Returns the polyline points drawn so far for progress t (0..1).
function trace(t: number): [number, number][] {
    const target = t * TOTAL;
    const pts: [number, number][] = [P[0]];
    let acc = 0;
    for (let i = 0; i < SEG.length; i++) {
        if (acc + SEG[i] <= target + 1e-6) {
            pts.push(P[i + 1]);
            acc += SEG[i];
        } else {
            const f = (target - acc) / SEG[i];
            pts.push([
                P[i][0] + (P[i + 1][0] - P[i][0]) * f,
                P[i][1] + (P[i + 1][1] - P[i][1]) * f,
            ]);
            break;
        }
    }
    return pts;
}

const toPath = (pts: [number, number][]) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");

/* ------------------------- Progress hook (rAF) ---------------------- */

const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

function useDraw(start: number, duration: number, reduced: boolean) {
    const [t, setT] = useState(reduced ? 1 : 0);

    useEffect(() => {
        if (reduced) {
            setT(1);
            return;
        }
        const begin = performance.now() + start * 1000;
        let raf = 0;
        const tick = (now: number) => {
            const r = Math.min(1, Math.max(0, (now - begin) / (duration * 1000)));
            setT(easeInOut(r));
            if (r < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [start, duration, reduced]);

    return t;
}

/* ------------------------- Corner checkerboards --------------------- */

// Squares fade in starting from the screen corner and spread inward.
function CornerBoard({ fromBottomRight = false }: { fromBottomRight?: boolean }) {
    const squares = Array.from({ length: 36 }, (_, i) => {
        const row = Math.floor(i / 6);
        const col = i % 6;
        const dist = fromBottomRight ? 5 - row + (5 - col) : row + col;
        return { dark: (row + col) % 2 === 0, dist };
    });

    return (
        <div className="grid h-28 w-28 grid-cols-6 grid-rows-6 sm:h-36 sm:w-36">
            {squares.map(({ dark, dist }, i) => (
                <motion.div
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.15 + dist * 0.05, duration: 0.3 }}
                    className={dark ? "bg-green-600/[0.10]" : "bg-transparent"}
                />
            ))}
        </div>
    );
}

/* ---------------------------- Wordmark ----------------------------- */

const wordContainer = {
    hidden: {},
    show: { transition: { staggerChildren: 0.045, delayChildren: T.word } },
    exit: { transition: { staggerChildren: 0.02, staggerDirection: -1 } },
};

// Letters rise out of a clipped line — feels like a mask reveal, not a fade.
const letter = {
    hidden: { y: "110%" },
    show: { y: "0%", transition: { duration: 0.55, ease: EASE } },
    exit: { y: "-110%", transition: { duration: 0.25, ease: "easeIn" as const } },
};

function Word({ text, className }: { text: string; className?: string }) {
    return (
        <span className="inline-flex overflow-hidden pb-1">
            {text.split("").map((c, i) => (
                <motion.span key={i} variants={letter} className={className}>
                    {c}
                </motion.span>
            ))}
        </span>
    );
}

/* ------------------------- Eval bar + graph card -------------------- */

function StatsCard({ t, reduced, uid }: { t: number; reduced: boolean; uid: string }) {
    const pts = trace(t);
    const tip = pts[pts.length - 1];

    const line = toPath(pts);
    const area = `${line} L${tip[0].toFixed(1)},${H} L${P[0][0]},${H} Z`;

    // Eval bar follows the height of the line: middle = equal, top = winning
    const fill = Math.min(100, Math.max(0, (100 * (H - tip[1])) / H));
    const e = ((fill - 50) / 50) * 6;
    const sign = e >= 0.05 ? "+" : e <= -0.05 ? "\u2212" : "";
    const evalText = `${sign}${Math.abs(e).toFixed(1)}`;

    const peakLeft = `${(PEAK[0] / W) * 100}%`;
    const peakTop = `${(PEAK[1] / H) * 100}%`;
    const particles = Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2);
    const gradId = `chessstat-area-${uid}`;

    return (
        <div className="relative">
            {/* Glow that blooms when the crown lands */}
            {!reduced && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: T.land, duration: 0.9, ease: EASE }}
                    className="pointer-events-none absolute -inset-8 rounded-full bg-green-400/25 blur-3xl"
                />
            )}

            <motion.div
                initial={reduced ? false : { opacity: 0, y: 24, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: T.panel, duration: 0.6, ease: EASE }}
                className="relative flex w-[min(88vw,420px)] items-stretch gap-3 rounded-2xl bg-white/90 p-4 ring-1 ring-black/5 shadow-[0_10px_40px_-12px_rgba(22,163,74,0.25)]"
            >
                {/* Eval bar */}
                <div className="flex w-10 flex-col items-center">
                    <div className="relative w-5 flex-1 overflow-hidden rounded-md bg-neutral-800">
                        <div
                            className="absolute inset-x-0 bottom-0 bg-green-400"
                            style={{ height: `${fill}%` }}
                        />
                        <div className="absolute inset-x-0 top-1/2 h-px bg-white/50" />
                    </div>
                    <span className="mt-2 h-4 font-mono text-[11px] tabular-nums text-black/70">
                        {evalText}
                    </span>
                </div>

                {/* Rating graph */}
                <div className="relative flex-1" style={{ aspectRatio: "9 / 5" }}>
                    <svg
                        viewBox={`0 0 ${W} ${H}`}
                        className="absolute inset-0 h-full w-full overflow-visible"
                        aria-hidden="true"
                    >
                        <defs>
                            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#22c55e" stopOpacity="0.28" />
                                <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
                            </linearGradient>
                        </defs>

                        {[50, 100, 150].map((y) => (
                            <line
                                key={y}
                                x1={0}
                                x2={W}
                                y1={y}
                                y2={y}
                                stroke={y === 100 ? "#d4d4d4" : "#ececec"}
                                strokeWidth={1}
                                strokeDasharray="4 5"
                            />
                        ))}

                        <path d={area} fill={`url(#${gradId})`} />
                        <path
                            d={line}
                            fill="none"
                            stroke="#16a34a"
                            strokeWidth={3}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                        <circle cx={tip[0]} cy={tip[1]} r={4.5} fill="#16a34a" stroke="#fff" strokeWidth={2} />
                    </svg>

                    {/* Landing burst at the peak */}
                    {!reduced && (
                        <>
                            <motion.div
                                initial={{ opacity: 0, scale: 0.4 }}
                                animate={{ opacity: [0, 0.8, 0], scale: [0.4, 2.4, 3.2] }}
                                transition={{ delay: T.land, duration: 0.7, ease: "easeOut" }}
                                className="pointer-events-none absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-green-500"
                                style={{ left: peakLeft, top: peakTop }}
                            />
                            <div
                                className="pointer-events-none absolute"
                                style={{ left: peakLeft, top: peakTop }}
                            >
                                {particles.map((a, i) => (
                                    <motion.span
                                        key={i}
                                        initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                                        animate={{
                                            x: Math.cos(a) * 38,
                                            y: Math.sin(a) * 38,
                                            opacity: 0,
                                            scale: 0.3,
                                        }}
                                        transition={{ delay: T.land, duration: 0.65, ease: "easeOut" }}
                                        className="absolute -ml-[3px] -mt-[3px] h-1.5 w-1.5 rounded-full bg-green-500"
                                    />
                                ))}
                            </div>
                        </>
                    )}

                    {/* Crown drops onto the peak */}
                    <div
                        className="absolute z-10 -translate-x-1/2 -translate-y-[115%]"
                        style={{ left: peakLeft, top: peakTop }}
                    >
                        <motion.div
                            initial={reduced ? false : { y: -44, opacity: 0, scale: 0.5, rotate: -25 }}
                            animate={{ y: 0, opacity: 1, scale: 1, rotate: 0 }}
                            transition={
                                reduced
                                    ? { duration: 0 }
                                    : { delay: T.land, type: "spring", stiffness: 320, damping: 14 }
                            }
                        >
                            <Crown
                                className="h-7 w-7 fill-green-500/20 text-green-600 drop-shadow-sm"
                                strokeWidth={1.75}
                            />
                        </motion.div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

/* ---------------------------- Rating line --------------------------- */

function RatingLine({ t, base, reduced }: { t: number; base: number; reduced: boolean }) {
    const tip = trace(t);
    const y = tip[tip.length - 1][1];
    const fill = Math.min(100, Math.max(0, (100 * (H - y)) / H));

    const startRating = Math.round(base + 50 * 10);
    const rating = Math.round(base + fill * 10);
    const gain = Math.round(base + ((100 * (H - PEAK[1])) / H) * 10) - startRating;

    return (
        <motion.div
            initial={reduced ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: T.drawStart, duration: 0.35, ease: EASE }}
            className="flex items-baseline gap-2 font-mono text-sm tabular-nums text-black/50"
        >
            <span>Rating</span>
            <span className="inline-block min-w-[3ch] text-black/80">{rating}</span>
            <motion.span
                initial={reduced ? false : { opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: T.land + 0.1, duration: 0.25 }}
                className="text-green-600"
            >
                +{gain}
            </motion.span>
        </motion.div>
    );
}

/* ------------------------------ Scene ------------------------------- */

// The whole intro screen. It is rendered twice (one copy per half of the
// diagonal cut) so both halves always show exactly the same frame.
function Scene({
    t,
    base,
    reduced,
    uid,
}: {
    t: number;
    base: number;
    reduced: boolean;
    uid: string;
}) {
    return (
        <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden bg-white text-black">
            {/* Faint grid that matches the site background */}
            <div
                className="pointer-events-none absolute inset-0 opacity-40"
                style={{
                    backgroundSize: "40px 40px",
                    backgroundImage:
                        "linear-gradient(to right, #f0f0f0 1px, transparent 1px), linear-gradient(to bottom, #f0f0f0 1px, transparent 1px)",
                    maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
                    WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
                }}
            />

            {/* Checkerboard corners: top-left and bottom-right */}
            {!reduced && (
                <>
                    <motion.div
                        initial={{ opacity: 0, x: -60, y: -60 }}
                        animate={{ opacity: 1, x: 0, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.1, ease: EASE }}
                        className="pointer-events-none absolute left-0 top-0"
                    >
                        <CornerBoard />
                    </motion.div>
                    <motion.div
                        initial={{ opacity: 0, x: 60, y: 60 }}
                        animate={{ opacity: 1, x: 0, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.1, ease: EASE }}
                        className="pointer-events-none absolute bottom-0 right-0"
                    >
                        <CornerBoard fromBottomRight />
                    </motion.div>
                </>
            )}

            <div className="relative flex flex-col items-center gap-8">
                <StatsCard t={t} reduced={reduced} uid={uid} />

                <motion.div
                    variants={wordContainer}
                    initial="hidden"
                    animate="show"
                    exit="exit"
                    className="flex flex-col items-center gap-3"
                >
                    <div className="flex items-center text-4xl font-bold tracking-tight md:text-5xl">
                        <Word text="Chess" className="text-black" />
                        <Word text="Stat" className="text-green-600" />
                    </div>

                    <motion.div
                        initial={{ scaleX: 0, opacity: 0 }}
                        animate={{ scaleX: 1, opacity: 1 }}
                        transition={{ delay: T.word + 0.35, duration: 0.5, ease: EASE }}
                        className="h-[2px] w-40 origin-center bg-gradient-to-r from-transparent via-green-500 to-transparent"
                    />

                    <RatingLine t={t} base={base} reduced={reduced} />
                </motion.div>
            </div>
        </div>
    );
}

/* ------------------------- Diagonal cut halves ---------------------- */

// Cut runs from the bottom-left corner to the top-right corner.
const HALVES = [
    { clip: "polygon(0 0, 100% 0, 0 100%)", dir: -1 },      // upper-left half
    { clip: "polygon(100% 0, 100% 100%, 0 100%)", dir: 1 }, // lower-right half
];

/* ----------------------------- Main -------------------------------- */

export function IntroAnimation({ onComplete }: IntroAnimationProps) {
    const reduced = !!useReducedMotion();
    const t = useDraw(T.drawStart, T.drawDur, reduced);

    // Random starting rating so every load feels a little different
    const [base] = useState(() => 800 + Math.floor(Math.random() * 400));

    // Keep the latest callback without restarting the timer if the parent
    // passes an inline function, and make sure it only ever fires once.
    const cbRef = useRef(onComplete);
    cbRef.current = onComplete;
    const doneRef = useRef(false);

    const finish = () => {
        if (doneRef.current) return;
        doneRef.current = true;
        cbRef.current();
    };

    useEffect(() => {
        const id = setTimeout(finish, reduced ? 400 : T.total * 1000);

        // Let people skip the intro with Escape / Enter / Space
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape" || e.key === "Enter" || e.key === " ") finish();
        };
        window.addEventListener("keydown", onKey);

        return () => {
            clearTimeout(id);
            window.removeEventListener("keydown", onKey);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reduced]);

    return (
        <motion.div
            role="status"
            aria-label="Loading ChessStat"
            onClick={finish}
            className="fixed inset-0 z-[100] cursor-pointer overflow-hidden"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
        >
            {reduced ? (
                // Reduced motion: single static scene, no slicing
                <Scene t={t} base={base} reduced uid="a" />
            ) : (
                <>
                    {/* Solid backing so no hairline seam shows along the cut
                        before the halves start moving */}
                    <motion.div
                        className="absolute inset-0 bg-white"
                        initial={{ opacity: 1 }}
                        animate={{ opacity: 0 }}
                        transition={{ delay: T.split, duration: 0.01 }}
                    />

                    {/* The two halves of the screen, sliding apart along the cut */}
                    {HALVES.map(({ clip, dir }, i) => (
                        <motion.div
                            key={i}
                            aria-hidden={i === 1}
                            className="absolute inset-0 will-change-transform"
                            style={{ clipPath: clip, WebkitClipPath: clip }}
                            initial={{ x: "0vw", y: "0vh", opacity: 1 }}
                            animate={{ x: `${dir * 55}vw`, y: `${dir * 55}vh`, opacity: 0 }}
                            transition={{
                                x: { delay: T.split, duration: T.splitDur, ease: [0.7, 0, 0.3, 1] },
                                y: { delay: T.split, duration: T.splitDur, ease: [0.7, 0, 0.3, 1] },
                                opacity: { delay: T.split + 0.3, duration: 0.3 },
                            }}
                        >
                            <Scene t={t} base={base} reduced={false} uid={i === 0 ? "a" : "b"} />
                        </motion.div>
                    ))}
                </>
            )}
        </motion.div>
    );
}