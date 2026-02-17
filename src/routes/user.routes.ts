import { Router } from "express";
import multer from "multer";
import userController from "../controllers/user.controller.js";
import {
  authenticate,
  optionalAuth,
  requireAdmin,
} from "../middleware/auth.middleware.js";
import {
  validate,
  profileSetupValidation,
  profileUpdateValidation,
  userIdValidation,
  adminUserIdValidation,
  changeRoleValidation,
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

// ==================== ADMIN ROUTES ====================

/**
 * @route   GET /api/v1/users/admin/all
 * @desc    Get all users (Admin only)
 * @access  Private (Admin)
 */
router.get("/admin/all", authenticate, requireAdmin, userController.getAllUsers);

/**
 * @route   GET /api/v1/users/admin/stats
 * @desc    Get admin dashboard stats
 * @access  Private (Admin)
 */
router.get(
  "/admin/stats",
  authenticate,
  requireAdmin,
  userController.getAdminStats,
);

/**
 * @route   PATCH /api/v1/users/admin/:id/role
 * @desc    Change user role (Admin only)
 * @access  Private (Admin)
 */
router.patch(
  "/admin/:id/role",
  authenticate,
  requireAdmin,
  validate(changeRoleValidation),
  userController.changeUserRole,
);

/**
 * @route   PATCH /api/v1/users/admin/:id/toggle-active
 * @desc    Toggle user active status (Admin only)
 * @access  Private (Admin)
 */
router.patch(
  "/admin/:id/toggle-active",
  authenticate,
  requireAdmin,
  validate(adminUserIdValidation),
  userController.toggleUserActive,
);

/**
 * @route   DELETE /api/v1/users/admin/:id
 * @desc    Delete user (Admin only)
 * @access  Private (Admin)
 */
router.delete(
  "/admin/:id",
  authenticate,
  requireAdmin,
  validate(adminUserIdValidation),
  userController.deleteUser,
);

export default router;
