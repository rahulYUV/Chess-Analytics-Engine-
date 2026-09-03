import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import axios from "axios";
import { jwtDecode } from "jwt-decode";

interface User {
    id: string;
    email: string;
    name: string;
    avatar?: string;
    chessUsername?: string;
    role: "user" | "admin";
    preferences: {
        favoriteOpenings: string[];
        savedPlayers: string[];
        theme?: "light " | "dark";
    };
}

interface AuthContextType {
    user: User | null;
    accessToken: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (accessToken: string, refreshToken: string) => void;
    loginWithEmail: (email: string, password: string) => Promise<void>;
    registerWithEmail: (
        username: string,
        email: string,
        password: string
    ) => Promise<void>;
    updateProfile: (updates: {
        name?: string;
        chessUsername?: string | null;
    }) => Promise<void>;
    logout: () => Promise<void>;
    refreshAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Initialize auth from localStorage
    useEffect(() => {
        const initAuth = async () => {
            const storedAccessToken = localStorage.getItem("accessToken");
            const storedRefreshToken = localStorage.getItem("refreshToken");

            if (storedAccessToken) {
                try {
                    // Check if token is expired
                    const decoded: any = jwtDecode(storedAccessToken);
                    const now = Date.now() / 1000;

                    if (decoded.exp > now) {
                        // Token is still valid
                        setAccessToken(storedAccessToken);
                        await fetchUserProfile(storedAccessToken);
                    } else if (storedRefreshToken) {
                        // Token expired, try to refresh
                        await refreshAccessToken();
                    }
                } catch (error) {
                    console.error("Token validation error:", error);
                    localStorage.removeItem("accessToken");
                    localStorage.removeItem("refreshToken");
                }
            }

            setIsLoading(false);
        };

        initAuth();
    }, []);

    // Fetch user profile
    const fetchUserProfile = async (token: string) => {
        try {
            const response = await axios.get(`${API_URL}/auth/me`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (response.data.success) {
                setUser(response.data.user);
            }
        } catch (error) {
            console.error("Error fetching user profile:", error);
            setUser(null);
            setAccessToken(null);
        }
    };

    // Login (used by Google OAuth callback — tokens are already in hand)
    const login = async (newAccessToken: string, refreshToken: string) => {
        localStorage.setItem("accessToken", newAccessToken);
        localStorage.setItem("refreshToken", refreshToken);
        setAccessToken(newAccessToken);
        await fetchUserProfile(newAccessToken);
    };

    // Login with email + password — exchanges credentials for a token pair
    const loginWithEmail = async (email: string, password: string) => {
        const response = await axios.post(`${API_URL}/auth/login`, {
            email,
            password,
        });
        if (!response.data.success) {
            throw new Error(response.data.error || "Login failed");
        }
        await login(response.data.accessToken, response.data.refreshToken);
    };

    // Register a new account with email + password, then auto-sign-in
    const registerWithEmail = async (
        username: string,
        email: string,
        password: string
    ) => {
        const response = await axios.post(`${API_URL}/auth/register`, {
            username,
            email,
            password,
        });
        if (!response.data.success) {
            throw new Error(response.data.error || "Registration failed");
        }
        await login(response.data.accessToken, response.data.refreshToken);
    };

    const updateProfile = async (updates: {
        name?: string;
        chessUsername?: string | null;
    }) => {
        const response = await axios.put(`${API_URL}/auth/me`, updates, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        if (!response.data.success) {
            throw new Error(response.data.error || "Profile update failed");
        }

        setUser(response.data.user);
    };

    // Logout
    const logout = async () => {
        const refreshToken = localStorage.getItem("refreshToken");

        try {
            if (accessToken) {
                await axios.post(
                    `${API_URL}/auth/logout`,
                    { refreshToken },
                    {
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                        },
                    }
                );
            }
        } catch (error) {
            console.error("Logout error:", error);
        } finally {
            localStorage.removeItem("accessToken");
            localStorage.removeItem("refreshToken");
            setUser(null);
            setAccessToken(null);
        }
    };

    // Refresh access token
    const refreshAccessToken = async (): Promise<string | null> => {
        const refreshToken = localStorage.getItem("refreshToken");

        if (!refreshToken) {
            return null;
        }

        try {
            const response = await axios.post(`${API_URL}/auth/refresh`, {
                refreshToken,
            });

            if (response.data.success) {
                const newAccessToken = response.data.accessToken;
                localStorage.setItem("accessToken", newAccessToken);
                setAccessToken(newAccessToken);
                await fetchUserProfile(newAccessToken);
                return newAccessToken;
            }
        } catch (error) {
            console.error("Token refresh error:", error);
            localStorage.removeItem("accessToken");
            localStorage.removeItem("refreshToken");
            setUser(null);
            setAccessToken(null);
        }

        return null;
    };

    const value: AuthContextType = {
        user,
        accessToken,
        isAuthenticated: !!user,
        isLoading,
        login,
        loginWithEmail,
        registerWithEmail,
        updateProfile,
        logout,
        refreshAccessToken,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use auth context
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};
