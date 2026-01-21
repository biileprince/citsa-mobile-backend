import { Router } from "express";
import authRoutes from "./auth.routes.js";
import userRoutes from "./user.routes.js";
import feedRoutes from "./feed.routes.js";
import eventRoutes from "./event.routes.js";
import groupRoutes from "./group.routes.js";
import classroomRoutes from "./classroom.routes.js";
import notificationRoutes from "./notification.routes.js";

const router = Router();

// Health check
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "CITSA Backend API is running",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "1.0.0",
  });
});

// API Routes
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/feed", feedRoutes);
router.use("/events", eventRoutes);
router.use("/groups", groupRoutes);
router.use("/classrooms", classroomRoutes);
router.use("/notifications", notificationRoutes);

export default router;
