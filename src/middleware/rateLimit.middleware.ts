import rateLimit from "express-rate-limit";
import config from "../config/index.js";
import { sendError } from "../utils/helpers.js";
import { ErrorCodes } from "../types/index.js";

/**
 * General API rate limiter
 */
export const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: "Too many requests, please try again later",
  handler: (req, res) => {
    sendError(
      res,
      ErrorCodes.OTP_RATE_LIMITED,
      "Too many requests, please try again later",
      429,
    );
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Strict rate limiter for authentication endpoints
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per 15 minutes
  message: "Too many authentication attempts, please try again later",
  handler: (req, res) => {
    sendError(
      res,
      ErrorCodes.OTP_RATE_LIMITED,
      "Too many authentication attempts, please try again later",
      429,
    );
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * OTP-specific rate limiter
 */
export const otpLimiter = rateLimit({
  windowMs: config.otp.rateLimitWindowMinutes * 60 * 1000,
  max: config.otp.rateLimitMaxRequests,
  message: "Too many OTP requests, please try again later",
  handler: (req, res) => {
    sendError(
      res,
      ErrorCodes.OTP_RATE_LIMITED,
      `Too many OTP requests. Please wait ${config.otp.rateLimitWindowMinutes} minutes before requesting again.`,
      429,
    );
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit by student ID if available, otherwise by IP
    return req.body?.studentId || req.ip || "unknown";
  },
});

/**
 * Upload rate limiter
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 uploads per hour
  message: "Too many file uploads, please try again later",
  handler: (req, res) => {
    sendError(
      res,
      ErrorCodes.OTP_RATE_LIMITED,
      "Too many file uploads, please try again later",
      429,
    );
  },
  standardHeaders: true,
  legacyHeaders: false,
});
