import { Request, Response } from "express";
import prisma from "../config/database.js";
import {
  sendSuccess,
  calculatePagination,
  parsePaginationParams,
} from "../utils/helpers.js";
import { AuthenticatedRequest, GroupQueryParams } from "../types/index.js";
import { asyncHandler, ApiError } from "../middleware/error.middleware.js";

/**
 * Transform group for API response
 */
function transformGroup(group: any, userId?: string) {
  return {
    id: group.id,
    name: group.name,
    description: group.description,
    category: group.category,
    avatarUrl: group.avatarUrl,
    coverColor: group.coverColor,
    membersCount: group.membersCount,
    isActive: group.isActive,
    createdAt: group.createdAt,
    isMember: userId
      ? group.memberships?.some((m: any) => m.userId === userId)
      : false,
    userRole: userId
      ? group.memberships?.find((m: any) => m.userId === userId)?.role || null
      : null,
  };
}

/**
 * Get all groups with filtering and pagination
 * GET /api/v1/groups
 */
export const getGroups = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { category, page, limit, search } = req.query as GroupQueryParams;
    const userId = req.user?.userId;
    const pagination = parsePaginationParams(page, limit);

    const where: any = {
      isActive: true,
    };

    if (category) {
      where.category = category;
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const [groups, total] = await Promise.all([
      prisma.group.findMany({
        where,
        include: {
          memberships: userId
            ? {
                where: { userId },
                select: { userId: true, role: true },
              }
            : false,
        },
        orderBy: [{ membersCount: "desc" }, { name: "asc" }],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.group.count({ where }),
    ]);

    const transformedGroups = groups.map((group) =>
      transformGroup(group, userId),
    );
    const paginationMeta = calculatePagination(
      pagination.page,
      pagination.limit,
      total,
    );

    sendSuccess(res, transformedGroups, undefined, 200, paginationMeta);
  },
);

/**
 * Get single group by ID
 * GET /api/v1/groups/:id
 */
export const getGroupById = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = req.user?.userId;

    const group = await prisma.group.findUnique({
      where: { id },
      include: {
        memberships: userId
          ? {
              where: { userId },
              select: { userId: true, role: true },
            }
          : false,
      },
    });

    if (!group) {
      throw ApiError.notFound("Group not found");
    }

    sendSuccess(res, transformGroup(group, userId));
  },
);

/**
 * Get group members
 * GET /api/v1/groups/:id/members
 */
export const getGroupMembers = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { page, limit } = req.query as { page?: string; limit?: string };
    const pagination = parsePaginationParams(page, limit);

    // Check if group exists
    const group = await prisma.group.findUnique({ where: { id } });
    if (!group) {
      throw ApiError.notFound("Group not found");
    }

    const [memberships, total] = await Promise.all([
      prisma.groupMembership.findMany({
        where: { groupId: id },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              avatarUrl: true,
              program: true,
            },
          },
        },
        orderBy: [
          { role: "asc" }, // Admins first, then moderators, then members
          { joinedAt: "asc" },
        ],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.groupMembership.count({ where: { groupId: id } }),
    ]);

    const members = memberships.map((m) => ({
      id: m.user.id,
      fullName: m.user.fullName,
      avatarUrl: m.user.avatarUrl,
      program: m.user.program,
      role: m.role,
      joinedAt: m.joinedAt,
    }));

    const paginationMeta = calculatePagination(
      pagination.page,
      pagination.limit,
      total,
    );

    sendSuccess(res, members, undefined, 200, paginationMeta);
  },
);

/**
 * Join a group
 * POST /api/v1/groups/:id/join
 */
export const joinGroup = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = req.user!.userId;

    // Check if group exists
    const group = await prisma.group.findUnique({ where: { id } });
    if (!group) {
      throw ApiError.notFound("Group not found");
    }

    if (!group.isActive) {
      throw ApiError.badRequest("This group is no longer active");
    }

    // Check if already a member
    const existingMembership = await prisma.groupMembership.findUnique({
      where: {
        groupId_userId: { groupId: id, userId },
      },
    });

    if (existingMembership) {
      throw ApiError.conflict("You are already a member of this group");
    }

    // Create membership and increment count
    await prisma.$transaction([
      prisma.groupMembership.create({
        data: {
          groupId: id,
          userId,
          role: "MEMBER",
        },
      }),
      prisma.group.update({
        where: { id },
        data: { membersCount: { increment: 1 } },
      }),
    ]);

    // Fetch updated group
    const updatedGroup = await prisma.group.findUnique({
      where: { id },
      include: {
        memberships: {
          where: { userId },
          select: { userId: true, role: true },
        },
      },
    });

    sendSuccess(
      res,
      transformGroup(updatedGroup, userId),
      "Successfully joined group",
    );
  },
);

/**
 * Leave a group
 * DELETE /api/v1/groups/:id/join
 */
export const leaveGroup = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = req.user!.userId;

    // Check membership exists
    const membership = await prisma.groupMembership.findUnique({
      where: {
        groupId_userId: { groupId: id, userId },
      },
    });

    if (!membership) {
      throw ApiError.notFound("You are not a member of this group");
    }

    // Check if user is the only admin
    if (membership.role === "ADMIN") {
      const adminCount = await prisma.groupMembership.count({
        where: { groupId: id, role: "ADMIN" },
      });

      if (adminCount === 1) {
        throw ApiError.badRequest(
          "You cannot leave the group as you are the only admin. Please assign another admin first.",
        );
      }
    }

    // Delete membership and decrement count
    await prisma.$transaction([
      prisma.groupMembership.delete({
        where: { id: membership.id },
      }),
      prisma.group.update({
        where: { id },
        data: { membersCount: { decrement: 1 } },
      }),
    ]);

    sendSuccess(res, { isMember: false }, "Successfully left group");
  },
);

/**
 * Get user's groups
 * GET /api/v1/groups/my-groups
 */
export const getMyGroups = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const { page, limit } = req.query as { page?: string; limit?: string };
    const pagination = parsePaginationParams(page, limit);

    const [memberships, total] = await Promise.all([
      prisma.groupMembership.findMany({
        where: { userId },
        include: {
          group: true,
        },
        orderBy: { joinedAt: "desc" },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.groupMembership.count({ where: { userId } }),
    ]);

    const groups = memberships.map((m) => ({
      ...transformGroup(m.group, userId),
      isMember: true,
      userRole: m.role,
      joinedAt: m.joinedAt,
    }));

    const paginationMeta = calculatePagination(
      pagination.page,
      pagination.limit,
      total,
    );

    sendSuccess(res, groups, undefined, 200, paginationMeta);
  },
);

/**
 * Get group categories
 * GET /api/v1/groups/categories
 */
export const getGroupCategories = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const categories = await prisma.group.groupBy({
      by: ["category"],
      where: { isActive: true, category: { not: null } },
      _count: { category: true },
    });

    const result = categories
      .filter((c) => c.category)
      .map((c) => ({
        name: c.category,
        count: c._count.category,
      }))
      .sort((a, b) => b.count - a.count);

    sendSuccess(res, result);
  },
);

export default {
  getGroups,
  getGroupById,
  getGroupMembers,
  joinGroup,
  leaveGroup,
  getMyGroups,
  getGroupCategories,
};
