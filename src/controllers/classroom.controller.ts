import { Request, Response } from "express";
import prisma from "../config/database.js";
import {
  sendSuccess,
  sendCreated,
  calculatePagination,
  parsePaginationParams,
} from "../utils/helpers.js";
import {
  AuthenticatedRequest,
  CreateAnnouncementRequest,
} from "../types/index.js";
import { asyncHandler, ApiError } from "../middleware/error.middleware.js";

/**
 * Transform classroom for API response
 */
function transformClassroom(classroom: any) {
  return {
    id: classroom.id,
    yearGroup: classroom.yearGroup,
    graduationYear: classroom.graduationYear,
    semester: classroom.semester,
    isActive: classroom.isActive,
    createdAt: classroom.createdAt,
    courses: classroom.courses?.map((course: any) => ({
      id: course.id,
      courseCode: course.courseCode,
      courseName: course.courseName,
      credits: course.credits,
    })),
    timetableSlots: classroom.timetableSlots?.map((slot: any) => ({
      id: slot.id,
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      room: slot.room,
      course: slot.course
        ? {
            id: slot.course.id,
            courseCode: slot.course.courseCode,
            courseName: slot.course.courseName,
          }
        : null,
    })),
  };
}

/**
 * Get all classrooms
 * GET /api/v1/classrooms
 */
export const getClassrooms = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { page, limit } = req.query as { page?: string; limit?: string };
    const pagination = parsePaginationParams(page, limit);

    const [classrooms, total] = await Promise.all([
      prisma.classroom.findMany({
        where: { isActive: true },
        orderBy: [{ graduationYear: "desc" }, { yearGroup: "asc" }],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.classroom.count({ where: { isActive: true } }),
    ]);

    const paginationMeta = calculatePagination(
      pagination.page,
      pagination.limit,
      total,
    );

    sendSuccess(res, classrooms, undefined, 200, paginationMeta);
  },
);

/**
 * Get classroom by ID with full details
 * GET /api/v1/classrooms/:id
 */
export const getClassroomById = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const classroom = await prisma.classroom.findUnique({
      where: { id },
      include: {
        courses: {
          include: {
            quizzes: {
              where: {
                quizDate: { gte: new Date() },
              },
              orderBy: { quizDate: "asc" },
            },
          },
        },
        timetableSlots: {
          include: {
            course: {
              select: {
                id: true,
                courseCode: true,
                courseName: true,
              },
            },
          },
          orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
        },
      },
    });

    if (!classroom) {
      throw ApiError.notFound("Classroom not found");
    }

    const result = {
      ...transformClassroom(classroom),
      courses: classroom.courses.map((course) => ({
        id: course.id,
        courseCode: course.courseCode,
        courseName: course.courseName,
        credits: course.credits,
        upcomingQuizzes: course.quizzes.map((quiz) => ({
          id: quiz.id,
          title: quiz.title,
          quizDate: quiz.quizDate,
          quizTime: quiz.quizTime,
        })),
      })),
    };

    sendSuccess(res, result);
  },
);

/**
 * Get classroom timetable
 * GET /api/v1/classrooms/:id/timetable
 */
export const getClassroomTimetable = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const classroom = await prisma.classroom.findUnique({
      where: { id },
      include: {
        timetableSlots: {
          include: {
            course: {
              select: {
                id: true,
                courseCode: true,
                courseName: true,
              },
            },
          },
          orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
        },
      },
    });

    if (!classroom) {
      throw ApiError.notFound("Classroom not found");
    }

    // Group by day of week
    const daysOrder = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ];
    const timetableByDay: Record<string, any[]> = {};

    for (const day of daysOrder) {
      timetableByDay[day] = [];
    }

    for (const slot of classroom.timetableSlots) {
      if (timetableByDay[slot.dayOfWeek]) {
        timetableByDay[slot.dayOfWeek].push({
          id: slot.id,
          startTime: slot.startTime,
          endTime: slot.endTime,
          room: slot.room,
          course: slot.course,
        });
      }
    }

    sendSuccess(res, timetableByDay);
  },
);

/**
 * Get classroom announcements
 * GET /api/v1/classrooms/:id/announcements
 */
export const getClassroomAnnouncements = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { page, limit } = req.query as { page?: string; limit?: string };
    const pagination = parsePaginationParams(page, limit);

    // Check classroom exists
    const classroom = await prisma.classroom.findUnique({ where: { id } });
    if (!classroom) {
      throw ApiError.notFound("Classroom not found");
    }

    const [announcements, total] = await Promise.all([
      prisma.classroomAnnouncement.findMany({
        where: { classroomId: id },
        include: {
          rep: {
            select: {
              id: true,
              fullName: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: [
          { isPinned: "desc" },
          { isUrgent: "desc" },
          { createdAt: "desc" },
        ],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.classroomAnnouncement.count({ where: { classroomId: id } }),
    ]);

    const result = announcements.map((a) => ({
      id: a.id,
      title: a.title,
      content: a.content,
      isPinned: a.isPinned,
      isUrgent: a.isUrgent,
      likesCount: a.likesCount,
      commentsCount: a.commentsCount,
      viewsCount: a.viewsCount,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
      author: a.rep,
    }));

    const paginationMeta = calculatePagination(
      pagination.page,
      pagination.limit,
      total,
    );

    sendSuccess(res, result, undefined, 200, paginationMeta);
  },
);

/**
 * Create classroom announcement (Class Rep only)
 * POST /api/v1/classrooms/:id/announcements
 */
export const createAnnouncement = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = req.user!.userId;
    const data = req.body as CreateAnnouncementRequest;

    // Check classroom exists
    const classroom = await prisma.classroom.findUnique({ where: { id } });
    if (!classroom) {
      throw ApiError.notFound("Classroom not found");
    }

    // Create announcement
    const announcement = await prisma.classroomAnnouncement.create({
      data: {
        classroomId: id,
        repId: userId,
        title: data.title,
        content: data.content,
        isPinned: data.isPinned || false,
        isUrgent: data.isUrgent || false,
      },
      include: {
        rep: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
          },
        },
      },
    });

    // TODO: If urgent, create notifications for all students in the classroom

    sendCreated(
      res,
      {
        id: announcement.id,
        title: announcement.title,
        content: announcement.content,
        isPinned: announcement.isPinned,
        isUrgent: announcement.isUrgent,
        createdAt: announcement.createdAt,
        author: announcement.rep,
      },
      "Announcement created successfully",
    );
  },
);

/**
 * Update classroom announcement (Class Rep only)
 * PUT /api/v1/classrooms/:id/announcements/:announcementId
 */
export const updateAnnouncement = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id, announcementId } = req.params;
    const userId = req.user!.userId;
    const data = req.body as Partial<CreateAnnouncementRequest>;

    // Check announcement exists and belongs to user
    const announcement = await prisma.classroomAnnouncement.findUnique({
      where: { id: announcementId },
    });

    if (!announcement) {
      throw ApiError.notFound("Announcement not found");
    }

    if (announcement.classroomId !== id) {
      throw ApiError.badRequest(
        "Announcement does not belong to this classroom",
      );
    }

    // Check if user is the author or admin
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (announcement.repId !== userId && user?.role !== "ADMIN") {
      throw ApiError.forbidden("You can only edit your own announcements");
    }

    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.content !== undefined) updateData.content = data.content;
    if (data.isPinned !== undefined) updateData.isPinned = data.isPinned;
    if (data.isUrgent !== undefined) updateData.isUrgent = data.isUrgent;

    const updated = await prisma.classroomAnnouncement.update({
      where: { id: announcementId },
      data: updateData,
      include: {
        rep: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
          },
        },
      },
    });

    sendSuccess(
      res,
      {
        id: updated.id,
        title: updated.title,
        content: updated.content,
        isPinned: updated.isPinned,
        isUrgent: updated.isUrgent,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
        author: updated.rep,
      },
      "Announcement updated successfully",
    );
  },
);

/**
 * Delete classroom announcement (Class Rep only)
 * DELETE /api/v1/classrooms/:id/announcements/:announcementId
 */
export const deleteAnnouncement = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id, announcementId } = req.params;
    const userId = req.user!.userId;

    // Check announcement exists
    const announcement = await prisma.classroomAnnouncement.findUnique({
      where: { id: announcementId },
    });

    if (!announcement) {
      throw ApiError.notFound("Announcement not found");
    }

    if (announcement.classroomId !== id) {
      throw ApiError.badRequest(
        "Announcement does not belong to this classroom",
      );
    }

    // Check if user is the author or admin
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (announcement.repId !== userId && user?.role !== "ADMIN") {
      throw ApiError.forbidden("You can only delete your own announcements");
    }

    await prisma.classroomAnnouncement.delete({
      where: { id: announcementId },
    });

    sendSuccess(res, null, "Announcement deleted successfully");
  },
);

/**
 * Get upcoming quizzes for a classroom
 * GET /api/v1/classrooms/:id/quizzes
 */
export const getClassroomQuizzes = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { page, limit } = req.query as { page?: string; limit?: string };
    const pagination = parsePaginationParams(page, limit);

    // Check classroom exists
    const classroom = await prisma.classroom.findUnique({ where: { id } });
    if (!classroom) {
      throw ApiError.notFound("Classroom not found");
    }

    const [quizzes, total] = await Promise.all([
      prisma.quiz.findMany({
        where: {
          course: { classroomId: id },
          quizDate: { gte: new Date() },
        },
        include: {
          course: {
            select: {
              id: true,
              courseCode: true,
              courseName: true,
            },
          },
        },
        orderBy: { quizDate: "asc" },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.quiz.count({
        where: {
          course: { classroomId: id },
          quizDate: { gte: new Date() },
        },
      }),
    ]);

    const result = quizzes.map((q) => ({
      id: q.id,
      title: q.title,
      quizDate: q.quizDate,
      quizTime: q.quizTime,
      course: q.course,
    }));

    const paginationMeta = calculatePagination(
      pagination.page,
      pagination.limit,
      total,
    );

    sendSuccess(res, result, undefined, 200, paginationMeta);
  },
);

export default {
  getClassrooms,
  getClassroomById,
  getClassroomTimetable,
  getClassroomAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  getClassroomQuizzes,
};
