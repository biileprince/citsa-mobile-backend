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

export default {
  getMyProfile,
  getUserProfile,
  setupProfile,
  updateProfile,
  uploadAvatar,
  deleteAvatar,
  searchUsers,
};
