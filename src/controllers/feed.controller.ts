import { Request, Response } from "express";
import prisma from "../config/database.js";
import {
  sendSuccess,
  sendCreated,
  sendNoContent,
  safeJsonParse,
  calculatePagination,
  parsePaginationParams,
  getParamAsString,
} from "../utils/helpers.js";
import {
  AuthenticatedRequest,
  CreatePostRequest,
  CreateCommentRequest,
  PostQueryParams,
} from "../types/index.js";
import { asyncHandler, ApiError } from "../middleware/error.middleware.js";
import { uploadFile } from "../services/storage.service.js";
import logger from "../utils/logger.js";

/**
 * Transform post for API response - includes likePreviewUser
 */
function transformPost(post: any, userId?: string) {
  // Build likePreviewUser: the first liker to show in "liked by X and N others"
  let likePreviewUser = null;
  if (post._likePreviewUsers && post._likePreviewUsers.length > 0) {
    // Prefer showing the current user first if they liked it
    const currentUserLike = userId
      ? post._likePreviewUsers.find((l: any) => l.user?.id === userId)
      : null;
    const previewLike = currentUserLike || post._likePreviewUsers[0];
    if (previewLike?.user) {
      likePreviewUser = {
        id: previewLike.user.id,
        fullName: previewLike.user.fullName,
        avatarUrl: previewLike.user.avatarUrl,
      };
    }
  }

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
    likePreviewUser,
  };
}

/**
 * Common include for fetching like preview users on posts
 */
const likePreviewInclude = {
  where: { likeableType: "post" },
  select: {
    user: {
      select: {
        id: true,
        fullName: true,
        avatarUrl: true,
      },
    },
  },
  take: 2,
  orderBy: { createdAt: "desc" as const },
};

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

    // Fetch like preview users for each post
    const postIds = posts.map((p) => p.id);
    const likePreviewUsers =
      postIds.length > 0
        ? await prisma.like.findMany({
            where: {
              likeableType: "post",
              likeableId: { in: postIds },
            },
            select: {
              likeableId: true,
              user: {
                select: { id: true, fullName: true, avatarUrl: true },
              },
            },
            orderBy: { createdAt: "desc" },
          })
        : [];

    // Group by post id and take first 2
    const previewByPost = new Map<string, any[]>();
    for (const lp of likePreviewUsers) {
      const existing = previewByPost.get(lp.likeableId) || [];
      if (existing.length < 2) {
        existing.push(lp);
        previewByPost.set(lp.likeableId, existing);
      }
    }

    const transformedPosts = posts.map((post) => {
      (post as any)._likePreviewUsers = previewByPost.get(post.id) || [];
      return transformPost(post, userId);
    });
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
    const id = getParamAsString(req.params.id);
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
            likes: {
              select: {
                id: true,
                userId: true,
                reactionType: true,
                user: {
                  select: { id: true, fullName: true, avatarUrl: true },
                },
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
                likes: {
                  select: {
                    id: true,
                    userId: true,
                    reactionType: true,
                    user: {
                      select: { id: true, fullName: true, avatarUrl: true },
                    },
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

    // Fetch like preview users for this post
    const likePreviewUsers = await prisma.like.findMany({
      where: { likeableType: "post", likeableId: id },
      select: {
        user: {
          select: { id: true, fullName: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 2,
    });
    (post as any)._likePreviewUsers = likePreviewUsers;

    /**
     * Build reaction summary for a comment's likes
     */
    function buildCommentReactions(likes: any[], currentUserId?: string) {
      const reactionCounts: Record<string, number> = {};
      let userReaction: string | null = null;
      for (const like of likes) {
        const rt = like.reactionType || "LIKE";
        reactionCounts[rt] = (reactionCounts[rt] || 0) + 1;
        if (currentUserId && like.userId === currentUserId) {
          userReaction = rt;
        }
      }
      return { reactionCounts, userReaction };
    }

    const transformedPost = {
      ...transformPost(post, userId),
      comments: post.comments.map((comment: any) => {
        const { reactionCounts, userReaction } = buildCommentReactions(
          comment.likes || [],
          userId,
        );
        return {
          id: comment.id,
          content: comment.content,
          likesCount: comment.likesCount,
          createdAt: comment.createdAt,
          user: comment.user,
          reactionCounts,
          userReaction,
          replies: comment.replies.map((reply: any) => {
            const replyReactions = buildCommentReactions(
              reply.likes || [],
              userId,
            );
            return {
              id: reply.id,
              content: reply.content,
              likesCount: reply.likesCount,
              createdAt: reply.createdAt,
              user: reply.user,
              reactionCounts: replyReactions.reactionCounts,
              userReaction: replyReactions.userReaction,
            };
          }),
        };
      }),
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

    // Handle image upload if file is provided
    let imageUrl = data.imageUrl; // Fallback to URL if provided
    if (req.file) {
      try {
        const uploadResult = await uploadFile(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype,
          "post",
          userId,
        );
        imageUrl = uploadResult.url;
      } catch (uploadError: any) {
        logger.error("Image upload failed:", uploadError);
        throw ApiError.badRequest(
          `Image upload failed: ${uploadError.message || "Check S3 bucket configuration"}`,
        );
      }
    }

    // Create post
    const post = await prisma.post.create({
      data: {
        authorId: userId,
        type: data.type,
        category: data.category,
        title: data.title,
        content: data.content,
        imageUrl: imageUrl,
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
 * Update existing post (Admin only)
 * PUT /api/v1/feed/posts/:id
 */
export const updatePost = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const id = getParamAsString(req.params.id);
    const userId = req.user!.userId;
    const data = req.body;

    // Check if post exists
    const existingPost = await prisma.post.findUnique({
      where: { id },
      include: { event: true },
    });

    if (!existingPost) {
      throw ApiError.notFound("Post not found");
    }

    // Handle image upload if file is provided
    let imageUrl = data.imageUrl; // Keep existing or use provided URL
    if (req.file) {
      try {
        const uploadResult = await uploadFile(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype,
          "post",
          userId,
        );
        imageUrl = uploadResult.url;
      } catch (uploadError: any) {
        logger.error("Image upload failed:", uploadError);
        throw ApiError.badRequest(
          `Image upload failed: ${uploadError.message || "Check S3 bucket configuration"}`,
        );
      }
    }

    // Update post
    const post = await prisma.post.update({
      where: { id },
      data: {
        type: data.type,
        category: data.category,
        title: data.title,
        content: data.content,
        imageUrl: imageUrl,
        isPinned: data.isPinned,
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

    // Handle event data if post type is EVENT
    if (data.type === "EVENT" || existingPost.type === "EVENT") {
      if (existingPost.event) {
        // Update existing event
        if (data.type === "EVENT") {
          await prisma.event.update({
            where: { id: existingPost.event.id },
            data: {
              eventDate: data.eventDate ? new Date(data.eventDate) : undefined,
              eventTime: data.eventTime,
              location: data.location,
              capacityMax: data.capacityMax,
              registrationDeadline: data.registrationDeadline
                ? new Date(data.registrationDeadline)
                : undefined,
              tags: data.tags ? JSON.stringify(data.tags) : undefined,
              isUrgent: data.isUrgent,
            },
          });
        } else {
          // Type changed from EVENT to something else, delete event
          await prisma.event.delete({
            where: { id: existingPost.event.id },
          });
        }
      } else if (
        data.type === "EVENT" &&
        data.eventDate &&
        data.eventTime &&
        data.location &&
        data.capacityMax
      ) {
        // Create new event if changing to EVENT type
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
    }

    // Fetch complete updated post with event
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

    sendSuccess(
      res,
      transformPost(completePost, userId),
      "Post updated successfully",
    );
  },
);

/**
 * Like a post
 * POST /api/v1/feed/posts/:id/like
 */
export const likePost = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const id = getParamAsString(req.params.id);
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
    const id = getParamAsString(req.params.id);
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
    const id = getParamAsString(req.params.id);
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
 * Delete a comment (author or admin)
 * DELETE /api/v1/feed/posts/:id/comments/:commentId
 */
export const deleteComment = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const postId = getParamAsString(req.params.id);
    const commentId = getParamAsString(req.params.commentId);
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    // Verify post exists
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) {
      throw ApiError.notFound("Post not found");
    }

    // Verify comment exists and belongs to this post
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: { _count: { select: { replies: true } } },
    });

    if (!comment || comment.postId !== postId) {
      throw ApiError.notFound("Comment not found");
    }

    // Only comment author or admin can delete
    if (comment.userId !== userId && userRole !== "ADMIN") {
      throw ApiError.forbidden("You can only delete your own comments");
    }

    // Count total comments to remove (this comment + its replies)
    const repliesCount = comment._count.replies;
    const totalToRemove = 1 + repliesCount;

    // Delete the comment (cascade will delete replies and likes)
    await prisma.$transaction([
      // Delete likes on replies first
      prisma.like.deleteMany({
        where: {
          likeableType: "comment",
          commentId: {
            in: await prisma.comment
              .findMany({
                where: { parentCommentId: commentId },
                select: { id: true },
              })
              .then((replies) => replies.map((r) => r.id)),
          },
        },
      }),
      // Delete likes on the comment itself
      prisma.like.deleteMany({
        where: { likeableType: "comment", commentId },
      }),
      // Delete replies
      prisma.comment.deleteMany({
        where: { parentCommentId: commentId },
      }),
      // Delete the comment
      prisma.comment.delete({
        where: { id: commentId },
      }),
      // Decrement post comment count
      prisma.post.update({
        where: { id: postId },
        data: { commentsCount: { decrement: totalToRemove } },
      }),
    ]);

    sendSuccess(res, { deleted: true }, "Comment deleted successfully");
  },
);

/**
 * React to a comment (like, love, laugh, wow)
 * POST /api/v1/feed/posts/:id/comments/:commentId/react
 */
export const reactToComment = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const postId = getParamAsString(req.params.id);
    const commentId = getParamAsString(req.params.commentId);
    const userId = req.user!.userId;
    const { reactionType } = req.body as { reactionType?: string };

    const validReactions = ["LIKE", "LOVE", "LAUGH", "WOW"];
    const reaction = (reactionType || "LIKE").toUpperCase();
    if (!validReactions.includes(reaction)) {
      throw ApiError.badRequest(
        `Invalid reaction type. Must be one of: ${validReactions.join(", ")}`,
      );
    }

    // Verify post and comment exist
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
    });
    if (!comment || comment.postId !== postId) {
      throw ApiError.notFound("Comment not found");
    }

    // Check if user already reacted
    const existingLike = await prisma.like.findUnique({
      where: {
        userId_likeableType_likeableId: {
          userId,
          likeableType: "comment",
          likeableId: commentId,
        },
      },
    });

    if (existingLike) {
      // If same reaction, remove it (toggle off)
      if (existingLike.reactionType === reaction) {
        await prisma.$transaction([
          prisma.like.delete({ where: { id: existingLike.id } }),
          prisma.comment.update({
            where: { id: commentId },
            data: { likesCount: { decrement: 1 } },
          }),
        ]);
        sendSuccess(
          res,
          { reacted: false, reactionType: null },
          "Reaction removed",
        );
        return;
      }

      // Different reaction: update it
      await prisma.like.update({
        where: { id: existingLike.id },
        data: { reactionType: reaction as any },
      });
      sendSuccess(
        res,
        { reacted: true, reactionType: reaction },
        "Reaction updated",
      );
      return;
    }

    // Create new reaction
    await prisma.$transaction([
      prisma.like.create({
        data: {
          userId,
          likeableType: "comment",
          likeableId: commentId,
          commentId,
          reactionType: reaction as any,
        },
      }),
      prisma.comment.update({
        where: { id: commentId },
        data: { likesCount: { increment: 1 } },
      }),
    ]);

    // Notify comment author
    if (comment.userId !== userId) {
      const reactor = await prisma.user.findUnique({
        where: { id: userId },
        select: { fullName: true },
      });

      const reactionEmoji: Record<string, string> = {
        LIKE: "👍",
        LOVE: "❤️",
        LAUGH: "😂",
        WOW: "😮",
      };

      await prisma.notification.create({
        data: {
          userId: comment.userId,
          type: "LIKE",
          title: "New Reaction",
          message: `${reactor?.fullName || "Someone"} reacted ${reactionEmoji[reaction] || "👍"} to your comment`,
          relatedEntityType: "comment",
          relatedEntityId: commentId,
        },
      });
    }

    sendSuccess(
      res,
      { reacted: true, reactionType: reaction },
      "Reaction added",
    );
  },
);

/**
 * Remove reaction from a comment
 * DELETE /api/v1/feed/posts/:id/comments/:commentId/react
 */
export const unreactToComment = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const commentId = getParamAsString(req.params.commentId);
    const userId = req.user!.userId;

    const deleted = await prisma.like.deleteMany({
      where: {
        userId,
        likeableType: "comment",
        likeableId: commentId,
      },
    });

    if (deleted.count > 0) {
      await prisma.comment.update({
        where: { id: commentId },
        data: { likesCount: { decrement: 1 } },
      });
    }

    sendSuccess(
      res,
      { reacted: false, reactionType: null },
      "Reaction removed",
    );
  },
);

/**
 * Save post
 * POST /api/v1/feed/posts/:id/save
 */
export const savePost = asyncHandler(
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const id = getParamAsString(req.params.id);
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
    const id = getParamAsString(req.params.id);
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
    const id = getParamAsString(req.params.id);
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
  updatePost,
  likePost,
  unlikePost,
  addComment,
  deleteComment,
  reactToComment,
  unreactToComment,
  savePost,
  unsavePost,
  sharePost,
  getSavedPosts,
};
