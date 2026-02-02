import { Request, Response, NextFunction } from "express";
import {
  validationResult,
  ValidationChain,
  body,
  param,
  query,
} from "express-validator";
import { sendError } from "../utils/helpers.js";
import { ErrorCodes } from "../types/index.js";

/**
 * Middleware to check validation results
 */
export function validate(validations: ValidationChain[]) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    // Run all validations
    await Promise.all(validations.map((validation) => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      next();
      return;
    }

    const extractedErrors = errors.array().map((err) => {
      if (err.type === "field") {
        return { field: err.path, message: err.msg };
      }
      return { message: err.msg };
    });

    sendError(
      res,
      ErrorCodes.VALIDATION_ERROR,
      "Validation failed",
      400,
      extractedErrors,
    );
  };
}

// ==================== AUTH VALIDATIONS ====================

export const sendOtpValidation = [
  body("studentId")
    .notEmpty()
    .withMessage("Student ID is required")
    .trim()
    .matches(/^[A-Z]{2}\/[A-Z]{3}\/\d{2}\/\d{4}$/)
    .withMessage("Student ID must be in format PS/ITC/22/0120"),
];

export const verifyOtpValidation = [
  body("studentId")
    .notEmpty()
    .withMessage("Student ID is required")
    .trim()
    .matches(/^[A-Z]{2}\/[A-Z]{3}\/\d{2}\/\d{4}$/)
    .withMessage("Student ID must be in format PS/ITC/22/0120"),
  body("otpCode")
    .notEmpty()
    .withMessage("OTP code is required")
    .isLength({ min: 6, max: 6 })
    .withMessage("OTP code must be exactly 6 digits")
    .isNumeric()
    .withMessage("OTP code must contain only numbers"),
];

export const refreshTokenValidation = [
  body("refreshToken").notEmpty().withMessage("Refresh token is required"),
];

// ==================== PROFILE VALIDATIONS ====================

export const profileSetupValidation = [
  body("fullName")
    .notEmpty()
    .withMessage("Full name is required")
    .isLength({ min: 2, max: 255 })
    .withMessage("Full name must be between 2 and 255 characters"),
  body("bio")
    .optional()
    .isLength({ max: 1000 })
    .withMessage("Bio must be less than 1000 characters"),
  body("program")
    .notEmpty()
    .withMessage("Program is required")
    .isLength({ max: 100 })
    .withMessage("Program must be less than 100 characters"),
  body("classYear")
    .notEmpty()
    .withMessage("Class year is required")
    .isLength({ min: 4, max: 4 })
    .withMessage("Class year must be 4 characters (e.g., 2024)"),
  body("skills").optional().isArray().withMessage("Skills must be an array"),
  body("interests")
    .optional()
    .isArray()
    .withMessage("Interests must be an array"),
  body("portfolioUrl")
    .optional()
    .isURL()
    .withMessage("Portfolio URL must be a valid URL"),
];

export const profileUpdateValidation = [
  body("fullName")
    .optional()
    .isLength({ min: 2, max: 255 })
    .withMessage("Full name must be between 2 and 255 characters"),
  body("bio")
    .optional()
    .isLength({ max: 1000 })
    .withMessage("Bio must be less than 1000 characters"),
  body("program")
    .optional()
    .isLength({ max: 100 })
    .withMessage("Program must be less than 100 characters"),
  body("classYear")
    .optional()
    .isLength({ min: 4, max: 4 })
    .withMessage("Class year must be 4 characters"),
  body("skills").optional().isArray().withMessage("Skills must be an array"),
  body("interests")
    .optional()
    .isArray()
    .withMessage("Interests must be an array"),
  body("portfolioUrl")
    .optional()
    .isURL()
    .withMessage("Portfolio URL must be a valid URL"),
];

// ==================== POST VALIDATIONS ====================

export const createPostValidation = [
  body("type")
    .notEmpty()
    .withMessage("Post type is required")
    .isIn(["ANNOUNCEMENT", "EVENT", "OPPORTUNITY", "BLOG", "TESTIMONY"])
    .withMessage("Invalid post type"),
  body("category")
    .optional()
    .isIn(["POSITIVE_NEWS", "EVENTS", "OPPORTUNITY", "BLOG", "TESTIMONY"])
    .withMessage("Invalid category"),
  body("title")
    .notEmpty()
    .withMessage("Title is required")
    .isLength({ min: 5, max: 500 })
    .withMessage("Title must be between 5 and 500 characters"),
  body("content")
    .notEmpty()
    .withMessage("Content is required")
    .isLength({ min: 10 })
    .withMessage("Content must be at least 10 characters"),
  body("imageUrl").optional().isURL().withMessage("Invalid image URL"),
  body("isPinned")
    .optional()
    .isBoolean()
    .withMessage("isPinned must be boolean"),
  // Event-specific fields
  body("eventDate").optional().isISO8601().withMessage("Invalid event date"),
  body("eventTime")
    .optional()
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage("Invalid event time format (HH:MM)"),
  body("location")
    .optional()
    .isString()
    .withMessage("Location must be a string"),
  body("capacityMax")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Capacity must be at least 1"),
  body("registrationDeadline")
    .optional()
    .isISO8601()
    .withMessage("Invalid registration deadline"),
  body("tags").optional().isArray().withMessage("Tags must be an array"),
  body("isUrgent")
    .optional()
    .isBoolean()
    .withMessage("isUrgent must be boolean"),
];

export const updatePostValidation = [
  body("type")
    .optional()
    .isIn(["ANNOUNCEMENT", "EVENT", "OPPORTUNITY", "BLOG", "TESTIMONY"])
    .withMessage("Invalid post type"),
  body("category")
    .optional()
    .isIn(["POSITIVE_NEWS", "EVENTS", "OPPORTUNITY", "BLOG", "TESTIMONY"])
    .withMessage("Invalid category"),
  body("title")
    .optional()
    .isLength({ min: 5, max: 500 })
    .withMessage("Title must be between 5 and 500 characters"),
  body("content")
    .optional()
    .isLength({ min: 10 })
    .withMessage("Content must be at least 10 characters"),
  body("imageUrl").optional().isURL().withMessage("Invalid image URL"),
  body("isPinned")
    .optional()
    .isBoolean()
    .withMessage("isPinned must be a boolean"),
  // Event-specific validations
  body("eventDate")
    .if(body("type").equals("EVENT"))
    .notEmpty()
    .withMessage("Event date is required for events")
    .isISO8601()
    .withMessage("Invalid date format"),
  body("eventTime")
    .if(body("type").equals("EVENT"))
    .notEmpty()
    .withMessage("Event time is required for events"),
  body("location")
    .if(body("type").equals("EVENT"))
    .notEmpty()
    .withMessage("Location is required for events")
    .isLength({ max: 255 })
    .withMessage("Location must be less than 255 characters"),
  body("capacityMax")
    .if(body("type").equals("EVENT"))
    .notEmpty()
    .withMessage("Capacity is required for events")
    .isInt({ min: 1 })
    .withMessage("Capacity must be a positive integer"),
];

export const postIdValidation = [
  param("id").isUUID().withMessage("Invalid post ID"),
];

export const postQueryValidation = [
  query("type")
    .optional()
    .isIn(["ANNOUNCEMENT", "EVENT", "OPPORTUNITY", "BLOG", "TESTIMONY"])
    .withMessage("Invalid post type"),
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
];

// ==================== COMMENT VALIDATIONS ====================

export const createCommentValidation = [
  body("content")
    .notEmpty()
    .withMessage("Comment content is required")
    .isLength({ min: 1, max: 2000 })
    .withMessage("Comment must be between 1 and 2000 characters"),
  body("parentCommentId")
    .optional()
    .isUUID()
    .withMessage("Invalid parent comment ID"),
];

// ==================== EVENT VALIDATIONS ====================

export const eventIdValidation = [
  param("id").isUUID().withMessage("Invalid event ID"),
];

export const eventQueryValidation = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
  query("upcoming")
    .optional()
    .isBoolean()
    .withMessage("Upcoming must be a boolean"),
];

// ==================== GROUP VALIDATIONS ====================

export const groupIdValidation = [
  param("id").isUUID().withMessage("Invalid group ID"),
];

export const groupQueryValidation = [
  query("category")
    .optional()
    .isLength({ max: 100 })
    .withMessage("Category must be less than 100 characters"),
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
];

// ==================== CLASSROOM VALIDATIONS ====================

export const classroomIdValidation = [
  param("id").isUUID().withMessage("Invalid classroom ID"),
];

export const announcementIdValidation = [
  param("id").isUUID().withMessage("Invalid classroom ID"),
  param("announcementId").isUUID().withMessage("Invalid announcement ID"),
];

export const createClassroomValidation = [
  body("yearGroup")
    .notEmpty()
    .withMessage("Year group is required")
    .isLength({ min: 4, max: 4 })
    .withMessage("Year group must be 4 characters (e.g., 2026)"),
  body("graduationYear")
    .notEmpty()
    .withMessage("Graduation year is required")
    .isInt({ min: 2020, max: 2100 })
    .withMessage("Graduation year must be between 2020 and 2100"),
  body("semester")
    .notEmpty()
    .withMessage("Semester is required")
    .isInt({ min: 1, max: 2 })
    .withMessage("Semester must be 1 or 2"),
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),
];

export const createAnnouncementValidation = [
  body("title")
    .notEmpty()
    .withMessage("Title is required")
    .isLength({ min: 1, max: 255 })
    .withMessage("Title must be between 1 and 255 characters"),
  body("content")
    .notEmpty()
    .withMessage("Content is required")
    .isLength({ min: 1, max: 5000 })
    .withMessage("Content must be between 1 and 5000 characters"),
  body("isPinned")
    .optional()
    .isBoolean()
    .withMessage("isPinned must be a boolean"),
  body("isUrgent")
    .optional()
    .isBoolean()
    .withMessage("isUrgent must be a boolean"),
];

// ==================== NOTIFICATION VALIDATIONS ====================

export const notificationIdValidation = [
  param("id").isUUID().withMessage("Invalid notification ID"),
];

export const notificationQueryValidation = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
  query("unreadOnly")
    .optional()
    .isBoolean()
    .withMessage("unreadOnly must be a boolean"),
];

// ==================== USER ID VALIDATION ====================

export const userIdValidation = [
  param("userId").isUUID().withMessage("Invalid user ID"),
];

// Export all
export { body, param, query };
