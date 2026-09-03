import { Router } from "express";
import passport from "passport";
import { AuthController } from "../controllers/auth.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { databaseMiddleware } from "../middleware/database.middleware";
import { authLimiter } from "../middleware/rate-limit.middleware";

const router = Router();

// Auth operations require MongoDB and should fail immediately if it is unavailable.
router.use(databaseMiddleware);

/**
 * @route   GET /auth/google
 * @desc    Initiate Google OAuth flow (both signup & login)
 * @access  Public
 */
router.get(
    "/google",
    authLimiter,
    passport.authenticate("google", {
        scope: ["profile", "email"],
        session: false, // We're using JWT, not sessions
        prompt: "select_account",
    })
);

/**
 * @route   GET /auth/google/callback
 * @desc    Google OAuth callback URL
 * @access  Public
 */
router.get(
    "/google/callback",
    passport.authenticate("google", {
        session: false,
        failureRedirect: `${process.env.CLIENT_URL}/auth/error`,
    }),
    AuthController.googleCallback
);

/**
 * @route   POST /auth/register
 * @desc    Register a new user with email + password. Auto-signs in.
 * @access  Public
 */
router.post("/register", authLimiter, AuthController.register);
router.post("/signup", authLimiter, AuthController.register);

/**
 * @route   POST /auth/login
 * @desc    Log in with email + password. Issues JWT pair.
 * @access  Public
 */
router.post("/login", authLimiter, AuthController.login);
router.post("/signin", authLimiter, AuthController.login);

/**
 * @route   POST /auth/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public
 */
router.post("/refresh", AuthController.refreshToken);

/**
 * @route   POST /auth/logout
 * @desc    Logout from current device
 * @access  Private
 */
router.post("/logout", authMiddleware, AuthController.logout);

/**
 * @route   POST /auth/logout-all
 * @desc    Logout from all devices
 * @access  Private
 */
router.post("/logout-all", authMiddleware, AuthController.logoutAll);

/**
 * @route   GET /auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get("/me", authMiddleware, AuthController.getCurrentUser);

/**
 * @route   PUT /auth/me
 * @desc    Update user profile
 * @access  Private
 */
router.put("/me", authMiddleware, AuthController.updateProfile);

/**
 * @route   DELETE /auth/me
 * @desc    Delete user account
 * @access  Private
 */
router.delete("/me", authMiddleware, AuthController.deleteAccount);

/**
 * @route   POST /auth/link-chess-account
 * @desc    Link Chess.com account to user profile
 * @access  Private
 */
router.post("/link-chess-account", authMiddleware, AuthController.linkChessComAccount);

export default router;
