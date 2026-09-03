import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

/**
 * Top-level error boundary. Catches render-time errors and renders a
 * fallback instead of blanking the whole page. The Analysis feature is
 * the first to use heavy Web Workers and chess.js parsing, both of
 * which can throw in ways we don't want to crash the rest of the app.
 */
export class ErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false };

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        // In a real app, post to Sentry / your error tracker here.
        console.error("ErrorBoundary caught:", error, info);
    }

    render() {
        if (this.state.hasError) {
            return (
                this.props.fallback ?? (
                    <div className="p-8 max-w-xl mx-auto text-center space-y-4">
                        <h2 className="text-2xl font-bold">Something went wrong</h2>
                        <p className="text-sm text-muted-foreground">
                            {this.state.error?.message || "An unexpected error occurred."}
                        </p>
                        <button
                            className="px-4 py-2 rounded-full bg-neutral-900 text-white"
                            onClick={() => this.setState({ hasError: false })}
                        >
                            Try again
                        </button>
                    </div>
                )
            );
        }
        return this.props.children;
    }
}
