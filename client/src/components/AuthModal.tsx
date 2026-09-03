import { useEffect, useState, FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useAuth } from "../contexts/AuthContext";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

type Mode = "login" | "register";

interface AuthModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialMode?: Mode;
}

export const AuthModal = ({ open, onOpenChange, initialMode = "login" }: AuthModalProps) => {
    const { loginWithEmail, registerWithEmail } = useAuth();
    const [mode, setMode] = useState<Mode>(initialMode);
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            setMode(initialMode);
            setError(null);
            setSubmitting(false);
        }
    }, [initialMode, open]);

    // Reset when modal opens/closes or mode flips
    const reset = () => {
        setUsername("");
        setEmail("");
        setPassword("");
        setError(null);
        setSubmitting(false);
    };

    const switchMode = (next: Mode) => {
        setMode(next);
        setError(null);
    };

    const handleClose = () => {
        reset();
        onOpenChange(false);
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        setSubmitting(true);

        try {
            if (mode === "login") {
                await loginWithEmail(email.trim(), password);
            } else {
                if (username.trim().length < 3) {
                    throw new Error("Username must be at least 3 characters");
                }
                if (password.length < 8) {
                    throw new Error("Password must be at least 8 characters");
                }
                await registerWithEmail(username.trim(), email.trim(), password);
            }
            reset();
            onOpenChange(false);
        } catch (err: any) {
            // Axios error has .response.data.error; raw throws have .message
            const message =
                err?.response?.data?.error ||
                err?.message ||
                (mode === "login" ? "Failed to log in" : "Failed to register");
            setError(message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleGoogle = () => {
        // OAuth flow — backend redirects back to /auth/callback
        window.location.href = `${API_URL}/auth/google`;
    };

    const title = mode === "login" ? "Welcome back" : "Create your account";
    const description =
        mode === "login"
            ? "Sign in with your email, password, or Google."
            : "Create an account with email, password, or Google.";
    const googleLabel = mode === "login" ? "Continue with Google" : "Sign up with Google";
    const submitLabel = mode === "login" ? "Log in" : "Create account";

    return (
        <AnimatePresence>
            {open && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        className="fixed left-0 right-0 bottom-0 top-16 z-40 bg-black/60 backdrop-blur-sm md:top-16"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handleClose}
                    />

                    {/* Dialog */}
                    <motion.div
                        className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-20 md:pt-28"
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ type: "spring", damping: 22, stiffness: 280 }}
                    >
                        <div
                            className="relative w-full max-w-md rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-8 shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Close */}
                            <button
                                onClick={handleClose}
                                aria-label="Close"
                                className="absolute right-4 top-4 text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                            >
                                <svg
                                    width="20"
                                    height="20"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                >
                                    <path d="M18 6L6 18M6 6l12 12" />
                                </svg>
                            </button>

                            {/* Heading */}
                            <div className="mb-6 text-center">
                                <h2 className="text-2xl font-semibold text-neutral-900 dark:text-white">
                                    {title}
                                </h2>
                                <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                                    {description}
                                </p>
                            </div>

                            {/* Google */}
                            <Button
                                type="button"
                                onClick={handleGoogle}
                                variant="outline"
                                className="w-full flex items-center justify-center gap-3 py-6 rounded-full"
                            >
                                <svg className="w-5 h-5" viewBox="0 0 24 24">
                                    <path
                                        fill="#4285F4"
                                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                    />
                                    <path
                                        fill="#34A853"
                                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                    />
                                    <path
                                        fill="#FBBC05"
                                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                    />
                                    <path
                                        fill="#EA4335"
                                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                    />
                                </svg>
                                {googleLabel}
                            </Button>

                            <div className="my-5 flex items-center gap-3">
                                <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
                                <span className="text-xs uppercase tracking-wider text-neutral-400">
                                    or
                                </span>
                                <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
                            </div>

                            {/* Email form */}
                            <form onSubmit={handleSubmit} className="mt-2 space-y-3">
                                {mode === "register" && (
                                    <div>
                                        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                                            Username
                                        </label>
                                        <Input
                                            type="text"
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                            placeholder="coolchessplayer"
                                            autoComplete="username"
                                            required
                                            minLength={3}
                                            maxLength={25}
                                            pattern="^[a-zA-Z0-9_]+$"
                                        />
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                                        Email
                                    </label>
                                    <Input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="you@example.com"
                                        autoComplete="email"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                                        Password
                                    </label>
                                    <Input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        autoComplete={
                                            mode === "login" ? "current-password" : "new-password"
                                        }
                                        required
                                        minLength={mode === "register" ? 8 : 1}
                                    />
                                </div>

                                {error && (
                                    <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2">
                                        {error}
                                    </p>
                                )}

                                <Button
                                    type="submit"
                                    disabled={submitting}
                                    className="w-full py-6 rounded-full"
                                >
                                    {submitting
                                        ? mode === "login"
                                            ? "Logging in..."
                                            : "Creating account..."
                                        : submitLabel}
                                </Button>
                            </form>

                            {/* Toggle */}
                            <p className="mt-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
                                {mode === "login" ? (
                                    <>
                                        Don't have an account?{" "}
                                        <button
                                            type="button"
                                            onClick={() => switchMode("register")}
                                            className="text-neutral-900 dark:text-white font-medium hover:underline"
                                        >
                                            Sign up
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        Already have an account?{" "}
                                        <button
                                            type="button"
                                            onClick={() => switchMode("login")}
                                            className="text-neutral-900 dark:text-white font-medium hover:underline"
                                        >
                                            Log in
                                        </button>
                                    </>
                                )}
                            </p>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
