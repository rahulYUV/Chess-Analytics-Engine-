import mongoose from "mongoose";
import dotenv from "dotenv";
import { User } from "../models/User";

dotenv.config();

export const connectDB = async () => {
    const MONGODB_URI = process.env.MONGODB_URI || "";

    if (!MONGODB_URI) {
        console.warn("MongoDB URI is missing. Database operations will fail.");
    } else {
        try {
            await mongoose.connect(MONGODB_URI);
            await User.updateMany({ googleId: null }, { $unset: { googleId: "" } });
            await User.syncIndexes();
            console.log("Connected to MongoDB");
        } catch (err: any) {
            console.error("MongoDB connection failed (Server running without DB):", err.message);
        }
    }
};
