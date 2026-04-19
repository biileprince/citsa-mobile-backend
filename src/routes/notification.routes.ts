import { Router } from "express";
import notificationController from "../controllers/notification.controller.js";
import { authenticate, requireAdmin } from "../middleware/auth.middleware.js";
import {
  validate,
  notificationIdValidation,
  sendNotificationValidation,
  broadcastNotificationValidation,
  registerDeviceTokenValidation,
  unregisterDeviceTokenValidation,
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
 * @route   POST /api/v1/notifications/devices/register
 * @desc    Register a push device token
 * @access  Private
 */
router.post(
  "/devices/register",
  authenticate,
  validate(registerDeviceTokenValidation),
  notificationController.registerDeviceToken,
);

/**
 * @route   DELETE /api/v1/notifications/devices/unregister
 * @desc    Unregister a push device token
 * @access  Private
 */
router.delete(
  "/devices/unregister",
  authenticate,
  validate(unregisterDeviceTokenValidation),
  notificationController.unregisterDeviceToken,
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

// ==================== ADMIN ROUTES ====================

/**
 * @route   POST /api/v1/notifications/send
 * @desc    Send notification to specific user (Admin only)
 * @access  Private (Admin)
 */
router.post(
  "/send",
  authenticate,
  requireAdmin,
  validate(sendNotificationValidation),
  notificationController.sendNotification,
);

/**
 * @route   POST /api/v1/notifications/broadcast
 * @desc    Broadcast notification to all/filtered users (Admin only)
 * @access  Private (Admin)
 */
router.post(
  "/broadcast",
  authenticate,
  requireAdmin,
  validate(broadcastNotificationValidation),
  notificationController.broadcastNotification,
);

export default router;
