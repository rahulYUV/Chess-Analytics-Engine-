import bcrypt from "bcryptjs";
import { User, IUser } from "../models/User";
import { generateTokenPair, verifyRefreshToken } from "../utils/jwt.utils";

const BCRYPT_ROUNDS = 12;

export class AuthService {
    /**
     * Register a new user with email + password. Returns the user doc.
     * Throws on duplicate email/username.
     */
    static async registerWithEmail(input: {
        username: string;
        email: string;
        password: string;
    }): Promise<IUser> {
        const username = input.username.trim();
        const email = input.email.trim().toLowerCase();

        if (username.length < 3 || username.length > 25) {
            throw Object.assign(new Error("Username must be between 3 and 25 characters"), { statusCode: 400 });
        }
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            throw Object.assign(new Error("Username may only contain letters, numbers, and underscores"), { statusCode: 400 });
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            throw Object.assign(new Error("Invalid email address"), { statusCode: 400 });
        }
        if (input.password.length < 8) {
            throw Object.assign(new Error("Password must be at least 8 characters"), { statusCode: 400 });
        }

        const existing = await User.findOne({
            $or: [{ email }, { username }],
        });
        if (existing) {
            if (existing.email === email) {
                throw Object.assign(new Error("An account with that email already exists"), { statusCode: 409 });
            }
            throw Object.assign(new Error("That username is taken"), { statusCode: 409 });
        }

        const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

        const user = await User.create({
            username,
            email,
            passwordHash,
            name: username, // display name defaults to username; user can change it
            role: "user",
            preferences: {
                favoriteOpenings: [],
                savedPlayers: [],
                theme: "dark",
            },
            refreshTokens: [],
            lastLogin: new Date(),
        });

        return user;
    }

    /**
     * Authenticate a user by email + password. Returns the user doc with
     * passwordHash selected. Throws on bad credentials.
     */
    static async loginWithEmail(email: string, password: string): Promise<IUser> {
        const normalized = email.trim().toLowerCase();
        const user = await User.findOne({ email: normalized }).select("+passwordHash");
        if (!user || !user.passwordHash) {
            // Generic message — don't leak whether the email exists
            throw Object.assign(new Error("Invalid email or password"), { statusCode: 401 });
        }
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) {
            throw Object.assign(new Error("Invalid email or password"), { statusCode: 401 });
        }
        user.lastLogin = new Date();
        await user.save();
        return user;
    }

    /**
     * Find or Create User from Google OAuth Profile
     */
    static async findOrCreateGoogleUser(profile: any): Promise<IUser> {
        try {
            const email = profile.emails?.[0]?.value?.trim().toLowerCase() || "";
            const name = profile.displayName || profile.name?.givenName || email.split("@")[0] || "User";
            const avatar = profile.photos?.[0]?.value || null;

            if (!email) {
                throw Object.assign(new Error("Google account did not return an email address"), {
                    statusCode: 400,
                });
            }

            // First try to match by Google account, then fall back to email so
            // an existing email/password user can sign in with Google too.
            let user = await User.findOne({ googleId: profile.id });

            if (!user) {
                user = await User.findOne({ email });
            }

            if (user) {
                if (!user.googleId) {
                    user.googleId = profile.id;
                }

                user.email = email;
                user.name = user.name || name;
                user.avatar = avatar || user.avatar || null;
                // Update last login
                user.lastLogin = new Date();
                await user.save();
                return user;
            }

            // Create new user
            user = await User.create({
                googleId: profile.id,
                email,
                name,
                avatar,
                role: "user",
                preferences: {
                    favoriteOpenings: [],
                    savedPlayers: [],
                    theme: "dark",
                },
                refreshTokens: [],
                lastLogin: new Date(),
            });

            console.log(`New user created: ${user.email}`);
            return user;
        } catch (error) {
            console.error("Error in findOrCreateGoogleUser:", error);
            throw new Error("Failed to authenticate user");
        }
    }

    /**
     * Save Refresh Token to User
     */
    static async saveRefreshToken(userId: string, refreshToken: string): Promise<void> {
        try {
            const user = await User.findById(userId);
            if (!user) {
                throw new Error("User not found");
            }

            // Limit to 5 refresh tokens (5 devices max)
            if (user.refreshTokens.length >= 5) {
                user.refreshTokens.shift(); // Remove oldest token
            }

            user.refreshTokens.push(refreshToken);
            await user.save();
        } catch (error) {
            console.error("Error saving refresh token:", error);
            throw error;
        }
    }

    /**
     * Remove Refresh Token (Logout)
     */
    static async removeRefreshToken(userId: string, refreshToken: string): Promise<void> {
        try {
            const user = await User.findById(userId);
            if (!user) {
                throw new Error("User not found");
            }

            user.refreshTokens = user.refreshTokens.filter((token) => token !== refreshToken);
            await user.save();
        } catch (error) {
            console.error("Error removing refresh token:", error);
            throw error;
        }
    }

    /**
     * Refresh Access Token
     */
    static async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string }> {
        try {
            // Verify refresh token
            const decoded = verifyRefreshToken(refreshToken);

            // Find user and check if refresh token exists
            const user = await User.findById(decoded.userId);
            if (!user) {
                throw new Error("User not found");
            }

            if (!user.refreshTokens.includes(refreshToken)) {
                throw new Error("Invalid refresh token");
            }

            // Generate new access token
            const { accessToken } = generateTokenPair(user);

            return { accessToken };
        } catch (error) {
            console.error("Error refreshing token:", error);
            throw new Error("Failed to refresh token");
        }
    }

    /**
     * Logout from all devices
     */
    static async logoutAllDevices(userId: string): Promise<void> {
        try {
            const user = await User.findById(userId);
            if (!user) {
                throw new Error("User not found");
            }

            user.refreshTokens = [];
            await user.save();
        } catch (error) {
            console.error("Error logging out all devices:", error);
            throw error;
        }
    }

    /**
     * Get User by ID
     */
    static async getUserById(userId: string): Promise<IUser | null> {
        try {
            return await User.findById(userId).select("-refreshTokens");
        } catch (error) {
            console.error("Error getting user:", error);
            return null;
        }
    }

    /**
     * Update User Profile
     */
    static async updateUserProfile(
        userId: string,
        updates: Partial<{
            name: string;
            chessUsername: string;
            preferences: IUser["preferences"];
        }>
    ): Promise<IUser | null> {
        try {
            const user = await User.findByIdAndUpdate(
                userId,
                { $set: updates },
                { new: true, runValidators: true }
            ).select("-refreshTokens");

            return user;
        } catch (error) {
            console.error("Error updating user profile:", error);
            throw new Error("Failed to update profile");
        }
    }

    /**
     * Delete User Account
     */
    static async deleteUserAccount(userId: string): Promise<void> {
        try {
            await User.findByIdAndDelete(userId);
            console.log(`User account deleted: ${userId}`);
        } catch (error) {
            console.error("Error deleting user account:", error);
            throw new Error("Failed to delete account");
        }
    }
}
