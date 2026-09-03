import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request } from "express";

/**
 * Per-user rate limiter for the analysis endpoints. Identifies the user
 * by their JWT userId when present; otherwise by IP. This is the place to
 * tune the budget for write actions like /analysis and /analysis/:id/moves.
 */
export const analysisLimiter = rateLimit({
    windowMs: 60 * 1000,          // 1 minute
    limit: 60,                    // 60 req/min/user
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: (req: any) => {
        const userId = req.user?.userId;
        if (userId) return `u:${userId}`;
        // ipKeyGenerator handles IPv4 + IPv6 correctly per express-rate-limit v8
        return `ip:${ipKeyGenerator(req.ip as string)}`;
    },
    message: { error: "Too many analysis requests, please slow down." },
});

/**
 * Stricter limiter for the games archive proxy. Be polite to Chess.com
 * since a flood from one user could rate-limit the whole backend.
 */
export const gamesProxyLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 30,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: (req: Request) => `ip:${ipKeyGenerator(req.ip || "anon")}`,
    message: { error: "Too many game-archive requests, please slow down." },
});

/**
 * Strict limiter for register/login endpoints to slow down credential
 * stuffing and account enumeration. Per-IP, 10 attempts per 15 minutes.
 */
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: (req: Request) => `ip:${ipKeyGenerator(req.ip || "anon")}`,
    message: { error: "Too many auth attempts. Please try again later." },
});
