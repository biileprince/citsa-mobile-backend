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
    program: classroom.program,
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
 * Create new classroom (Admin only)
 * POST /api/v1/classrooms
 */
export const createClassroom = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { yearGroup, graduationYear, semester, program, isActive } = req.body;

    // Check if classroom already exists
    const existing = await prisma.classroom.findFirst({
      where: {
        yearGroup,
        semester: semester.toString(),
        program,
      },
    });

    if (existing) {
      throw ApiError.conflict(
        `Classroom for ${yearGroup} ${program} Semester ${semester} already exists`,
      );
    }

    const classroom = await prisma.classroom.create({
      data: {
        yearGroup,
        graduationYear: graduationYear.toString(),
        semester: semester.toString(),
        program,
        isActive: isActive ?? true,
      },
    });

    sendCreated(res, classroom, "Classroom created successfully");
  },
);

/**
 * Get all classrooms
 * GET /api/v1/classrooms?program=COMPUTER_SCIENCE
 */
export const getClassrooms = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { page, limit, program } = req.query as {
      page?: string;
      limit?: string;
      program?: string;
    };
    const pagination = parsePaginationParams(page, limit);

    const where: any = { isActive: true };
    if (
      program &&
      ["COMPUTER_SCIENCE", "INFORMATION_TECHNOLOGY"].includes(program)
    ) {
      where.program = program;
    }

    const [classrooms, total] = await Promise.all([
      prisma.classroom.findMany({
        where,
        orderBy: [{ graduationYear: "desc" }, { yearGroup: "asc" }],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.classroom.count({ where }),
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
    const id = getParamAsString(req.params.id);

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
    const id = getParamAsString(req.params.id);

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
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const id = getParamAsString(req.params.id);
    const userId = req.user?.userId;
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
          likes: userId
            ? { where: { userId }, select: { id: true } }
            : false,
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

    const result = announcements.map((a: any) => ({
      id: a.id,
      title: a.title,
      content: a.content,
      isPinned: a.isPinned,
      isUrgent: a.isUrgent,
      likesCount: a.likesCount,
      commentsCount: a.commentsCount,
      viewsCount: a.viewsCount,
      isLiked: a.likes ? a.likes.length > 0 : false,
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
    const id = getParamAsString(req.params.id);
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
    const id = getParamAsString(req.params.id);
    const announcementId = getParamAsString(req.params.announcementId);
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
    const id = getParamAsString(req.params.id);
    const announcementId = getParamAsString(req.params.announcementId);
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

// ==================== ANNOUNCEMENT INTERACTIONS ====================

/**
 * Like an announcement
 * POST /api/v1/classrooms/:id/announcements/:announcementId/like
 */
export const likeAnnouncement = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const id = getParamAsString(req.params.id);
    const announcementId = getParamAsString(req.params.announcementId);
    const userId = req.user!.userId;

    // Check announcement exists and belongs to classroom
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

    // Check if already liked
    const existingLike = await prisma.announcementLike.findUnique({
      where: {
        announcementId_userId: {
          announcementId,
          userId,
        },
      },
    });

    if (existingLike) {
      throw ApiError.conflict("You have already liked this announcement");
    }

    // Create like and increment count
    await prisma.$transaction([
      prisma.announcementLike.create({
        data: {
          announcementId,
          userId,
        },
      }),
      prisma.classroomAnnouncement.update({
        where: { id: announcementId },
        data: { likesCount: { increment: 1 } },
      }),
    ]);

    sendSuccess(res, { liked: true }, "Announcement liked successfully");
  },
);

/**
 * Unlike an announcement
 * DELETE /api/v1/classrooms/:id/announcements/:announcementId/like
 */
export const unlikeAnnouncement = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const id = getParamAsString(req.params.id);
    const announcementId = getParamAsString(req.params.announcementId);
    const userId = req.user!.userId;

    // Check announcement exists and belongs to classroom
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

    // Delete like and decrement count
    const deleted = await prisma.announcementLike.deleteMany({
      where: {
        announcementId,
        userId,
      },
    });

    if (deleted.count > 0) {
      await prisma.classroomAnnouncement.update({
        where: { id: announcementId },
        data: { likesCount: { decrement: 1 } },
      });
    }

    sendSuccess(res, { liked: false }, "Announcement unliked");
  },
);

/**
 * Add comment to announcement (no replies, no reactions)
 * POST /api/v1/classrooms/:id/announcements/:announcementId/comments
 */
export const addAnnouncementComment = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const id = getParamAsString(req.params.id);
    const announcementId = getParamAsString(req.params.announcementId);
    const userId = req.user!.userId;
    const { content } = req.body;

    // Check announcement exists and belongs to classroom
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

    // Create comment and increment count
    const comment = await prisma.announcementComment.create({
      data: {
        announcementId,
        userId,
        content,
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
          },
        },
      },
    });

    await prisma.classroomAnnouncement.update({
      where: { id: announcementId },
      data: { commentsCount: { increment: 1 } },
    });

    // Notify announcement author
    if (announcement.repId && announcement.repId !== userId) {
      const commenter = await prisma.user.findUnique({
        where: { id: userId },
        select: { fullName: true },
      });

      await prisma.notification.create({
        data: {
          userId: announcement.repId,
          type: "COMMENT",
          title: "New Comment",
          message: `${commenter?.fullName || "Someone"} commented on your announcement "${announcement.title}"`,
          relatedEntityType: "announcement",
          relatedEntityId: announcementId,
        },
      });
    }

    sendCreated(
      res,
      {
        id: comment.id,
        content: comment.content,
        createdAt: comment.createdAt,
        user: comment.user,
      },
      "Comment added successfully",
    );
  },
);

/**
 * Get comments for an announcement
 * GET /api/v1/classrooms/:id/announcements/:announcementId/comments
 */
export const getAnnouncementComments = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const id = getParamAsString(req.params.id);
    const announcementId = getParamAsString(req.params.announcementId);
    const { page, limit } = req.query as { page?: string; limit?: string };
    const pagination = parsePaginationParams(page, limit);

    // Check announcement exists and belongs to classroom
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

    const [comments, total] = await Promise.all([
      prisma.announcementComment.findMany({
        where: { announcementId },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.announcementComment.count({ where: { announcementId } }),
    ]);

    const result = comments.map((c) => ({
      id: c.id,
      content: c.content,
      createdAt: c.createdAt,
      user: c.user,
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
 * Delete a comment on an announcement (own comment or admin)
 * DELETE /api/v1/classrooms/:id/announcements/:announcementId/comments/:commentId
 */
export const deleteAnnouncementComment = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const id = getParamAsString(req.params.id);
    const announcementId = getParamAsString(req.params.announcementId);
    const commentId = getParamAsString(req.params.commentId);
    const userId = req.user!.userId;

    // Check comment exists
    const comment = await prisma.announcementComment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw ApiError.notFound("Comment not found");
    }

    if (comment.announcementId !== announcementId) {
      throw ApiError.badRequest(
        "Comment does not belong to this announcement",
      );
    }

    // Check if user is the author or admin
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (comment.userId !== userId && user?.role !== "ADMIN") {
      throw ApiError.forbidden("You can only delete your own comments");
    }

    await prisma.announcementComment.delete({ where: { id: commentId } });

    // Decrement count
    await prisma.classroomAnnouncement.update({
      where: { id: announcementId },
      data: { commentsCount: { decrement: 1 } },
    });

    sendSuccess(res, null, "Comment deleted successfully");
  },
);

/**
 * Record a view on an announcement (unique per user)
 * POST /api/v1/classrooms/:id/announcements/:announcementId/view
 */
export const viewAnnouncement = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const id = getParamAsString(req.params.id);
    const announcementId = getParamAsString(req.params.announcementId);
    const userId = req.user!.userId;

    // Check announcement exists and belongs to classroom
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

    // Check if already viewed (unique view per user)
    const existingView = await prisma.announcementView.findUnique({
      where: {
        announcementId_userId: {
          announcementId,
          userId,
        },
      },
    });

    if (!existingView) {
      // First view — create record and increment count
      await prisma.$transaction([
        prisma.announcementView.create({
          data: {
            announcementId,
            userId,
          },
        }),
        prisma.classroomAnnouncement.update({
          where: { id: announcementId },
          data: { viewsCount: { increment: 1 } },
        }),
      ]);
    }

    sendSuccess(
      res,
      { viewed: true, viewsCount: announcement.viewsCount + (existingView ? 0 : 1) },
      "View recorded",
    );
  },
);

/**
 * Get upcoming quizzes for a classroom
 * GET /api/v1/classrooms/:id/quizzes
 */
export const getClassroomQuizzes = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const id = getParamAsString(req.params.id);
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

// ==================== ADMIN ENDPOINTS ====================

/**
 * Update classroom (Admin only)
 * PUT /api/v1/classrooms/:id
 */
export const updateClassroom = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const id = getParamAsString(req.params.id);
    const { yearGroup, graduationYear, semester, program, isActive } = req.body;

    const classroom = await prisma.classroom.findUnique({ where: { id } });
    if (!classroom) {
      throw ApiError.notFound("Classroom not found");
    }

    const updateData: any = {};
    if (yearGroup !== undefined) updateData.yearGroup = yearGroup;
    if (graduationYear !== undefined)
      updateData.graduationYear = graduationYear.toString();
    if (semester !== undefined) updateData.semester = semester.toString();
    if (program !== undefined) updateData.program = program;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updatedClassroom = await prisma.classroom.update({
      where: { id },
      data: updateData,
      include: {
        courses: true,
        timetableSlots: {
          include: {
            course: {
              select: { id: true, courseCode: true, courseName: true },
            },
          },
        },
      },
    });

    sendSuccess(
      res,
      transformClassroom(updatedClassroom),
      "Classroom updated successfully",
    );
  },
);

/**
 * Delete classroom (Admin only)
 * DELETE /api/v1/classrooms/:id
 */
export const deleteClassroom = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const id = getParamAsString(req.params.id);

    const classroom = await prisma.classroom.findUnique({ where: { id } });
    if (!classroom) {
      throw ApiError.notFound("Classroom not found");
    }

    // Cascade delete handles courses, timetable slots, announcements, quizzes
    await prisma.classroom.delete({ where: { id } });

    sendSuccess(res, null, "Classroom deleted successfully");
  },
);

/**
 * Add course to classroom (Admin only)
 * POST /api/v1/classrooms/:id/courses
 */
export const addCourse = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const classroomId = getParamAsString(req.params.id);
    const { courseCode, courseName, credits } = req.body;

    const classroom = await prisma.classroom.findUnique({
      where: { id: classroomId },
    });
    if (!classroom) {
      throw ApiError.notFound("Classroom not found");
    }

    // Check for duplicate course code in this classroom
    const existing = await prisma.course.findFirst({
      where: { classroomId, courseCode },
    });
    if (existing) {
      throw ApiError.conflict(
        `Course ${courseCode} already exists in this classroom`,
      );
    }

    const course = await prisma.course.create({
      data: {
        classroomId,
        courseCode,
        courseName,
        credits,
      },
    });

    sendCreated(
      res,
      {
        id: course.id,
        courseCode: course.courseCode,
        courseName: course.courseName,
        credits: course.credits,
      },
      "Course added successfully",
    );
  },
);

/**
 * Add timetable slot to classroom (Admin only)
 * POST /api/v1/classrooms/:id/timetable
 */
export const addTimetableSlot = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const classroomId = getParamAsString(req.params.id);
    const { courseId, dayOfWeek, startTime, endTime, room } = req.body;

    const classroom = await prisma.classroom.findUnique({
      where: { id: classroomId },
    });
    if (!classroom) {
      throw ApiError.notFound("Classroom not found");
    }

    // Verify the course belongs to this classroom
    const course = await prisma.course.findFirst({
      where: { id: courseId, classroomId },
    });
    if (!course) {
      throw ApiError.notFound("Course not found in this classroom");
    }

    const slot = await prisma.timetableSlot.create({
      data: {
        classroomId,
        courseId,
        dayOfWeek,
        startTime,
        endTime,
        room,
      },
      include: {
        course: {
          select: { id: true, courseCode: true, courseName: true },
        },
      },
    });

    sendCreated(
      res,
      {
        id: slot.id,
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
        room: slot.room,
        course: slot.course,
      },
      "Timetable slot added successfully",
    );
  },
);

/**
 * Add quiz to classroom (Admin only)
 * POST /api/v1/classrooms/:id/quizzes
 */
export const addQuiz = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const classroomId = getParamAsString(req.params.id);
    const { courseId, title, quizDate, quizTime } = req.body;

    const classroom = await prisma.classroom.findUnique({
      where: { id: classroomId },
    });
    if (!classroom) {
      throw ApiError.notFound("Classroom not found");
    }

    // Verify the course belongs to this classroom
    const course = await prisma.course.findFirst({
      where: { id: courseId, classroomId },
    });
    if (!course) {
      throw ApiError.notFound("Course not found in this classroom");
    }

    const quiz = await prisma.quiz.create({
      data: {
        courseId,
        title,
        quizDate: new Date(quizDate),
        quizTime,
      },
      include: {
        course: {
          select: { id: true, courseCode: true, courseName: true },
        },
      },
    });

    sendCreated(
      res,
      {
        id: quiz.id,
        title: quiz.title,
        quizDate: quiz.quizDate,
        quizTime: quiz.quizTime,
        course: quiz.course,
      },
      "Quiz added successfully",
    );
  },
);

export default {
  createClassroom,
  getClassrooms,
  getClassroomById,
  getClassroomTimetable,
  getClassroomAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  likeAnnouncement,
  unlikeAnnouncement,
  addAnnouncementComment,
  getAnnouncementComments,
  deleteAnnouncementComment,
  viewAnnouncement,
  getClassroomQuizzes,
  updateClassroom,
  deleteClassroom,
  addCourse,
  addTimetableSlot,
  addQuiz,
};
