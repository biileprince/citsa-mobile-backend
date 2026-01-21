import { Request, Response } from "express";
import { sendSuccess, sendError } from "../utils/helpers.js";
import {
  ErrorCodes,
  SendOtpRequest,
  VerifyOtpRequest,
  RefreshTokenRequest,
} from "../types/index.js";
import * as authService from "../services/auth.service.js";
import { asyncHandler } from "../middleware/error.middleware.js";

/**
 * Send OTP to student email
 * POST /api/v1/auth/send-otp
 */
export const sendOtp = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { studentId } = req.body as SendOtpRequest;

    const result = await authService.sendOtp(studentId);

    sendSuccess(res, result, "OTP sent successfully");
  },
);

/**
 * Verify OTP and get tokens
 * POST /api/v1/auth/verify-otp
 */
export const verifyOtp = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { studentId, otpCode } = req.body as VerifyOtpRequest;

    const result = await authService.verifyOtp(studentId, otpCode);

    sendSuccess(res, result, "Authentication successful");
  },
);

/**
 * Refresh access token
 * POST /api/v1/auth/refresh-token
 */
export const refreshToken = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { refreshToken } = req.body as RefreshTokenRequest;

    const result = await authService.refreshAccessToken(refreshToken);

    sendSuccess(res, result, "Token refreshed successfully");
  },
);

/**
 * Logout - invalidate refresh token
 * POST /api/v1/auth/logout
 */
export const logout = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { refreshToken } = req.body as RefreshTokenRequest;

    if (refreshToken) {
      await authService.logout(refreshToken);
    }

    sendSuccess(res, null, "Logged out successfully");
  },
);

export default {
  sendOtp,
  verifyOtp,
  refreshToken,
  logout,
};
