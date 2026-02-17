import { Request, Response } from "express";
import prisma from "../config/database.js";
import {
  sendSuccess,
  sendError,
  safeJsonParse,
  calculatePagination,
  parsePaginationParams,
  getParamAsString,
} from "../utils/helpers.js";
import {
  AuthenticatedRequest,
  ErrorCodes,
  ProfileSetupRequest,
  ProfileUpdateRequest,
  UserProfile,
} from "../types/index.js";
import { asyncHandler, ApiError } from "../middleware/error.middleware.js";
import { uploadFile, deleteFileByUrl } from "../services/storage.service.js";

/**
 * Transform user from database to UserProfile
 */
function transformUser(user: any): UserProfile {
  return {
    id: user.id,
    studentId: user.studentId,
    email: user.email,
    fullName: user.fullName,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    program: user.program,
    classYear: user.classYear,
    skills: safeJsonParse(user.skills, []),
    interests: safeJsonParse(user.interests, []),
    portfolioUrl: user.portfolioUrl,
    role: user.role,
    isVerified: user.isVerified,
    createdAt: user.createdAt,
  };
}

/**
 * Get current user profile
 * GET /api/v1/users/profile
 */
export const getMyProfile = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw ApiError.notFound("User not found");
    }

    sendSuccess(res, transformUser(user));
  },
);

/**
 * Get user profile by ID
 * GET /api/v1/users/profile/:userId
 */
export const getUserProfile = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = getParamAsString(req.params.userId);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        studentId: true,
        email: true,
        fullName: true,
        bio: true,
        avatarUrl: true,
        program: true,
        classYear: true,
        skills: true,
        interests: true,
        portfolioUrl: true,
        role: true,
        isVerified: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw ApiError.notFound("User not found");
    }

    // Mask email for privacy (unless viewing own profile)
    const authReq = req as AuthenticatedRequest;
    const isOwnProfile = authReq.user?.userId === userId;

    const profile = transformUser(user);
    if (!isOwnProfile) {
      profile.email = profile.email.replace(/^(.{3}).*(@.*)$/, "$1****$2");
    }

    sendSuccess(res, profile);
  },
);

/**
 * Setup profile (first time after registration)
 * POST /api/v1/users/profile/setup
 */
export const setupProfile = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const data = req.body as ProfileSetupRequest;

    // Check if profile is already set up
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      throw ApiError.notFound("User not found");
    }

    if (existingUser.fullName) {
      throw ApiError.conflict(
        "Profile is already set up. Use update endpoint instead.",
      );
    }

    // Update user profile
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        fullName: data.fullName,
        bio: data.bio,
        program: data.program,
        classYear: data.classYear,
        skills: data.skills ? JSON.stringify(data.skills) : undefined,
        interests: data.interests ? JSON.stringify(data.interests) : undefined,
        portfolioUrl: data.portfolioUrl,
      },
    });

    sendSuccess(res, transformUser(updatedUser), "Profile setup completed");
  },
);

/**
 * Update user profile
 * PUT /api/v1/users/profile
 */
export const updateProfile = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const data = req.body as ProfileUpdateRequest;

    const updateData: any = {};

    if (data.fullName !== undefined) updateData.fullName = data.fullName;
    if (data.bio !== undefined) updateData.bio = data.bio;
    if (data.program !== undefined) updateData.program = data.program;
    if (data.classYear !== undefined) updateData.classYear = data.classYear;
    if (data.skills !== undefined)
      updateData.skills = JSON.stringify(data.skills);
    if (data.interests !== undefined)
      updateData.interests = JSON.stringify(data.interests);
    if (data.portfolioUrl !== undefined)
      updateData.portfolioUrl = data.portfolioUrl;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    sendSuccess(
      res,
      transformUser(updatedUser),
      "Profile updated successfully",
    );
  },
);

/**
 * Upload avatar
 * POST /api/v1/users/avatar
 */
export const uploadAvatar = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.userId;

    if (!req.file) {
      throw ApiError.badRequest("No file uploaded");
    }

    // Get current user to check for existing avatar
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });

    // Upload new avatar
    const { url } = await uploadFile(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      "avatar",
      userId,
    );

    // Delete old avatar if exists
    if (user?.avatarUrl) {
      deleteFileByUrl(user.avatarUrl).catch(() => {}); // Don't wait, fire and forget
    }

    // Update user with new avatar URL
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: url },
    });

    sendSuccess(res, { avatarUrl: url }, "Avatar uploaded successfully");
  },
);

/**
 * Delete avatar
 * DELETE /api/v1/users/avatar
 */
export const deleteAvatar = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });

    if (user?.avatarUrl) {
      await deleteFileByUrl(user.avatarUrl);
    }

    await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null },
    });

    sendSuccess(res, null, "Avatar deleted successfully");
  },
);

/**
 * Search users
 * GET /api/v1/users/search
 */
export const searchUsers = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { q, page, limit } = req.query as {
      q?: string;
      page?: string;
      limit?: string;
    };
    const pagination = parsePaginationParams(page, limit);

    const where = q
      ? {
          OR: [
            { fullName: { contains: q } },
            { studentId: { contains: q } },
            { program: { contains: q } },
          ],
          isActive: true,
        }
      : { isActive: true };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          studentId: true,
          fullName: true,
          avatarUrl: true,
          program: true,
          classYear: true,
          role: true,
        },
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { fullName: "asc" },
      }),
      prisma.user.count({ where }),
    ]);

    const paginationMeta = calculatePagination(
      pagination.page,
      pagination.limit,
      total,
    );

    sendSuccess(res, users, undefined, 200, paginationMeta);
  },
);

// ==================== ADMIN ENDPOINTS ====================

/**
 * Get all users (Admin only)
 * GET /api/v1/users/admin/all
 */
export const getAllUsers = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { page, limit, role, search, isActive } = req.query as {
      page?: string;
      limit?: string;
      role?: string;
      search?: string;
      isActive?: string;
    };
    const pagination = parsePaginationParams(page, limit);

    const where: any = {};

    if (role && ["STUDENT", "CLASS_REP", "ADMIN"].includes(role)) {
      where.role = role;
    }

    if (isActive !== undefined) {
      where.isActive = isActive === "true";
    }

    if (search) {
      where.OR = [
        { fullName: { contains: search } },
        { studentId: { contains: search } },
        { email: { contains: search } },
        { program: { contains: search } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.user.count({ where }),
    ]);

    const paginationMeta = calculatePagination(
      pagination.page,
      pagination.limit,
      total,
    );

    const result = users.map((user) => ({
      ...transformUser(user),
      isActive: user.isActive,
      updatedAt: user.updatedAt,
    }));

    sendSuccess(res, result, undefined, 200, paginationMeta);
  },
);

/**
 * Get admin dashboard stats
 * GET /api/v1/users/admin/stats
 */
export const getAdminStats = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const [
      totalUsers,
      activeUsers,
      totalPosts,
      totalEvents,
      totalGroups,
      totalClassrooms,
      newUsersThisMonth,
      usersByRole,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.post.count(),
      prisma.event.count(),
      prisma.group.count({ where: { isActive: true } }),
      prisma.classroom.count({ where: { isActive: true } }),
      prisma.user.count({
        where: {
          createdAt: {
            gte: new Date(
              new Date().getFullYear(),
              new Date().getMonth(),
              1,
            ),
          },
        },
      }),
      prisma.user.groupBy({
        by: ["role"],
        _count: { role: true },
      }),
    ]);

    const roleBreakdown = usersByRole.reduce(
      (acc: Record<string, number>, r) => {
        acc[r.role] = r._count.role;
        return acc;
      },
      {},
    );

    sendSuccess(res, {
      totalUsers,
      activeUsers,
      inactiveUsers: totalUsers - activeUsers,
      totalPosts,
      totalEvents,
      totalGroups,
      totalClassrooms,
      newUsersThisMonth,
      usersByRole: roleBreakdown,
    });
  },
);

/**
 * Change user role (Admin only)
 * PATCH /api/v1/users/admin/:id/role
 */
export const changeUserRole = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const id = getParamAsString(req.params.id);
    const { role } = req.body as { role: string };
    const adminId = req.user!.userId;

    // Prevent self-demotion
    if (id === adminId) {
      throw ApiError.badRequest("You cannot change your own role");
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw ApiError.notFound("User not found");
    }

    // Prevent demoting the last admin
    if (user.role === "ADMIN" && role !== "ADMIN") {
      const adminCount = await prisma.user.count({
        where: { role: "ADMIN" },
      });
      if (adminCount <= 1) {
        throw ApiError.badRequest(
          "Cannot demote the last admin. Promote another user first.",
        );
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { role: role as any },
    });

    sendSuccess(
      res,
      transformUser(updatedUser),
      `User role changed to ${role}`,
    );
  },
);

/**
 * Toggle user active status (Admin only)
 * PATCH /api/v1/users/admin/:id/toggle-active
 */
export const toggleUserActive = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const id = getParamAsString(req.params.id);
    const adminId = req.user!.userId;

    // Prevent self-deactivation
    if (id === adminId) {
      throw ApiError.badRequest("You cannot deactivate your own account");
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw ApiError.notFound("User not found");
    }

    // Prevent deactivating the last admin
    if (user.role === "ADMIN" && user.isActive) {
      const activeAdminCount = await prisma.user.count({
        where: { role: "ADMIN", isActive: true },
      });
      if (activeAdminCount <= 1) {
        throw ApiError.badRequest("Cannot deactivate the last active admin");
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { isActive: !user.isActive },
    });

    sendSuccess(
      res,
      { ...transformUser(updatedUser), isActive: updatedUser.isActive },
      `User ${updatedUser.isActive ? "activated" : "deactivated"} successfully`,
    );
  },
);

/**
 * Delete user (Admin only)
 * DELETE /api/v1/users/admin/:id
 */
export const deleteUser = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const id = getParamAsString(req.params.id);
    const adminId = req.user!.userId;

    // Prevent self-deletion
    if (id === adminId) {
      throw ApiError.badRequest("You cannot delete your own account");
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw ApiError.notFound("User not found");
    }

    // Prevent deleting the last admin
    if (user.role === "ADMIN") {
      const adminCount = await prisma.user.count({
        where: { role: "ADMIN" },
      });
      if (adminCount <= 1) {
        throw ApiError.badRequest("Cannot delete the last admin");
      }
    }

    // Delete avatar from S3 if exists
    if (user.avatarUrl) {
      deleteFileByUrl(user.avatarUrl).catch(() => {});
    }

    // Cascade delete handles posts, comments, likes, etc.
    await prisma.user.delete({ where: { id } });

    sendSuccess(res, null, "User deleted successfully");
  },
);

export default {
  getMyProfile,
  getUserProfile,
  setupProfile,
  updateProfile,
  uploadAvatar,
  deleteAvatar,
  searchUsers,
  getAllUsers,
  getAdminStats,
  changeUserRole,
  toggleUserActive,
  deleteUser,
};
