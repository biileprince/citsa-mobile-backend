import { Router } from "express";
import authController from "../controllers/auth.controller.js";
import {
  validate,
  sendOtpValidation,
  verifyOtpValidation,
  refreshTokenValidation,
} from "../middleware/validation.middleware.js";
import { otpLimiter, authLimiter } from "../middleware/rateLimit.middleware.js";

const router = Router();

/**
 * @route   POST /api/v1/auth/send-otp
 * @desc    Send OTP to student email
 * @access  Public
 */
router.post(
  "/send-otp",
  otpLimiter,
  validate(sendOtpValidation),
  authController.sendOtp,
);

/**
 * @route   POST /api/v1/auth/verify-otp
 * @desc    Verify OTP and get tokens
 * @access  Public
 */
router.post(
  "/verify-otp",
  authLimiter,
  validate(verifyOtpValidation),
  authController.verifyOtp,
);

/**
 * @route   POST /api/v1/auth/refresh-token
 * @desc    Refresh access token
 * @access  Public
 */
router.post(
  "/refresh-token",
  validate(refreshTokenValidation),
  authController.refreshToken,
);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout - invalidate refresh token
 * @access  Public
 */
router.post("/logout", authController.logout);

export default router;
