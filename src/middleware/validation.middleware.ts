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
  param("id")
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Group ID is required")
    .isLength({ min: 1, max: 100 })
    .withMessage("Invalid group ID format"),
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

export const announcementCommentValidation = [
  body("content")
    .notEmpty()
    .withMessage("Comment content is required")
    .isLength({ min: 1, max: 2000 })
    .withMessage("Comment must be between 1 and 2000 characters"),
];

export const announcementCommentIdValidation = [
  param("id").isUUID().withMessage("Invalid classroom ID"),
  param("announcementId").isUUID().withMessage("Invalid announcement ID"),
  param("commentId").isUUID().withMessage("Invalid comment ID"),
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
  body("program")
    .notEmpty()
    .withMessage("Program is required")
    .isIn(["COMPUTER_SCIENCE", "INFORMATION_TECHNOLOGY"])
    .withMessage("Program must be COMPUTER_SCIENCE or INFORMATION_TECHNOLOGY"),
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
  param("id")
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Notification ID is required")
    .isLength({ min: 1, max: 100 })
    .withMessage("Invalid notification ID format"),
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

// ==================== ADMIN VALIDATIONS ====================

export const adminUserIdValidation = [
  param("id").isUUID().withMessage("Invalid user ID"),
];

export const changeRoleValidation = [
  param("id").isUUID().withMessage("Invalid user ID"),
  body("role")
    .notEmpty()
    .withMessage("Role is required")
    .isIn(["STUDENT", "CLASS_REP", "ADMIN"])
    .withMessage("Role must be STUDENT, CLASS_REP, or ADMIN"),
];

export const createGroupValidation = [
  body("name")
    .notEmpty()
    .withMessage("Group name is required")
    .isLength({ min: 2, max: 255 })
    .withMessage("Group name must be between 2 and 255 characters"),
  body("description")
    .optional()
    .isLength({ max: 2000 })
    .withMessage("Description must be less than 2000 characters"),
  body("category")
    .optional()
    .isLength({ max: 100 })
    .withMessage("Category must be less than 100 characters"),
  body("coverColor")
    .optional()
    .isLength({ max: 50 })
    .withMessage("Cover color must be less than 50 characters"),
];

export const updateGroupValidation = [
  param("id")
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Group ID is required"),
  body("name")
    .optional()
    .isLength({ min: 2, max: 255 })
    .withMessage("Group name must be between 2 and 255 characters"),
  body("description")
    .optional()
    .isLength({ max: 2000 })
    .withMessage("Description must be less than 2000 characters"),
  body("category")
    .optional()
    .isLength({ max: 100 })
    .withMessage("Category must be less than 100 characters"),
  body("coverColor")
    .optional()
    .isLength({ max: 50 })
    .withMessage("Cover color must be less than 50 characters"),
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),
];

export const updateClassroomValidation = [
  param("id").isUUID().withMessage("Invalid classroom ID"),
  body("yearGroup")
    .optional()
    .isLength({ min: 4, max: 4 })
    .withMessage("Year group must be 4 characters"),
  body("graduationYear")
    .optional()
    .isInt({ min: 2020, max: 2100 })
    .withMessage("Graduation year must be between 2020 and 2100"),
  body("semester")
    .optional()
    .isInt({ min: 1, max: 2 })
    .withMessage("Semester must be 1 or 2"),
  body("program")
    .optional()
    .isIn(["COMPUTER_SCIENCE", "INFORMATION_TECHNOLOGY"])
    .withMessage("Program must be COMPUTER_SCIENCE or INFORMATION_TECHNOLOGY"),
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),
];

export const addCourseValidation = [
  param("id").isUUID().withMessage("Invalid classroom ID"),
  body("courseCode")
    .notEmpty()
    .withMessage("Course code is required")
    .isLength({ max: 20 })
    .withMessage("Course code must be less than 20 characters"),
  body("courseName")
    .notEmpty()
    .withMessage("Course name is required")
    .isLength({ max: 255 })
    .withMessage("Course name must be less than 255 characters"),
  body("credits")
    .notEmpty()
    .withMessage("Credits is required")
    .isInt({ min: 1, max: 10 })
    .withMessage("Credits must be between 1 and 10"),
];

export const addTimetableSlotValidation = [
  param("id").isUUID().withMessage("Invalid classroom ID"),
  body("courseId")
    .notEmpty()
    .withMessage("Course ID is required")
    .isUUID()
    .withMessage("Invalid course ID"),
  body("dayOfWeek")
    .notEmpty()
    .withMessage("Day of week is required")
    .isIn([
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ])
    .withMessage("Invalid day of week"),
  body("startTime")
    .notEmpty()
    .withMessage("Start time is required")
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage("Start time must be in HH:MM format"),
  body("endTime")
    .notEmpty()
    .withMessage("End time is required")
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage("End time must be in HH:MM format"),
  body("room")
    .notEmpty()
    .withMessage("Room is required")
    .isLength({ max: 50 })
    .withMessage("Room must be less than 50 characters"),
];

export const addQuizValidation = [
  param("id").isUUID().withMessage("Invalid classroom ID"),
  body("courseId")
    .notEmpty()
    .withMessage("Course ID is required")
    .isUUID()
    .withMessage("Invalid course ID"),
  body("title")
    .notEmpty()
    .withMessage("Quiz title is required")
    .isLength({ max: 255 })
    .withMessage("Title must be less than 255 characters"),
  body("quizDate")
    .notEmpty()
    .withMessage("Quiz date is required")
    .isISO8601()
    .withMessage("Invalid quiz date format"),
  body("quizTime")
    .notEmpty()
    .withMessage("Quiz time is required")
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage("Quiz time must be in HH:MM format"),
];

export const updateEventValidation = [
  param("id").isUUID().withMessage("Invalid event ID"),
  body("eventDate")
    .optional()
    .isISO8601()
    .withMessage("Invalid event date"),
  body("eventTime")
    .optional()
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage("Invalid event time format (HH:MM)"),
  body("location")
    .optional()
    .isLength({ max: 255 })
    .withMessage("Location must be less than 255 characters"),
  body("capacityMax")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Capacity must be at least 1"),
  body("registrationDeadline")
    .optional()
    .isISO8601()
    .withMessage("Invalid registration deadline"),
  body("tags")
    .optional()
    .isArray()
    .withMessage("Tags must be an array"),
  body("isUrgent")
    .optional()
    .isBoolean()
    .withMessage("isUrgent must be boolean"),
];

export const sendNotificationValidation = [
  body("userId")
    .notEmpty()
    .withMessage("User ID is required")
    .isUUID()
    .withMessage("Invalid user ID"),
  body("type")
    .notEmpty()
    .withMessage("Notification type is required")
    .isIn([
      "LIKE",
      "COMMENT",
      "EVENT_REMINDER",
      "ANNOUNCEMENT",
      "URGENT_ANNOUNCEMENT",
      "EVENT_FULL",
      "NEW_EVENT",
      "MENTION",
    ])
    .withMessage("Invalid notification type"),
  body("title")
    .notEmpty()
    .withMessage("Title is required")
    .isLength({ max: 255 })
    .withMessage("Title must be less than 255 characters"),
  body("message")
    .notEmpty()
    .withMessage("Message is required")
    .isLength({ max: 5000 })
    .withMessage("Message must be less than 5000 characters"),
  body("relatedEntityType")
    .optional()
    .isLength({ max: 50 })
    .withMessage("Related entity type must be less than 50 characters"),
  body("relatedEntityId")
    .optional()
    .isString()
    .withMessage("Related entity ID must be a string"),
];

export const broadcastNotificationValidation = [
  body("type")
    .notEmpty()
    .withMessage("Notification type is required")
    .isIn([
      "LIKE",
      "COMMENT",
      "EVENT_REMINDER",
      "ANNOUNCEMENT",
      "URGENT_ANNOUNCEMENT",
      "EVENT_FULL",
      "NEW_EVENT",
      "MENTION",
    ])
    .withMessage("Invalid notification type"),
  body("title")
    .notEmpty()
    .withMessage("Title is required")
    .isLength({ max: 255 })
    .withMessage("Title must be less than 255 characters"),
  body("message")
    .notEmpty()
    .withMessage("Message is required")
    .isLength({ max: 5000 })
    .withMessage("Message must be less than 5000 characters"),
  body("role")
    .optional()
    .isIn(["STUDENT", "CLASS_REP", "ADMIN"])
    .withMessage("Role must be STUDENT, CLASS_REP, or ADMIN"),
  body("relatedEntityType")
    .optional()
    .isLength({ max: 50 })
    .withMessage("Related entity type must be less than 50 characters"),
  body("relatedEntityId")
    .optional()
    .isString()
    .withMessage("Related entity ID must be a string"),
];

// Export all
export { body, param, query };
