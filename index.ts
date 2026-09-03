import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import passport from "passport";
import cookieParser from "cookie-parser";
import { connectDB } from "./src/config/db";
import { configurePassport } from "./src/config/passport.config";
import routes from "./src/routes";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Connect to Database
connectDB();

// Configure Passport
configurePassport();

// Middleware
app.use(
    cors({
        origin: process.env.CLIENT_URL || "http://localhost:5173",
        credentials: true,
    })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(passport.initialize());

// Routes
app.use(routes);

app.use((req, res) => {
    res.status(404).json({ error: "Route not found" });
});

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Unhandled Error:", err?.message || err);
    if (err?.stack) console.error(err.stack);
    res.status(500).json({
        error: "Internal Server Error",
        message: err?.message || "Unknown error",
    });
});

const server = app.listen(port, () => {
    console.log(`Chess Stats API listening on port ${port}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
    console.log(`Auth enabled: Google OAuth`);
});

// Graceful Shutdown
const shutdown = () => {
    console.log("Shutting down server...");
    server.close(() => {
        console.log("Server closed.");
        process.exit(0);
    });
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

export default app;
