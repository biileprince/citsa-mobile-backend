import { Router } from "express";
import multer from "multer";
import feedController from "../controllers/feed.controller.js";
import {
  authenticate,
  optionalAuth,
  requireAdmin,
} from "../middleware/auth.middleware.js";
import {
  validate,
  createPostValidation,
  updatePostValidation,
  postIdValidation,
  postQueryValidation,
  createCommentValidation,
} from "../middleware/validation.middleware.js";
import { uploadLimiter } from "../middleware/rateLimit.middleware.js";
import { param, body } from "express-validator";

const router = Router();

// Configure multer for post images
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB for posts
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.",
        ),
      );
    }
  },
});

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
 * @desc    Create new post (Admin only) - with optional image upload
 * @access  Private (Admin)
 */
router.post(
  "/posts",
  authenticate,
  requireAdmin,
  uploadLimiter,
  upload.single("image"),
  validate(createPostValidation),
  feedController.createPost,
);

/**
 * @route   PUT /api/v1/feed/posts/:id
 * @desc    Update existing post (Admin only) - with optional image upload
 * @access  Private (Admin)
 */
router.put(
  "/posts/:id",
  authenticate,
  requireAdmin,
  uploadLimiter,
  upload.single("image"),
  validate([...postIdValidation, ...updatePostValidation]),
  feedController.updatePost,
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

// Delete a comment (author or admin)
router.delete(
  "/posts/:id/comments/:commentId",
  authenticate,
  validate([
    ...postIdValidation,
    param("commentId").isUUID().withMessage("Invalid comment ID"),
  ]),
  feedController.deleteComment,
);

// React to a comment (like, love, laugh, wow)
router.post(
  "/posts/:id/comments/:commentId/react",
  authenticate,
  validate([
    ...postIdValidation,
    param("commentId").isUUID().withMessage("Invalid comment ID"),
    body("reactionType")
      .optional()
      .isIn(["LIKE", "LOVE", "LAUGH", "WOW"])
      .withMessage("Reaction type must be one of: LIKE, LOVE, LAUGH, WOW"),
  ]),
  feedController.reactToComment,
);

// Remove reaction from a comment
router.delete(
  "/posts/:id/comments/:commentId/react",
  authenticate,
  validate([
    ...postIdValidation,
    param("commentId").isUUID().withMessage("Invalid comment ID"),
  ]),
  feedController.unreactToComment,
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
