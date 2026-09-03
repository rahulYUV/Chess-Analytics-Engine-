import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { motion } from "motion/react";
import { Link2, CheckCircle, AlertCircle, Loader2, X } from "lucide-react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

type Status = { type: "success" | "error" | null; message: string };

export const SettingsPage = ({ onClose }: { onClose: () => void }) => {
    const { user, accessToken, updateProfile } = useAuth();
    const [name, setName] = useState(user?.name || "");
    const [chessUsername, setChessUsername] = useState(user?.chessUsername || "");
    const [isEditingChess, setIsEditingChess] = useState(!user?.chessUsername);
    const [isSavingName, setIsSavingName] = useState(false);
    const [isLinking, setIsLinking] = useState(false);
    const [status, setStatus] = useState<Status>({ type: null, message: "" });
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted) return;

        const background = document.getElementById("root");
        if (!background) return;

        const originalPosition = background.style.position;
        const originalZIndex = background.style.zIndex;
        background.style.position = "relative";
        background.style.zIndex = "0";

        return () => {
            background.style.position = originalPosition;
            background.style.zIndex = originalZIndex;
        };
    }, [mounted]);

    useEffect(() => {
        setName(user?.name || "");
        setChessUsername(user?.chessUsername || "");
        setIsEditingChess(!user?.chessUsername);
    }, [user]);

    const getErrorMessage = (error: unknown, fallback: string) => {
        if (axios.isAxiosError(error)) return error.response?.data?.error || fallback;
        return error instanceof Error ? error.message : fallback;
    };

    const handleSaveName = async (event: React.FormEvent) => {
        event.preventDefault();
        const trimmedName = name.trim();
        if (!trimmedName) {
            setStatus({ type: "error", message: "Display name is required." });
            return;
        }

        setIsSavingName(true);
        setStatus({ type: null, message: "" });
        try {
            await updateProfile({ name: trimmedName });
            setStatus({ type: "success", message: "Display name saved." });
        } catch (error) {
            setStatus({ type: "error", message: getErrorMessage(error, "Failed to save display name.") });
        } finally {
            setIsSavingName(false);
        }
    };

    const handleLinkChessAccount = async (event: React.FormEvent) => {
        event.preventDefault();
        const trimmedUsername = chessUsername.trim();
        if (!trimmedUsername) {
            setStatus({ type: "error", message: "Enter your Chess.com username." });
            return;
        }

        setIsLinking(true);
        setStatus({ type: null, message: "" });
        try {
            const response = await axios.post(
                `${API_URL}/auth/link-chess-account`,
                { chessUsername: trimmedUsername },
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            if (response.data.success) {
                await updateProfile({ chessUsername: trimmedUsername });
                setIsEditingChess(false);
                setStatus({ type: "success", message: "Chess.com account connected." });
            }
        } catch (error) {
            setStatus({ type: "error", message: getErrorMessage(error, "Failed to connect Chess.com account.") });
        } finally {
            setIsLinking(false);
        }
    };

    const handleDisconnect = async () => {
        setIsLinking(true);
        setStatus({ type: null, message: "" });
        try {
            await updateProfile({ chessUsername: null });
            setChessUsername("");
            setIsEditingChess(true);
            setStatus({ type: "success", message: "Chess.com account disconnected." });
        } catch (error) {
            setStatus({ type: "error", message: getErrorMessage(error, "Failed to disconnect Chess.com account.") });
        } finally {
            setIsLinking(false);
        }
    };

    if (!mounted) return null;

    return createPortal((
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white shadow-2xl dark:bg-neutral-900"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
                    <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">Settings</h2>
                    <button type="button" onClick={onClose} aria-label="Close settings" className="rounded-full p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="space-y-8 p-6">
                    <section>
                        <h3 className="mb-4 text-lg font-semibold text-neutral-900 dark:text-white">Account Information</h3>
                        <div className="space-y-4 rounded-xl bg-neutral-50 p-4 dark:bg-neutral-800/50">
                            <form onSubmit={handleSaveName} className="space-y-2">
                                <Label htmlFor="displayName">App username</Label>
                                <div className="flex flex-col gap-2 sm:flex-row">
                                    <Input id="displayName" value={name} onChange={(event) => setName(event.target.value)} placeholder="Enter your display name" disabled={isSavingName} />
                                    <Button type="submit" disabled={isSavingName || !name.trim()} className="sm:w-28">
                                        {isSavingName ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                                    </Button>
                                </div>
                            </form>
                            <div>
                                <p className="text-sm text-neutral-600 dark:text-neutral-400">Email</p>
                                <p className="font-medium text-neutral-900 dark:text-white">{user?.email}</p>
                            </div>
                        </div>
                    </section>

                    <section>
                        <div className="mb-4 flex items-center gap-2">
                            <Link2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">Chess.com Account</h3>
                        </div>

                        {user?.chessUsername && !isEditingChess ? (
                            <div className="flex flex-col gap-4 rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-start gap-3">
                                    <CheckCircle className="mt-0.5 h-5 w-5 text-green-600 dark:text-green-400" />
                                    <p className="font-medium text-green-900 dark:text-green-100">Chess.com account linked: @{user.chessUsername}</p>
                                </div>
                                <div className="flex gap-2 sm:shrink-0">
                                    <Button type="button" variant="outline" onClick={() => setIsEditingChess(true)} disabled={isLinking}>Edit / Change</Button>
                                    <Button type="button" variant="outline" onClick={handleDisconnect} disabled={isLinking}>Disconnect</Button>
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={handleLinkChessAccount} className="space-y-4">
                                <div>
                                    <Label htmlFor="chessUsername">Chess.com username</Label>
                                    <Input id="chessUsername" value={chessUsername} onChange={(event) => setChessUsername(event.target.value)} placeholder="Enter your Chess.com username" className="mt-2" disabled={isLinking} />
                                </div>
                                <div className="flex flex-col gap-2 sm:flex-row">
                                    <Button type="submit" disabled={isLinking || !chessUsername.trim()}>
                                        {isLinking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
                                        {isLinking ? "Connecting..." : "Connect Chess.com"}
                                    </Button>
                                    {user?.chessUsername && <Button type="button" variant="ghost" onClick={() => setIsEditingChess(false)} disabled={isLinking}>Cancel</Button>}
                                </div>
                            </form>
                        )}
                    </section>

                    {status.type && (
                        <div className={`flex items-start gap-3 rounded-xl border p-4 ${status.type === "success" ? "border-green-200 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-900/20 dark:text-green-100" : "border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-900/20 dark:text-red-100"}`}>
                            {status.type === "success" ? <CheckCircle className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
                            <p className="text-sm">{status.message}</p>
                        </div>
                    )}
                </div>
            </motion.div>
        </motion.div>
    ), document.body);
};
