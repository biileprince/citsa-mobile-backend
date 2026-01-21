import { Request, Response } from "express";
import prisma from "../config/database.js";
import {
  sendSuccess,
  sendCreated,
  sendNoContent,
  safeJsonParse,
  calculatePagination,
  parsePaginationParams,
} from "../utils/helpers.js";
import {
  AuthenticatedRequest,
  CreatePostRequest,
  CreateCommentRequest,
  PostQueryParams,
} from "../types/index.js";
import { asyncHandler, ApiError } from "../middleware/error.middleware.js";
import { uploadFile } from "../services/storage.service.js";

/**
 * Transform post for API response
 */
function transformPost(post: any, userId?: string) {
  return {
    id: post.id,
    type: post.type,
    category: post.category,
    title: post.title,
    content: post.content,
    imageUrl: post.imageUrl,
    likesCount: post.likesCount,
    commentsCount: post.commentsCount,
    sharesCount: post.sharesCount,
    viewsCount: post.viewsCount,
    isPinned: post.isPinned,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    author: post.author
      ? {
          id: post.author.id,
          fullName: post.author.fullName,
          avatarUrl: post.author.avatarUrl,
          role: post.author.role,
        }
      : null,
    event: post.event
      ? {
          id: post.event.id,
          eventDate: post.event.eventDate,
          eventTime: post.event.eventTime,
          location: post.event.location,
          capacityMax: post.event.capacityMax,
          capacityCurrent: post.event.capacityCurrent,
          registrationDeadline: post.event.registrationDeadline,
          tags: safeJsonParse(post.event.tags, []),
          isUrgent: post.event.isUrgent,
        }
      : null,
    isLiked: userId
      ? post.likes?.some((like: any) => like.userId === userId)
      : false,
    isSaved: userId
      ? post.savedPosts?.some((saved: any) => saved.userId === userId)
      : false,
  };
}

/**
 * Get feed posts with filtering and pagination
 * GET /api/v1/feed/posts
 */
export const getPosts = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { type, category, page, limit, search } =
      req.query as PostQueryParams;
    const userId = req.user?.userId;
    const pagination = parsePaginationParams(page, limit);

    // Build where clause
    const where: any = {
      isPublished: true,
    };

    if (type) {
      where.type = type;
    }

    if (category) {
      where.category = category;
    }

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { content: { contains: search } },
      ];
    }

    // Fetch posts with related data
    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        include: {
          author: {
            select: {
              id: true,
              fullName: true,
              avatarUrl: true,
              role: true,
            },
          },
          event: true,
          likes: userId
            ? {
                where: { userId, likeableType: "post" },
                select: { userId: true },
              }
            : false,
          savedPosts: userId
            ? {
                where: { userId },
                select: { userId: true },
              }
            : false,
        },
        orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.post.count({ where }),
    ]);

    const transformedPosts = posts.map((post) => transformPost(post, userId));
    const paginationMeta = calculatePagination(
      pagination.page,
      pagination.limit,
      total,
    );

    sendSuccess(res, transformedPosts, undefined, 200, paginationMeta);
  },
);

/**
 * Get single post by ID
 * GET /api/v1/feed/posts/:id
 */
export const getPostById = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = req.user?.userId;

    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
            role: true,
          },
        },
        event: true,
        likes: userId
          ? {
              where: { userId, likeableType: "post" },
              select: { userId: true },
            }
          : false,
        savedPosts: userId
          ? {
              where: { userId },
              select: { userId: true },
            }
          : false,
        comments: {
          where: { parentCommentId: null },
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                avatarUrl: true,
              },
            },
            replies: {
              include: {
                user: {
                  select: {
                    id: true,
                    fullName: true,
                    avatarUrl: true,
                  },
                },
              },
              orderBy: { createdAt: "asc" },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });

    if (!post) {
      throw ApiError.notFound("Post not found");
    }

    // Increment view count
    await prisma.post.update({
      where: { id },
      data: { viewsCount: { increment: 1 } },
    });

    const transformedPost = {
      ...transformPost(post, userId),
      comments: post.comments.map((comment) => ({
        id: comment.id,
        content: comment.content,
        likesCount: comment.likesCount,
        createdAt: comment.createdAt,
        user: comment.user,
        replies: comment.replies.map((reply) => ({
          id: reply.id,
          content: reply.content,
          likesCount: reply.likesCount,
          createdAt: reply.createdAt,
          user: reply.user,
        })),
      })),
    };

    sendSuccess(res, transformedPost);
  },
);

/**
 * Create new post (Admin only)
 * POST /api/v1/feed/posts
 */
export const createPost = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const data = req.body as CreatePostRequest;

    // Create post
    const post = await prisma.post.create({
      data: {
        authorId: userId,
        type: data.type,
        category: data.category,
        title: data.title,
        content: data.content,
        imageUrl: data.imageUrl,
        isPinned: data.isPinned || false,
      },
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
    });

    // If it's an event post, create the event
    if (
      data.type === "EVENT" &&
      data.eventDate &&
      data.eventTime &&
      data.location &&
      data.capacityMax
    ) {
      await prisma.event.create({
        data: {
          postId: post.id,
          eventDate: new Date(data.eventDate),
          eventTime: data.eventTime,
          location: data.location,
          capacityMax: data.capacityMax,
          registrationDeadline: data.registrationDeadline
            ? new Date(data.registrationDeadline)
            : null,
          tags: data.tags ? JSON.stringify(data.tags) : undefined,
          isUrgent: data.isUrgent || false,
        },
      });
    }

    // Fetch complete post with event
    const completePost = await prisma.post.findUnique({
      where: { id: post.id },
      include: {
        author: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
            role: true,
          },
        },
        event: true,
      },
    });

    sendCreated(
      res,
      transformPost(completePost, userId),
      "Post created successfully",
    );
  },
);

/**
 * Like a post
 * POST /api/v1/feed/posts/:id/like
 */
export const likePost = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = req.user!.userId;

    // Check if post exists
    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) {
      throw ApiError.notFound("Post not found");
    }

    // Check if already liked
    const existingLike = await prisma.like.findUnique({
      where: {
        userId_likeableType_likeableId: {
          userId,
          likeableType: "post",
          likeableId: id,
        },
      },
    });

    if (existingLike) {
      throw ApiError.conflict("You have already liked this post");
    }

    // Create like and increment count
    await prisma.$transaction([
      prisma.like.create({
        data: {
          userId,
          likeableType: "post",
          likeableId: id,
          postId: id,
        },
      }),
      prisma.post.update({
        where: { id },
        data: { likesCount: { increment: 1 } },
      }),
    ]);

    // Create notification for post author (if not liking own post)
    if (post.authorId !== userId) {
      const liker = await prisma.user.findUnique({
        where: { id: userId },
        select: { fullName: true },
      });

      await prisma.notification.create({
        data: {
          userId: post.authorId,
          type: "LIKE",
          title: "New Like",
          message: `${liker?.fullName || "Someone"} liked your post`,
          relatedEntityType: "post",
          relatedEntityId: id,
        },
      });
    }

    sendSuccess(res, { liked: true }, "Post liked successfully");
  },
);

/**
 * Unlike a post
 * DELETE /api/v1/feed/posts/:id/like
 */
export const unlikePost = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = req.user!.userId;

    // Delete like and decrement count
    const deleted = await prisma.like.deleteMany({
      where: {
        userId,
        likeableType: "post",
        likeableId: id,
      },
    });

    if (deleted.count > 0) {
      await prisma.post.update({
        where: { id },
        data: { likesCount: { decrement: 1 } },
      });
    }

    sendSuccess(res, { liked: false }, "Post unliked");
  },
);

/**
 * Add comment to post
 * POST /api/v1/feed/posts/:id/comments
 */
export const addComment = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = req.user!.userId;
    const { content, parentCommentId } = req.body as CreateCommentRequest;

    // Check if post exists
    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) {
      throw ApiError.notFound("Post not found");
    }

    // If replying to a comment, check if parent comment exists
    if (parentCommentId) {
      const parentComment = await prisma.comment.findUnique({
        where: { id: parentCommentId },
      });
      if (!parentComment || parentComment.postId !== id) {
        throw ApiError.notFound("Parent comment not found");
      }
    }

    // Create comment
    const comment = await prisma.comment.create({
      data: {
        postId: id,
        userId,
        parentCommentId,
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

    // Increment comment count on post
    await prisma.post.update({
      where: { id },
      data: { commentsCount: { increment: 1 } },
    });

    // Create notification for post author
    if (post.authorId !== userId) {
      const commenter = await prisma.user.findUnique({
        where: { id: userId },
        select: { fullName: true },
      });

      await prisma.notification.create({
        data: {
          userId: post.authorId,
          type: "COMMENT",
          title: "New Comment",
          message: `${commenter?.fullName || "Someone"} commented on your post`,
          relatedEntityType: "post",
          relatedEntityId: id,
        },
      });
    }

    sendCreated(
      res,
      {
        id: comment.id,
        content: comment.content,
        likesCount: comment.likesCount,
        createdAt: comment.createdAt,
        user: comment.user,
      },
      "Comment added successfully",
    );
  },
);

/**
 * Save post
 * POST /api/v1/feed/posts/:id/save
 */
export const savePost = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = req.user!.userId;

    // Check if post exists
    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) {
      throw ApiError.notFound("Post not found");
    }

    // Check if already saved
    const existingSave = await prisma.savedPost.findUnique({
      where: {
        userId_postId: { userId, postId: id },
      },
    });

    if (existingSave) {
      throw ApiError.conflict("Post is already saved");
    }

    await prisma.savedPost.create({
      data: { userId, postId: id },
    });

    sendSuccess(res, { saved: true }, "Post saved successfully");
  },
);

/**
 * Unsave post
 * DELETE /api/v1/feed/posts/:id/save
 */
export const unsavePost = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = req.user!.userId;

    await prisma.savedPost.deleteMany({
      where: { userId, postId: id },
    });

    sendSuccess(res, { saved: false }, "Post unsaved");
  },
);

/**
 * Share post
 * POST /api/v1/feed/posts/:id/share
 */
export const sharePost = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = req.user!.userId;

    // Check if post exists
    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) {
      throw ApiError.notFound("Post not found");
    }

    // Record share and increment count
    await prisma.$transaction([
      prisma.share.create({
        data: { userId, postId: id },
      }),
      prisma.post.update({
        where: { id },
        data: { sharesCount: { increment: 1 } },
      }),
    ]);

    sendSuccess(res, { shared: true }, "Post shared");
  },
);

/**
 * Get saved posts
 * GET /api/v1/feed/saved
 */
export const getSavedPosts = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const { page, limit } = req.query as { page?: string; limit?: string };
    const pagination = parsePaginationParams(page, limit);

    const [savedPosts, total] = await Promise.all([
      prisma.savedPost.findMany({
        where: { userId },
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
              event: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.savedPost.count({ where: { userId } }),
    ]);

    const posts = savedPosts.map((sp) => ({
      ...transformPost(sp.post, userId),
      savedAt: sp.createdAt,
      isSaved: true,
    }));

    const paginationMeta = calculatePagination(
      pagination.page,
      pagination.limit,
      total,
    );

    sendSuccess(res, posts, undefined, 200, paginationMeta);
  },
);

export default {
  getPosts,
  getPostById,
  createPost,
  likePost,
  unlikePost,
  addComment,
  savePost,
  unsavePost,
  sharePost,
  getSavedPosts,
};
