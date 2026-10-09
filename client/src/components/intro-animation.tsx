import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { Crown } from "lucide-react";

interface IntroAnimationProps {
    onComplete: () => void;
}

const containerVariants = {
    hidden: {},
    show: {
        transition: {
            staggerChildren: 0.04,
            delayChildren: 0.15,
        },
    },
    exit: {
        transition: {
            staggerChildren: 0.02,
            staggerDirection: -1,
        },
    },
};

const letterVariants = {
    hidden: { y: 16, opacity: 0 },
    show: {
        y: 0,
        opacity: 1,
        transition: { type: "spring" as const, stiffness: 400, damping: 28 },
    },
    exit: {
        y: -10,
        opacity: 0,
        transition: { duration: 0.2, ease: "easeIn" as const },
    },
};

function AnimatedWord({ word, className }: { word: string; className?: string }) {
    return (
        <span className="inline-flex overflow-hidden">
            {word.split("").map((char, i) => (
                <motion.span key={i} variants={letterVariants} className={className}>
                    {char}
                </motion.span>
            ))}
        </span>
    );
}

// A few real chessboard squares tucked in the corners — ties the loading
// screen back to the product instead of just being a generic grid.
function CornerBoard({ className }: { className?: string }) {
    const squares = Array.from({ length: 16 }, (_, i) => {
        const row = Math.floor(i / 4);
        const col = i % 4;
        return (row + col) % 2 === 0;
    });

    return (
        <div className={`grid grid-cols-4 grid-rows-4 w-24 h-24 ${className}`}>
            {squares.map((dark, i) => (
                <div key={i} className={dark ? "bg-black/[0.06]" : "bg-transparent"} />
            ))}
        </div>
    );
}

// Quick fake rating tick — pure flavor, reinforces "Stat" before the reveal.
function RatingTicker() {
    const [value, setValue] = useState(800);

    useEffect(() => {
        const target = 1200 + Math.floor(Math.random() * 600);
        const start = performance.now();
        const duration = 550;

        let raf: number;
        const tick = (now: number) => {
            const t = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - t, 3);
            setValue(Math.floor(800 + eased * (target - 800)));
            if (t < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, []);

    return (
        <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.55, duration: 0.3 }}
            className="text-xs font-mono tracking-widest text-black/40 tabular-nums"
        >
            RATING {value}
        </motion.span>
    );
}

export function IntroAnimation({ onComplete }: IntroAnimationProps) {
    const prefersReducedMotion = useReducedMotion();

    useEffect(() => {
        const timer = setTimeout(onComplete, prefersReducedMotion ? 300 : 850);
        return () => clearTimeout(timer);
    }, [onComplete, prefersReducedMotion]);

    return (
        <motion.div
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white text-black overflow-hidden"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.03, filter: "blur(6px)" }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
            {/* Faint grid, matching the site's background */}
            <div
                className="pointer-events-none absolute inset-0 opacity-[0.4]"
                style={{
                    backgroundSize: "40px 40px",
                    backgroundImage:
                        "linear-gradient(to right, #f0f0f0 1px, transparent 1px), linear-gradient(to bottom, #f0f0f0 1px, transparent 1px)",
                    maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
                    WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
                }}
            />

            {/* Checkerboard corners — subtle nod to chess without shouting it */}
            {!prefersReducedMotion && (
                <>
                    <motion.div
                        initial={{ opacity: 0, x: -20, y: -20 }}
                        animate={{ opacity: 1, x: 0, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className="absolute -top-4 -left-4"
                    >
                        <CornerBoard />
                    </motion.div>
                    <motion.div
                        initial={{ opacity: 0, x: 20, y: 20 }}
                        animate={{ opacity: 1, x: 0, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className="absolute -bottom-4 -right-4"
                    >
                        <CornerBoard />
                    </motion.div>
                </>
            )}

            <div className="relative flex flex-col items-center gap-6">
                {/* Logo Icon */}
                <motion.div
                    initial={{ scale: 0.3, opacity: 0, rotate: -25 }}
                    animate={{ scale: 1, opacity: 1, rotate: 0 }}
                    transition={{ duration: 0.5, type: "spring", stiffness: 260, damping: 16 }}
                    className="relative"
                >
                    <motion.div
                        className="absolute inset-0 bg-green-500/20 blur-2xl rounded-full"
                        animate={
                            prefersReducedMotion
                                ? { opacity: 0.6 }
                                : { scale: [1, 1.3, 1], opacity: [0.6, 1, 0.6] }
                        }
                        transition={{ duration: 1.2, repeat: prefersReducedMotion ? 0 : Infinity, ease: "easeInOut" }}
                    />
                    <Crown className="w-20 h-20 text-green-600 relative z-10 drop-shadow-sm" strokeWidth={1.5} />
                </motion.div>

                {/* Text Logo — letters stagger in */}
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                    exit="exit"
                    className="flex flex-col items-center gap-2"
                >
                    <div className="flex items-center gap-1 text-4xl md:text-5xl font-bold tracking-tight">
                        <AnimatedWord word="Chess" className="text-black" />
                        <AnimatedWord word="Stat" className="text-green-600" />
                    </div>

                    {/* Animated underline sweep */}
                    <motion.div
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: "60%", opacity: 1 }}
                        transition={{ delay: 0.5, duration: 0.4, ease: "easeOut" }}
                        className="h-[2px] bg-gradient-to-r from-transparent via-green-500 to-transparent"
                    />

                    {!prefersReducedMotion && <RatingTicker />}
                </motion.div>
            </div>
        </motion.div>
    );
}