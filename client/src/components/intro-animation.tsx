import { motion } from "framer-motion";
import { useEffect } from "react";
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
};

const letterVariants = {
    hidden: { y: 16, opacity: 0 },
    show: {
        y: 0,
        opacity: 1,
        transition: { type: "spring" as const, stiffness: 400, damping: 28 },
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

export function IntroAnimation({ onComplete }: IntroAnimationProps) {
    useEffect(() => {
        // Fast, premium-feeling flash — tweak this if you want it snappier/slower
        const timer = setTimeout(onComplete, 750);
        return () => clearTimeout(timer);
    }, [onComplete]);

    return (
        <motion.div
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white text-black overflow-hidden"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.03, filter: "blur(6px)" }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
            {/* Faint checkerboard-ish grid, matching the site's grid background */}
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
                        animate={{ scale: [1, 1.3, 1], opacity: [0.6, 1, 0.6] }}
                        transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <Crown className="w-20 h-20 text-green-600 relative z-10 drop-shadow-sm" strokeWidth={1.5} />
                </motion.div>

                {/* Text Logo — letters stagger in */}
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
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
                </motion.div>
            </div>
        </motion.div>
    );
}