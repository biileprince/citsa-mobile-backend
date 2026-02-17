import { Router } from "express";
import eventController from "../controllers/event.controller.js";
import {
  authenticate,
  optionalAuth,
  requireAdmin,
} from "../middleware/auth.middleware.js";
import {
  validate,
  eventIdValidation,
  eventQueryValidation,
  updateEventValidation,
} from "../middleware/validation.middleware.js";

const router = Router();

/**
 * @route   GET /api/v1/events
 * @desc    Get all events with filtering
 * @access  Public (optional auth for registration status)
 */
router.get(
  "/",
  optionalAuth,
  validate(eventQueryValidation),
  eventController.getEvents,
);

/**
 * @route   GET /api/v1/events/my-registrations
 * @desc    Get user's registered events
 * @access  Private
 */
router.get(
  "/my-registrations",
  authenticate,
  validate(eventQueryValidation),
  eventController.getMyRegistrations,
);

/**
 * @route   GET /api/v1/events/:id
 * @desc    Get single event by ID
 * @access  Public (optional auth)
 */
router.get(
  "/:id",
  optionalAuth,
  validate(eventIdValidation),
  eventController.getEventById,
);

/**
 * @route   POST /api/v1/events/:id/register
 * @desc    Register for an event
 * @access  Private
 */
router.post(
  "/:id/register",
  authenticate,
  validate(eventIdValidation),
  eventController.registerForEvent,
);

/**
 * @route   DELETE /api/v1/events/:id/register
 * @desc    Cancel event registration
 * @access  Private
 */
router.delete(
  "/:id/register",
  authenticate,
  validate(eventIdValidation),
  eventController.cancelRegistration,
);

// ==================== ADMIN ROUTES ====================

/**
 * @route   PUT /api/v1/events/:id
 * @desc    Update event (Admin only)
 * @access  Private (Admin)
 */
router.put(
  "/:id",
  authenticate,
  requireAdmin,
  validate(updateEventValidation),
  eventController.updateEvent,
);

/**
 * @route   DELETE /api/v1/events/:id
 * @desc    Delete event (Admin only)
 * @access  Private (Admin)
 */
router.delete(
  "/:id",
  authenticate,
  requireAdmin,
  validate(eventIdValidation),
  eventController.deleteEvent,
);

export default router;
