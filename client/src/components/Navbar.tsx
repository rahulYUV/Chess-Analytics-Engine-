import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { GoogleLoginButton } from "./GoogleLoginButton";
import { AuthModal } from "./AuthModal";
import { UserMenu } from "./UserMenu";
import { Bell, LineChart } from "lucide-react";
import { motion } from "motion/react";
import { Link } from "react-router-dom";

export const Navbar = () => {
    const { isAuthenticated, isLoading, user } = useAuth();
    const [authOpen, setAuthOpen] = useState(false);
    const [authMode, setAuthMode] = useState<"login" | "register">("login");

    const openLogin = () => {
        setAuthMode("login");
        setAuthOpen(true);
    };
    const openRegister = () => {
        setAuthMode("register");
        setAuthOpen(true);
    };

    return (
        <motion.nav
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="fixed top-0 left-0 right-0 z-50 bg-white/60 dark:bg-neutral-900/60 backdrop-blur-md border-b border-neutral-200/40 dark:border-neutral-800/40"
        >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Logo / Brand - Text Only */}
                    <Link to="/" className="text-xl font-bold text-neutral-900 dark:text-white">
                        ChessStat
                    </Link>

                    {/* Navigation Links - Center */}
                    <div className="hidden md:flex items-center gap-8">
                        <NavLink to="/" active>
                            Home
                        </NavLink>
                        <NavLink href="#analytics">Analytics</NavLink>
                        <NavLink href="#leaderboard">Leaderboard</NavLink>
                        {isAuthenticated && user?.chessUsername && (
                            <Link
                                to="/analysis"
                                className="text-sm font-medium transition-colors text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white inline-flex items-center gap-1.5"
                            >
                                <LineChart className="h-4 w-4" />
                                Analyze
                            </Link>
                        )}
                    </div>

                    {/* Right Side - Auth & User */}
                    <div className="flex items-center gap-3">
                        {isAuthenticated && user ? (
                            <>
                                {/* Notification Bell */}
                                <button className="relative p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors">
                                    <Bell className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
                                    {/* Red notification dot */}
                                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
                                </button>

                                {/* User Info Card */}
                                <div className="flex items-center gap-3">
                                    <img
                                        src={
                                            user.avatar ||
                                            `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                                user.name
                                            )}&background=random`
                                        }
                                        alt={user.name}
                                        className="w-10 h-10 rounded-full border-2 border-neutral-200 dark:border-neutral-700"
                                    />
                                    <div className="hidden lg:block text-left">
                                        <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                                            {user.name}
                                        </p>
                                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                            {user.chessUsername ? (
                                                <span className="text-blue-600 dark:text-blue-400">
                                                    @{user.chessUsername}
                                                </span>
                                            ) : (
                                                "Chess Enthusiast"
                                            )}
                                        </p>
                                    </div>
                                    <UserMenu />
                                </div>
                            </>
                        ) : (
                            !isLoading && (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={openLogin}
                                        className="text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white px-3 py-2 rounded-full transition-colors"
                                    >
                                        Log in
                                    </button>
                                    <GoogleLoginButton onClick={openRegister} label="Sign up" />
                                </div>
                            )
                        )}
                    </div>
                </div>
            </div>

            <AuthModal
                open={authOpen}
                onOpenChange={setAuthOpen}
                initialMode={authMode}
            />
        </motion.nav>
    );
};

// Navigation Link Component
const NavLink = ({
    to,
    href,
    children,
    active = false,
}: {
    to?: string;
    href?: string;
    children: React.ReactNode;
    active?: boolean;
}) => {
    const className = `text-sm font-medium transition-colors hover:text-neutral-900 dark:hover:text-white ${active
        ? "text-neutral-900 dark:text-white"
        : "text-neutral-600 dark:text-neutral-400"
        }`;

    if (to) return <Link to={to} className={className}>{children}</Link>;
    return <a href={href} className={className}>{children}</a>;
};
