/**
 * AnalysisPage — top-level page for the analysis feature.
 *
 * Decides between GameList and AnalysisBoard based on the URL
 * (/analysis vs /analysis/:id). The page is auth-gated: if the user is
 * not signed in, we redirect them to the homepage (which shows the
 * Google login button). The page is also wrapped in ErrorBoundary so
 * a bad PGN or a Stockfish worker crash doesn't take down the app.
 */

import { useEffect } from "react";
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { Swords } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import GameList from "@/components/analysis/GameList";
import AnalysisBoard from "@/components/analysis/AnalysisBoard";
import { Navbar } from "@/components/Navbar";
import { GridBackground } from "@/components/ui/grid-background";

function AnalysisLoadingState() {
    return (
        <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4">
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-[#7b8f52]/10">
                <Swords className="h-7 w-7 text-[#5f713d]" />
                <div className="absolute inset-0 animate-spin rounded-2xl border-2 border-transparent border-t-[#5f713d]" />
            </div>
            <div className="text-center">
                <p className="text-sm font-medium text-foreground">Loading analysis</p>
                <p className="mt-1 text-xs text-muted-foreground">Fetching your games and setting up the board</p>
            </div>
        </div>
    );
}

export default function AnalysisPage() {
    const { isAuthenticated, isLoading } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            navigate("/", { state: { from: location.pathname }, replace: true });
        }
    }, [isLoading, isAuthenticated, navigate, location.pathname]);

    if (isLoading || !isAuthenticated) {
        return (
            <GridBackground>
                <Navbar />
                <main className="pt-20">
                    <AnalysisLoadingState />
                </main>
            </GridBackground>
        );
    }

    return (
        <GridBackground>
            <Navbar />
            <main className="min-h-screen pt-20">
                <div className="mx-auto max-w-7xl animate-in fade-in px-4 duration-300 sm:px-6 lg:px-8">
                    <ErrorBoundary>
                        <Routes>
                            <Route index element={<GameList />} />
                            <Route path=":id" element={<AnalysisBoard />} />
                        </Routes>
                    </ErrorBoundary>
                </div>
            </main>
        </GridBackground>
    );
}