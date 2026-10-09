const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = localStorage.getItem("accessToken");
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    if (token) headers.set("Authorization", `Bearer ${token}`);

    const response = await fetch(`${API_URL}${path}`, { ...init, headers });
    const payload = await response.json().catch(() => null) as T & { error?: string } | null;
    if (!response.ok) {
        throw new Error(payload && typeof payload === "object" && "error" in payload ? payload.error : `Request failed (${response.status})`);
    }
    return payload as T;
}
