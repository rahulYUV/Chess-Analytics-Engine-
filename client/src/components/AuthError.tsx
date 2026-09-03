import { Link, useLocation } from "react-router-dom";

export const AuthError = () => {
    const location = useLocation();
    const params = new URLSearchParams(location.search);
    const message = params.get("message") || "Authentication failed. Please try again.";

    return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-950 px-4">
            <div className="w-full max-w-md rounded-3xl border border-neutral-800 bg-neutral-900/90 p-8 text-center shadow-2xl">
                <p className="text-sm uppercase tracking-[0.3em] text-red-400">Sign in error</p>
                <h1 className="mt-3 text-3xl font-bold text-white">Google sign-in failed</h1>
                <p className="mt-4 text-sm leading-6 text-neutral-300">{message}</p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                    <Link
                        to="/"
                        className="inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-neutral-950 transition-colors hover:bg-neutral-200"
                    >
                        Back home
                    </Link>
                    <Link
                        to="/"
                        className="inline-flex items-center justify-center rounded-full border border-neutral-700 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
                    >
                        Try again
                    </Link>
                </div>
            </div>
        </div>
    );
};
