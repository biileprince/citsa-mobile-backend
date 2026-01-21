import { Router } from "express";
import multer from "multer";
import userController from "../controllers/user.controller.js";
import { authenticate, optionalAuth } from "../middleware/auth.middleware.js";
import {
  validate,
  profileSetupValidation,
  profileUpdateValidation,
  userIdValidation,
} from "../middleware/validation.middleware.js";
import { uploadLimiter } from "../middleware/rateLimit.middleware.js";

const router = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
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
 * @route   GET /api/v1/users/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get("/profile", authenticate, userController.getMyProfile);

/**
 * @route   GET /api/v1/users/profile/:userId
 * @desc    Get user profile by ID
 * @access  Public (optional auth for full email)
 */
router.get(
  "/profile/:userId",
  optionalAuth,
  validate(userIdValidation),
  userController.getUserProfile,
);

/**
 * @route   POST /api/v1/users/profile/setup
 * @desc    Setup profile for first time
 * @access  Private
 */
router.post(
  "/profile/setup",
  authenticate,
  validate(profileSetupValidation),
  userController.setupProfile,
);

/**
 * @route   PUT /api/v1/users/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put(
  "/profile",
  authenticate,
  validate(profileUpdateValidation),
  userController.updateProfile,
);

/**
 * @route   POST /api/v1/users/avatar
 * @desc    Upload user avatar
 * @access  Private
 */
router.post(
  "/avatar",
  authenticate,
  uploadLimiter,
  upload.single("avatar"),
  userController.uploadAvatar,
);

/**
 * @route   DELETE /api/v1/users/avatar
 * @desc    Delete user avatar
 * @access  Private
 */
router.delete("/avatar", authenticate, userController.deleteAvatar);

/**
 * @route   GET /api/v1/users/search
 * @desc    Search users
 * @access  Private
 */
router.get("/search", authenticate, userController.searchUsers);

export default router;
