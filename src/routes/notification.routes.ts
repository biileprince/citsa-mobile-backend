import { Router } from "express";
import notificationController from "../controllers/notification.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import {
  validate,
  notificationIdValidation,
} from "../middleware/validation.middleware.js";

const router = Router();

/**
 * @route   GET /api/v1/notifications
 * @desc    Get user notifications
 * @access  Private
 */
router.get("/", authenticate, notificationController.getNotifications);

/**
 * @route   GET /api/v1/notifications/unread-count
 * @desc    Get unread notification count
 * @access  Private
 */
router.get(
  "/unread-count",
  authenticate,
  notificationController.getUnreadCount,
);

/**
 * @route   PUT /api/v1/notifications/read-all
 * @desc    Mark all notifications as read
 * @access  Private
 */
router.put("/read-all", authenticate, notificationController.markAllAsRead);

/**
 * @route   DELETE /api/v1/notifications/clear-read
 * @desc    Delete all read notifications
 * @access  Private
 */
router.delete(
  "/clear-read",
  authenticate,
  notificationController.clearReadNotifications,
);

/**
 * @route   PUT /api/v1/notifications/:id/read
 * @desc    Mark notification as read
 * @access  Private
 */
router.put(
  "/:id/read",
  authenticate,
  validate(notificationIdValidation),
  notificationController.markAsRead,
);

/**
 * @route   DELETE /api/v1/notifications/:id
 * @desc    Delete a notification
 * @access  Private
 */
router.delete(
  "/:id",
  authenticate,
  validate(notificationIdValidation),
  notificationController.deleteNotification,
);

export default router;
