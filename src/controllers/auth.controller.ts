import { Request, Response } from "express";
import { AuthService } from "../services/auth.service";
import { generateTokenPair } from "../utils/jwt.utils";
import { validateChessComUsername, getChessComPlayerInfo } from "../utils/chesscom.utils";

export class AuthController {
    /**
     * Register a new user with email + password, then issue tokens
     * (auto-sign-in) exactly like the OAuth callback does.
     */
    static async register(req: Request, res: Response) {
        try {
            console.log("[register] called, body:", JSON.stringify(req.body));
            const { username, email, password } = req.body || {};

            if (typeof username !== "string" || typeof email !== "string" || typeof password !== "string") {
                return res.status(400).json({ error: "username, email, and password are required" });
            }

            const user = await AuthService.registerWithEmail({ username, email, password });

            const { accessToken, refreshToken } = generateTokenPair(user);
            await AuthService.saveRefreshToken(user._id.toString(), refreshToken);

            console.log(`User registered: ${user.email}`);

            return res.status(201).json({
                success: true,
                accessToken,
                refreshToken,
                user: {
                    id: user._id,
                    email: user.email,
                    username: user.username,
                    name: user.name,
                    avatar: user.avatar,
                    chessUsername: user.chessUsername,
                    role: user.role,
                    preferences: user.preferences,
                    createdAt: user.createdAt,
                    lastLogin: user.lastLogin,
                },
            });
        } catch (error: any) {
            // Pass through our statusCode-tagged errors, default to 500
            const statusCode = error.statusCode || 500;
            const message = error.message || "Failed to register";
            return res.status(statusCode).json({ error: message });
        }
    }

    /**
     * Log in with email + password.
     */
    static async login(req: Request, res: Response) {
        try {
            const { email, password } = req.body || {};

            if (typeof email !== "string" || typeof password !== "string") {
                return res.status(400).json({ error: "email and password are required" });
            }

            const user = await AuthService.loginWithEmail(email, password);

            const { accessToken, refreshToken } = generateTokenPair(user);
            await AuthService.saveRefreshToken(user._id.toString(), refreshToken);

            console.log(`User logged in: ${user.email}`);

            return res.status(200).json({
                success: true,
                accessToken,
                refreshToken,
                user: {
                    id: user._id,
                    email: user.email,
                    username: user.username,
                    name: user.name,
                    avatar: user.avatar,
                    chessUsername: user.chessUsername,
                    role: user.role,
                    preferences: user.preferences,
                    createdAt: user.createdAt,
                    lastLogin: user.lastLogin,
                },
            });
        } catch (error: any) {
            const statusCode = error.statusCode || 500;
            const message = error.message || "Failed to log in";
            return res.status(statusCode).json({ error: message });
        }
    }

    /**
     * Google OAuth Callback Handler
     * Handles both signup AND login (creates user if doesn't exist)
     */
    static async googleCallback(req: Request, res: Response) {
        try {
            // Passport attaches user to req.user after successful auth
            const user = req.user as any;

            if (!user) {
                console.error("Google callback: no user on req");
                return res.redirect(`${process.env.CLIENT_URL}/auth/error?message=Authentication%20failed`);
            }

            // Generate JWT tokens
            const { accessToken, refreshToken } = generateTokenPair(user);

            // Save refresh token to database
            await AuthService.saveRefreshToken(user._id.toString(), refreshToken);

            console.log(`User authenticated: ${user.email}`);

            // Redirect to frontend with tokens
            const redirectUrl = `${process.env.CLIENT_URL}/auth/callback?accessToken=${accessToken}&refreshToken=${refreshToken}`;
            res.redirect(redirectUrl);
        } catch (error: any) {
            // Log the full error so we can diagnose 500s from the browser
            console.error("Google callback error:", error?.message || error);
            if (error?.stack) console.error(error.stack);
            const msg = encodeURIComponent(error?.message || "Authentication failed");
            res.redirect(`${process.env.CLIENT_URL}/auth/error?message=${msg}`);
        }
    }

    /**
     * Refresh Access Token
     */
    static async refreshToken(req: Request, res: Response) {
        try {
            const { refreshToken } = req.body;

            if (!refreshToken) {
                return res.status(400).json({ error: "Refresh token is required" });
            }

            const { accessToken } = await AuthService.refreshAccessToken(refreshToken);

            res.status(200).json({
                success: true,
                accessToken,
            });
        } catch (error: any) {
            console.error("Refresh token error:", error);
            res.status(401).json({
                error: error.message || "Failed to refresh token",
            });
        }
    }

    /**
     * Logout (Single Device)
     */
    static async logout(req: Request, res: Response) {
        try {
            const { refreshToken } = req.body;
            const userId = (req as any).user?.userId;

            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            if (refreshToken) {
                await AuthService.removeRefreshToken(userId, refreshToken);
            }

            res.status(200).json({
                success: true,
                message: "Logged out successfully",
            });
        } catch (error: any) {
            console.error("Logout error:", error);
            res.status(500).json({
                error: error.message || "Logout failed",
            });
        }
    }

    /**
     * Logout from All Devices
     */
    static async logoutAll(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.userId;

            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            await AuthService.logoutAllDevices(userId);

            res.status(200).json({
                success: true,
                message: "Logged out from all devices",
            });
        } catch (error: any) {
            console.error("Logout all error:", error);
            res.status(500).json({
                error: error.message || "Logout failed",
            });
        }
    }

    /**
     * Get Current User Profile
     */
    static async getCurrentUser(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.userId;

            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            const user = await AuthService.getUserById(userId);

            if (!user) {
                return res.status(404).json({ error: "User not found" });
            }

            res.status(200).json({
                success: true,
                user: {
                    id: user._id,
                    email: user.email,
                    name: user.name,
                    avatar: user.avatar,
                    chessUsername: user.chessUsername,
                    role: user.role,
                    preferences: user.preferences,
                    createdAt: user.createdAt,
                    lastLogin: user.lastLogin,
                },
            });
        } catch (error: any) {
            console.error("Get current user error:", error);
            res.status(500).json({
                error: error.message || "Failed to get user",
            });
        }
    }

    /**
     * Update User Profile
     */
    static async updateProfile(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.userId;
            const updates = req.body;

            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            // Only allow certain fields to be updated
            const allowedUpdates = ["name", "chessUsername", "preferences"];
            const filteredUpdates: any = {};

            for (const key of allowedUpdates) {
                if (updates[key] !== undefined) {
                    filteredUpdates[key] = updates[key];
                }
            }

            const user = await AuthService.updateUserProfile(userId, filteredUpdates);

            if (!user) {
                return res.status(404).json({ error: "User not found" });
            }

            res.status(200).json({
                success: true,
                message: "Profile updated successfully",
                user: {
                    id: user._id,
                    email: user.email,
                    name: user.name,
                    avatar: user.avatar,
                    chessUsername: user.chessUsername,
                    role: user.role,
                    preferences: user.preferences,
                },
            });
        } catch (error: any) {
            console.error("Update profile error:", error);
            res.status(500).json({
                error: error.message || "Failed to update profile",
            });
        }
    }

    /**
     * Delete User Account
     */
    static async deleteAccount(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.userId;

            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            await AuthService.deleteUserAccount(userId);

            res.status(200).json({
                success: true,
                message: "Account deleted successfully",
            });
        } catch (error: any) {
            console.error("Delete account error:", error);
            res.status(500).json({
                error: error.message || "Failed to delete account",
            });
        }
    }

    /**
     * Link Chess.com Account
     * Validates username exists on Chess.com before saving
     */
    static async linkChessComAccount(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.userId;
            const { chessUsername } = req.body;

            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            // Validate input
            if (!chessUsername || typeof chessUsername !== "string") {
                return res.status(400).json({
                    error: "Chess.com username is required",
                });
            }

            const trimmedUsername = chessUsername.trim();

            if (trimmedUsername.length < 3 || trimmedUsername.length > 25) {
                return res.status(400).json({
                    error: "Username must be between 3 and 25 characters",
                });
            }

            // Validate username exists on Chess.com
            console.log(`Validating Chess.com username: ${trimmedUsername}`);
            const isValid = await validateChessComUsername(trimmedUsername);

            if (!isValid) {
                return res.status(404).json({
                    error: "Chess.com user not found. Please check the username and try again.",
                });
            }

            // Get additional player info
            const playerInfo = await getChessComPlayerInfo(trimmedUsername);

            // Update user profile
            const user = await AuthService.updateUserProfile(userId, {
                chessUsername: trimmedUsername,
            });

            if (!user) {
                return res.status(404).json({ error: "User not found" });
            }

            console.log(`Linked Chess.com account: ${trimmedUsername} to user ${user.email}`);

            res.status(200).json({
                success: true,
                message: "Chess.com account linked successfully",
                user: {
                    id: user._id,
                    email: user.email,
                    name: user.name,
                    avatar: user.avatar,
                    chessUsername: user.chessUsername,
                    role: user.role,
                    preferences: user.preferences,
                },
                chessComInfo: playerInfo
                    ? {
                        username: playerInfo.username,
                        avatar: playerInfo.avatar,
                        url: playerInfo.url,
                    }
                    : null,
            });
        } catch (error: any) {
            console.error("Link Chess.com account error:", error);
            res.status(500).json({
                error: error.message || "Failed to link Chess.com account",
            });
        }
    }
}
