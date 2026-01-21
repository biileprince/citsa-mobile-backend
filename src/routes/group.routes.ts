import { Router } from "express";
import groupController from "../controllers/group.controller.js";
import { authenticate, optionalAuth } from "../middleware/auth.middleware.js";
import {
  validate,
  groupIdValidation,
  groupQueryValidation,
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

export default router;
