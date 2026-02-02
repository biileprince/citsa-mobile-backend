import { Request, Response } from "express";
import prisma from "../config/database.js";
import {
  sendSuccess,
  safeJsonParse,
  calculatePagination,
  parsePaginationParams,
} from "../utils/helpers.js";
import {
  AuthenticatedRequest,
  EventQueryParams,
  ErrorCodes,
} from "../types/index.js";
import { asyncHandler, ApiError } from "../middleware/error.middleware.js";

/**
 * Transform event for API response
 */
function transformEvent(event: any, userId?: string) {
  return {
    id: event.id,
    postId: event.postId,
    eventDate: event.eventDate,
    eventTime: event.eventTime,
    location: event.location,
    capacityMax: event.capacityMax,
    capacityCurrent: event.capacityCurrent,
    registrationDeadline: event.registrationDeadline,
    tags: safeJsonParse(event.tags, []),
    isUrgent: event.isUrgent,
    createdAt: event.createdAt,
    post: event.post
      ? {
          id: event.post.id,
          title: event.post.title,
          content: event.post.content,
          imageUrl: event.post.imageUrl,
          likesCount: event.post.likesCount,
          commentsCount: event.post.commentsCount,
          author: event.post.author
            ? {
                id: event.post.author.id,
                fullName: event.post.author.fullName,
                avatarUrl: event.post.author.avatarUrl,
              }
            : null,
        }
      : null,
    isRegistered: userId
      ? event.registrations && event.registrations.length > 0
      : false,
    isFull: event.capacityCurrent >= event.capacityMax,
    spotsRemaining: Math.max(0, event.capacityMax - event.capacityCurrent),
  };
}

/**
 * Get all events with filtering and pagination
 * GET /api/v1/events
 */
export const getEvents = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { page, limit, search, upcoming } = req.query as EventQueryParams;
    const userId = req.user?.userId;
    const pagination = parsePaginationParams(page, limit);

    const where: any = {};

    // Filter for upcoming events
    if (upcoming === "true") {
      where.eventDate = { gte: new Date() };
    }

    // Search in post title/content
    if (search) {
      where.post = {
        OR: [
          { title: { contains: search } },
          { content: { contains: search } },
        ],
      };
    }

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        include: {
          post: {
            include: {
              author: {
                select: {
                  id: true,
                  fullName: true,
                  avatarUrl: true,
                },
              },
            },
          },
          registrations: userId
            ? {
                where: {
                  userId,
                  status: "REGISTERED",
                },
                select: { userId: true, status: true },
              }
            : false,
        },
        orderBy: [{ isUrgent: "desc" }, { eventDate: "asc" }],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.event.count({ where }),
    ]);

    const transformedEvents = events.map((event) =>
      transformEvent(event, userId),
    );
    const paginationMeta = calculatePagination(
      pagination.page,
      pagination.limit,
      total,
    );

    sendSuccess(res, transformedEvents, undefined, 200, paginationMeta);
  },
);

/**
 * Get single event by ID
 * GET /api/v1/events/:id
 */
export const getEventById = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = req.user?.userId;

    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        post: {
          include: {
            author: {
              select: {
                id: true,
                fullName: true,
                avatarUrl: true,
                role: true,
              },
            },
          },
        },
        registrations: userId
          ? {
              where: {
                userId,
                status: "REGISTERED",
              },
              select: { userId: true, status: true },
            }
          : false,
      },
    });

    if (!event) {
      throw ApiError.notFound("Event not found");
    }

    sendSuccess(res, transformEvent(event, userId));
  },
);

/**
 * Register for an event
 * POST /api/v1/events/:id/register
 */
export const registerForEvent = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = req.user!.userId;

    // Fetch event with current registration count
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        post: {
          select: { title: true },
        },
      },
    });

    if (!event) {
      throw ApiError.notFound("Event not found");
    }

    // Check registration deadline
    if (event.registrationDeadline && new Date() > event.registrationDeadline) {
      throw new ApiError(
        400,
        ErrorCodes.REGISTRATION_CLOSED,
        "Registration deadline has passed",
      );
    }

    // Check capacity
    if (event.capacityCurrent >= event.capacityMax) {
      throw new ApiError(
        400,
        ErrorCodes.EVENT_FULL,
        "Event is at full capacity",
      );
    }

    // Check if already registered
    const existingRegistration = await prisma.eventRegistration.findUnique({
      where: {
        eventId_userId: { eventId: id, userId },
      },
    });

    if (existingRegistration) {
      if (existingRegistration.status === "REGISTERED") {
        throw new ApiError(
          400,
          ErrorCodes.ALREADY_REGISTERED,
          "You are already registered for this event",
        );
      }
      // If previously cancelled, update status
      await prisma.$transaction([
        prisma.eventRegistration.update({
          where: { id: existingRegistration.id },
          data: { status: "REGISTERED", registeredAt: new Date() },
        }),
        prisma.event.update({
          where: { id },
          data: { capacityCurrent: { increment: 1 } },
        }),
      ]);
    } else {
      // Create new registration
      await prisma.$transaction([
        prisma.eventRegistration.create({
          data: {
            eventId: id,
            userId,
            status: "REGISTERED",
          },
        }),
        prisma.event.update({
          where: { id },
          data: { capacityCurrent: { increment: 1 } },
        }),
      ]);
    }

    // Create notification
    await prisma.notification.create({
      data: {
        userId,
        type: "EVENT_REMINDER",
        title: "Event Registration Confirmed",
        message: `You have successfully registered for "${event.post?.title || "an event"}"`,
        relatedEntityType: "event",
        relatedEntityId: id,
      },
    });

    // Fetch updated event
    const updatedEvent = await prisma.event.findUnique({
      where: { id },
      include: {
        post: {
          include: {
            author: {
              select: {
                id: true,
                fullName: true,
                avatarUrl: true,
              },
            },
          },
        },
        registrations: {
          where: {
            userId,
            status: "REGISTERED",
          },
          select: { userId: true, status: true },
        },
      },
    });

    sendSuccess(
      res,
      transformEvent(updatedEvent, userId),
      "Successfully registered for event",
    );
  },
);

/**
 * Cancel event registration
 * DELETE /api/v1/events/:id/register
 */
export const cancelRegistration = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = req.user!.userId;

    // Check registration exists
    const registration = await prisma.eventRegistration.findUnique({
      where: {
        eventId_userId: { eventId: id, userId },
      },
    });

    if (!registration || registration.status !== "REGISTERED") {
      throw ApiError.notFound("Registration not found");
    }

    // Update registration status and decrement count
    await prisma.$transaction([
      prisma.eventRegistration.update({
        where: { id: registration.id },
        data: { status: "CANCELLED" },
      }),
      prisma.event.update({
        where: { id },
        data: { capacityCurrent: { decrement: 1 } },
      }),
    ]);

    sendSuccess(res, { registered: false }, "Registration cancelled");
  },
);

/**
 * Get user's registered events
 * GET /api/v1/events/my-registrations
 */
export const getMyRegistrations = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const { page, limit, upcoming } = req.query as EventQueryParams;
    const pagination = parsePaginationParams(page, limit);

    const where: any = {
      userId,
      status: "REGISTERED",
    };

    if (upcoming === "true") {
      where.event = {
        eventDate: { gte: new Date() },
      };
    }

    const [registrations, total] = await Promise.all([
      prisma.eventRegistration.findMany({
        where,
        include: {
          event: {
            include: {
              post: {
                include: {
                  author: {
                    select: {
                      id: true,
                      fullName: true,
                      avatarUrl: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { event: { eventDate: "asc" } },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.eventRegistration.count({ where }),
    ]);

    const events = registrations.map((reg) => ({
      ...transformEvent(reg.event, userId),
      registeredAt: reg.registeredAt,
      isRegistered: true,
    }));

    const paginationMeta = calculatePagination(
      pagination.page,
      pagination.limit,
      total,
    );

    sendSuccess(res, events, undefined, 200, paginationMeta);
  },
);

export default {
  getEvents,
  getEventById,
  registerForEvent,
  cancelRegistration,
  getMyRegistrations,
};
