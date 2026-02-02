import { Router } from "express";
import classroomController from "../controllers/classroom.controller.js";
import {
  authenticate,
  requireClassRep,
  requireAdmin,
} from "../middleware/auth.middleware.js";
import {
  validate,
  classroomIdValidation,
  announcementIdValidation,
  createAnnouncementValidation,
  createClassroomValidation,
} from "../middleware/validation.middleware.js";

const router = Router();

/**
 * @route   POST /api/v1/classrooms
 * @desc    Create new classroom (Admin only)
 * @access  Private (Admin)
 */
router.post(
  "/",
  authenticate,
  requireAdmin,
  validate(createClassroomValidation),
  classroomController.createClassroom,
);

/**
 * @route   GET /api/v1/classrooms
 * @desc    Get all classrooms
 * @access  Private
 */
router.get("/", authenticate, classroomController.getClassrooms);

/**
 * @route   GET /api/v1/classrooms/:id
 * @desc    Get classroom by ID with full details
 * @access  Private
 */
router.get(
  "/:id",
  authenticate,
  validate(classroomIdValidation),
  classroomController.getClassroomById,
);

/**
 * @route   GET /api/v1/classrooms/:id/timetable
 * @desc    Get classroom timetable
 * @access  Private
 */
router.get(
  "/:id/timetable",
  authenticate,
  validate(classroomIdValidation),
  classroomController.getClassroomTimetable,
);

/**
 * @route   GET /api/v1/classrooms/:id/quizzes
 * @desc    Get upcoming quizzes for classroom
 * @access  Private
 */
router.get(
  "/:id/quizzes",
  authenticate,
  validate(classroomIdValidation),
  classroomController.getClassroomQuizzes,
);

/**
 * @route   GET /api/v1/classrooms/:id/announcements
 * @desc    Get classroom announcements
 * @access  Private
 */
router.get(
  "/:id/announcements",
  authenticate,
  validate(classroomIdValidation),
  classroomController.getClassroomAnnouncements,
);

/**
 * @route   POST /api/v1/classrooms/:id/announcements
 * @desc    Create classroom announcement (Class Rep only)
 * @access  Private (Class Rep)
 */
router.post(
  "/:id/announcements",
  authenticate,
  requireClassRep,
  validate([...classroomIdValidation, ...createAnnouncementValidation]),
  classroomController.createAnnouncement,
);

/**
 * @route   PUT /api/v1/classrooms/:id/announcements/:announcementId
 * @desc    Update classroom announcement (Class Rep only)
 * @access  Private (Class Rep)
 */
router.put(
  "/:id/announcements/:announcementId",
  authenticate,
  requireClassRep,
  validate(announcementIdValidation),
  classroomController.updateAnnouncement,
);

/**
 * @route   DELETE /api/v1/classrooms/:id/announcements/:announcementId
 * @desc    Delete classroom announcement (Class Rep only)
 * @access  Private (Class Rep)
 */
router.delete(
  "/:id/announcements/:announcementId",
  authenticate,
  requireClassRep,
  validate(announcementIdValidation),
  classroomController.deleteAnnouncement,
);

export default router;
