import { Request, Response } from "express";
import prisma from "../config/database.js";
import {
  sendSuccess,
  sendCreated,
  calculatePagination,
  parsePaginationParams,
  getParamAsString,
} from "../utils/helpers.js";
import {
  AuthenticatedRequest,
  NotificationQueryParams,
} from "../types/index.js";
import { asyncHandler, ApiError } from "../middleware/error.middleware.js";

/**
 * Get user notifications
 * GET /api/v1/notifications
 */
export const getNotifications = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const { page, limit, unreadOnly } = req.query as NotificationQueryParams;
    const pagination = parsePaginationParams(page, limit);

    const where: any = { userId };

    if (unreadOnly === "true") {
      where.isRead = false;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    const result = notifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      relatedEntityType: n.relatedEntityType,
      relatedEntityId: n.relatedEntityId,
      isRead: n.isRead,
      createdAt: n.createdAt,
    }));

    const paginationMeta = calculatePagination(
      pagination.page,
      pagination.limit,
      total,
    );

    sendSuccess(
      res,
      {
        notifications: result,
        unreadCount,
      },
      undefined,
      200,
      paginationMeta,
    );
  },
);

/**
 * Get unread notification count
 * GET /api/v1/notifications/unread-count
 */
export const getUnreadCount = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.userId;

    const count = await prisma.notification.count({
      where: { userId, isRead: false },
    });

    sendSuccess(res, { unreadCount: count });
  },
);

/**
 * Mark notification as read
 * PUT /api/v1/notifications/:id/read
 */
export const markAsRead = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const id = getParamAsString(req.params.id);
    const userId = req.user!.userId;

    const notification = await prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw ApiError.notFound("Notification not found");
    }

    if (notification.userId !== userId) {
      throw ApiError.forbidden(
        "You can only mark your own notifications as read",
      );
    }

    await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    sendSuccess(res, { isRead: true }, "Notification marked as read");
  },
);

/**
 * Mark all notifications as read
 * PUT /api/v1/notifications/read-all
 */
export const markAllAsRead = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.userId;

    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    sendSuccess(res, null, "All notifications marked as read");
  },
);

/**
 * Delete a notification
 * DELETE /api/v1/notifications/:id
 */
export const deleteNotification = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const id = getParamAsString(req.params.id);
    const userId = req.user!.userId;

    const notification = await prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw ApiError.notFound("Notification not found");
    }

    if (notification.userId !== userId) {
      throw ApiError.forbidden("You can only delete your own notifications");
    }

    await prisma.notification.delete({
      where: { id },
    });

    sendSuccess(res, null, "Notification deleted");
  },
);

/**
 * Delete all read notifications
 * DELETE /api/v1/notifications/clear-read
 */
export const clearReadNotifications = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.userId;

    const result = await prisma.notification.deleteMany({
      where: { userId, isRead: true },
    });

    sendSuccess(
      res,
      { deleted: result.count },
      `${result.count} notifications cleared`,
    );
  },
);

// ==================== ADMIN ENDPOINTS ====================

/**
 * Send notification to a specific user (Admin only)
 * POST /api/v1/notifications/send
 */
export const sendNotification = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const {
      userId,
      type,
      title,
      message,
      relatedEntityType,
      relatedEntityId,
    } = req.body;

    // Verify user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw ApiError.notFound("Target user not found");
    }

    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        relatedEntityType,
        relatedEntityId,
      },
    });

    sendCreated(
      res,
      {
        id: notification.id,
        userId: notification.userId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        createdAt: notification.createdAt,
      },
      "Notification sent successfully",
    );
  },
);

/**
 * Broadcast notification to all or filtered users (Admin only)
 * POST /api/v1/notifications/broadcast
 */
export const broadcastNotification = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { type, title, message, relatedEntityType, relatedEntityId, role } =
      req.body;

    // Build user filter
    const userWhere: any = { isActive: true };
    if (role && ["STUDENT", "CLASS_REP", "ADMIN"].includes(role)) {
      userWhere.role = role;
    }

    const users = await prisma.user.findMany({
      where: userWhere,
      select: { id: true },
    });

    if (users.length === 0) {
      throw ApiError.badRequest("No users match the filter criteria");
    }

    // Create notifications in bulk
    const notifications = users.map((user) => ({
      userId: user.id,
      type,
      title,
      message,
      relatedEntityType: relatedEntityType || null,
      relatedEntityId: relatedEntityId || null,
    }));

    const result = await prisma.notification.createMany({
      data: notifications,
    });

    sendCreated(
      res,
      {
        sentTo: result.count,
        filter: role || "ALL",
      },
      `Notification broadcast to ${result.count} users`,
    );
  },
);

export default {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearReadNotifications,
  sendNotification,
  broadcastNotification,
};
