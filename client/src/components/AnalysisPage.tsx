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
import { useAuth } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import GameList from "@/components/analysis/GameList";
import AnalysisBoard from "@/components/analysis/AnalysisBoard";
import { Navbar } from "@/components/Navbar";

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
            <div className="flex items-center justify-center p-12">
                <div className="h-6 w-6 rounded-full border-2 border-neutral-300 border-t-neutral-900 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground">
            <Navbar />
            <main className="pt-20">
                <ErrorBoundary>
                    <Routes>
                        <Route index element={<GameList />} />
                        <Route path=":id" element={<AnalysisBoard />} />
                    </Routes>
                </ErrorBoundary>
            </main>
        </div>
    );
}
