import { Router } from "express";
import feedController from "../controllers/feed.controller.js";
import {
  authenticate,
  optionalAuth,
  requireAdmin,
} from "../middleware/auth.middleware.js";
import {
  validate,
  createPostValidation,
  postIdValidation,
  postQueryValidation,
  createCommentValidation,
} from "../middleware/validation.middleware.js";

const router = Router();

/**
 * @route   GET /api/v1/feed/posts
 * @desc    Get feed posts with filtering
 * @access  Public (optional auth for like/save status)
 */
router.get(
  "/posts",
  optionalAuth,
  validate(postQueryValidation),
  feedController.getPosts,
);

/**
 * @route   GET /api/v1/feed/saved
 * @desc    Get user's saved posts
 * @access  Private
 */
router.get("/saved", authenticate, feedController.getSavedPosts);

/**
 * @route   GET /api/v1/feed/posts/:id
 * @desc    Get single post by ID
 * @access  Public (optional auth)
 */
router.get(
  "/posts/:id",
  optionalAuth,
  validate(postIdValidation),
  feedController.getPostById,
);

/**
 * @route   POST /api/v1/feed/posts
 * @desc    Create new post (Admin only)
 * @access  Private (Admin)
 */
router.post(
  "/posts",
  authenticate,
  requireAdmin,
  validate(createPostValidation),
  feedController.createPost,
);

/**
 * @route   POST /api/v1/feed/posts/:id/like
 * @desc    Like a post
 * @access  Private
 */
router.post(
  "/posts/:id/like",
  authenticate,
  validate(postIdValidation),
  feedController.likePost,
);

/**
 * @route   DELETE /api/v1/feed/posts/:id/like
 * @desc    Unlike a post
 * @access  Private
 */
router.delete(
  "/posts/:id/like",
  authenticate,
  validate(postIdValidation),
  feedController.unlikePost,
);

/**
 * @route   POST /api/v1/feed/posts/:id/comments
 * @desc    Add comment to post
 * @access  Private
 */
router.post(
  "/posts/:id/comments",
  authenticate,
  validate([...postIdValidation, ...createCommentValidation]),
  feedController.addComment,
);

/**
 * @route   POST /api/v1/feed/posts/:id/save
 * @desc    Save post to bookmarks
 * @access  Private
 */
router.post(
  "/posts/:id/save",
  authenticate,
  validate(postIdValidation),
  feedController.savePost,
);

/**
 * @route   DELETE /api/v1/feed/posts/:id/save
 * @desc    Unsave post
 * @access  Private
 */
router.delete(
  "/posts/:id/save",
  authenticate,
  validate(postIdValidation),
  feedController.unsavePost,
);

/**
 * @route   POST /api/v1/feed/posts/:id/share
 * @desc    Share post
 * @access  Private
 */
router.post(
  "/posts/:id/share",
  authenticate,
  validate(postIdValidation),
  feedController.sharePost,
);

export default router;
