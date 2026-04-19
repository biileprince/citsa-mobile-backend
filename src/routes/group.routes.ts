import { Router } from "express";
import groupController from "../controllers/group.controller.js";
import {
  authenticate,
  optionalAuth,
  requireAdmin,
} from "../middleware/auth.middleware.js";
import {
  validate,
  groupIdValidation,
  groupMessageIdValidation,
  groupMessageValidation,
  groupQueryValidation,
  createGroupValidation,
  updateGroupValidation,
} from "../middleware/validation.middleware.js";

const router = Router();

/**
 * @route   GET /api/v1/groups
 * @desc    Get all groups with filtering
 * @access  Public (optional auth for membership status)
 */
router.get(
  "/",
  optionalAuth,
  validate(groupQueryValidation),
  groupController.getGroups,
);

/**
 * @route   GET /api/v1/groups/categories
 * @desc    Get group categories with counts
 * @access  Public
 */
router.get("/categories", groupController.getGroupCategories);

/**
 * @route   GET /api/v1/groups/my-groups
 * @desc    Get user's groups
 * @access  Private
 */
router.get("/my-groups", authenticate, groupController.getMyGroups);

/**
 * @route   GET /api/v1/groups/:id
 * @desc    Get single group by ID
 * @access  Public (optional auth)
 */
router.get(
  "/:id",
  optionalAuth,
  validate(groupIdValidation),
  groupController.getGroupById,
);

/**
 * @route   GET /api/v1/groups/:id/members
 * @desc    Get group members
 * @access  Public
 */
router.get(
  "/:id/members",
  validate(groupIdValidation),
  groupController.getGroupMembers,
);

/**
 * @route   POST /api/v1/groups/:id/join
 * @desc    Join a group
 * @access  Private
 */
router.post(
  "/:id/join",
  authenticate,
  validate(groupIdValidation),
  groupController.joinGroup,
);

/**
 * @route   DELETE /api/v1/groups/:id/join
 * @desc    Leave a group
 * @access  Private
 */
router.delete(
  "/:id/join",
  authenticate,
  validate(groupIdValidation),
  groupController.leaveGroup,
);

/**
 * @route   GET /api/v1/groups/:id/messages
 * @desc    Get group messages (members only)
 * @access  Private
 */
router.get(
  "/:id/messages",
  authenticate,
  validate(groupIdValidation),
  groupController.getGroupMessages,
);

/**
 * @route   POST /api/v1/groups/:id/messages
 * @desc    Post group message (group admin only)
 * @access  Private
 */
router.post(
  "/:id/messages",
  authenticate,
  validate(groupMessageValidation),
  groupController.createGroupMessage,
);

/**
 * @route   POST /api/v1/groups/:id/messages/:messageId/reactions
 * @desc    React to a group message (members only)
 * @access  Private
 */
router.post(
  "/:id/messages/:messageId/reactions",
  authenticate,
  validate(groupMessageIdValidation),
  groupController.reactToGroupMessage,
);

/**
 * @route   DELETE /api/v1/groups/:id/messages/:messageId/reactions
 * @desc    Remove reaction from a group message (members only)
 * @access  Private
 */
router.delete(
  "/:id/messages/:messageId/reactions",
  authenticate,
  validate(groupMessageIdValidation),
  groupController.unreactToGroupMessage,
);

// ==================== ADMIN ROUTES ====================

/**
 * @route   POST /api/v1/groups
 * @desc    Create a new group (Admin only)
 * @access  Private (Admin)
 */
router.post(
  "/",
  authenticate,
  requireAdmin,
  validate(createGroupValidation),
  groupController.createGroup,
);

/**
 * @route   PUT /api/v1/groups/:id
 * @desc    Update group (Admin only)
 * @access  Private (Admin)
 */
router.put(
  "/:id",
  authenticate,
  requireAdmin,
  validate(updateGroupValidation),
  groupController.updateGroup,
);

/**
 * @route   DELETE /api/v1/groups/:id
 * @desc    Delete group (Admin only)
 * @access  Private (Admin)
 */
router.delete(
  "/:id",
  authenticate,
  requireAdmin,
  validate(groupIdValidation),
  groupController.deleteGroup,
);

export default router;
