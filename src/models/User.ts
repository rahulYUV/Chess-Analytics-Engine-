import mongoose from "mongoose";

export interface IUser extends mongoose.Document {
    googleId?: string;
    username?: string;
    email: string;
    passwordHash?: string;
    name: string;
    avatar?: string;
    chessUsername?: string;
    role: "user" | "admin";
    preferences: {
        favoriteOpenings: string[];
        savedPlayers: string[];
        theme?: "light" | "dark";
    };
    refreshTokens: string[];
    createdAt: Date;
    updatedAt: Date;
    lastLogin: Date;
}

const userSchema = new mongoose.Schema<IUser>(
    {
        googleId: {
            type: String,
            default: undefined,
        },
        username: {
            type: String,
            unique: true,
            sparse: true,
            trim: true,
            minlength: 3,
            maxlength: 25,
            match: /^[a-zA-Z0-9_]+$/,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        passwordHash: {
            type: String,
            select: false, // never return by default; load explicitly when needed
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        avatar: {
            type: String,
            default: null,
        },
        chessUsername: {
            type: String,
            default: null,
            trim: true,
        },
        role: {
            type: String,
            enum: ["user", "admin"],
            default: "user",
        },
        preferences: {
            favoriteOpenings: {
                type: [String],
                default: [],
            },
            savedPlayers: {
                type: [String],
                default: [],
            },
            theme: {
                type: String,
                enum: ["light", "dark"],
                default: "dark",
            },
        },
        refreshTokens: {
            type: [String],
            default: [],
        },
        lastLogin: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: true, // Automatically adds createdAt and updatedAt
    }
);

// Keep Google IDs unique only when they actually exist.
userSchema.index(
    { googleId: 1 },
    {
        unique: true,
        partialFilterExpression: {
            googleId: { $type: "string" },
        },
    }
);

// Indexes for better query performance
userSchema.index({ createdAt: -1 });

export const User = mongoose.model<IUser>("User", userSchema);
