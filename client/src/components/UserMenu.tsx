import { useAuth } from "../contexts/AuthContext";
import { LogOut, User, Settings, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useState, useRef, useEffect } from "react";
import { SettingsPage } from "./SettingsPage";
import { Link } from "react-router-dom";

export const UserMenu = () => {
    const { user, logout, isAuthenticated } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    if (!isAuthenticated || !user) {
        return null;
    }

    const handleLogout = async () => {
        setIsOpen(false);
        await logout();
    };

    return (
        <div className="relative" ref={menuRef}>
            {/* Chevron Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors"
            >
                <ChevronDown className={`w-4 h-4 text-neutral-600 dark:text-neutral-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 mt-2 w-56 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl overflow-hidden"
                    >
                        {/* Menu Items */}
                        <div className="p-2">
                            <Link
                                to="/profile"
                                onClick={() => setIsOpen(false)}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-left"
                            >
                                <User className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
                                <span className="text-sm font-medium text-neutral-900 dark:text-white">
                                    Profile
                                </span>
                            </Link>

                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    setShowSettings(true);
                                }}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-left"
                            >
                                <Settings className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
                                <span className="text-sm font-medium text-neutral-900 dark:text-white">
                                    Settings
                                </span>
                            </button>
                        </div>

                        {/* Logout */}
                        <div className="p-2 border-t border-neutral-200 dark:border-neutral-800">
                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left group"
                            >
                                <LogOut className="w-5 h-5 text-neutral-600 dark:text-neutral-400 group-hover:text-red-600 dark:group-hover:text-red-400" />
                                <span className="text-sm font-medium text-neutral-900 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-400">
                                    Logout
                                </span>
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Settings Modal */}
            <AnimatePresence>
                {showSettings && <SettingsPage onClose={() => setShowSettings(false)} />}
            </AnimatePresence>
        </div>
    );
};
