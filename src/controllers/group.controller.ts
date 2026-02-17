import { Request, Response } from "express";
import prisma from "../config/database.js";
import {
  sendSuccess,
  sendCreated,
  calculatePagination,
  parsePaginationParams,
  getParamAsString,
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
    const id = getParamAsString(req.params.id);
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
    const id = getParamAsString(req.params.id);
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
    const id = getParamAsString(req.params.id);
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
    const id = getParamAsString(req.params.id);
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

// ==================== ADMIN ENDPOINTS ====================

/**
 * Create group (Admin only)
 * POST /api/v1/groups
 */
export const createGroup = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const { name, description, category, coverColor } = req.body;

    // Check for duplicate name
    const existing = await prisma.group.findFirst({
      where: { name },
    });
    if (existing) {
      throw ApiError.conflict(`Group "${name}" already exists`);
    }

    // Create group and add creator as admin member in a transaction
    const [group] = await prisma.$transaction([
      prisma.group.create({
        data: {
          name,
          description,
          category,
          coverColor,
          membersCount: 1,
        },
      }),
    ]);

    // Add the creator as group admin
    await prisma.groupMembership.create({
      data: {
        groupId: group.id,
        userId,
        role: "ADMIN",
      },
    });

    const createdGroup = await prisma.group.findUnique({
      where: { id: group.id },
      include: {
        memberships: {
          where: { userId },
          select: { userId: true, role: true },
        },
      },
    });

    sendCreated(
      res,
      transformGroup(createdGroup, userId),
      "Group created successfully",
    );
  },
);

/**
 * Update group (Admin only)
 * PUT /api/v1/groups/:id
 */
export const updateGroup = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const id = getParamAsString(req.params.id);
    const { name, description, category, coverColor, isActive } = req.body;

    const group = await prisma.group.findUnique({ where: { id } });
    if (!group) {
      throw ApiError.notFound("Group not found");
    }

    // If name changed, check for duplicates
    if (name && name !== group.name) {
      const existing = await prisma.group.findFirst({
        where: { name, id: { not: id } },
      });
      if (existing) {
        throw ApiError.conflict(`Group "${name}" already exists`);
      }
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category;
    if (coverColor !== undefined) updateData.coverColor = coverColor;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updatedGroup = await prisma.group.update({
      where: { id },
      data: updateData,
    });

    sendSuccess(
      res,
      transformGroup(updatedGroup),
      "Group updated successfully",
    );
  },
);

/**
 * Delete group (Admin only)
 * DELETE /api/v1/groups/:id
 */
export const deleteGroup = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const id = getParamAsString(req.params.id);

    const group = await prisma.group.findUnique({ where: { id } });
    if (!group) {
      throw ApiError.notFound("Group not found");
    }

    // Cascade delete handles memberships
    await prisma.group.delete({ where: { id } });

    sendSuccess(res, null, "Group deleted successfully");
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
  createGroup,
  updateGroup,
  deleteGroup,
};
