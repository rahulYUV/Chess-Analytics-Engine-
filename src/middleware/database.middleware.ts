import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";

/** Reject database-backed requests before Mongoose buffers them for 10 seconds. */
export const databaseMiddleware = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    if (mongoose.connection.readyState !== 1) {
        res.status(503).json({
            error: "Database unavailable",
            message: "The server cannot reach MongoDB. Check the MongoDB Atlas network access list and connection string.",
        });
        return;
    }

    next();
};