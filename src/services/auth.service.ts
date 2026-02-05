import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import prisma from "../config/database.js";
import config from "../config/index.js";
import { JwtPayload, UserProfile, TokenResponse } from "../types/index.js";
import {
  generateOtpCode,
  generateStudentEmail,
  safeJsonParse,
} from "../utils/helpers.js";
import { sendOtpEmail, sendWelcomeEmail } from "./email.service.js";
import logger from "../utils/logger.js";
import { ApiError } from "../middleware/error.middleware.js";
import { ErrorCodes } from "../types/index.js";

/**
 * Generate JWT access token
 */
export function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpiry,
  } as jwt.SignOptions);
}

/**
 * Generate JWT refresh token
 */
export function generateRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiry,
  } as jwt.SignOptions);
}

/**
 * Send OTP to student email
 */
export async function sendOtp(
  studentId: string,
): Promise<{ message: string; email: string }> {
  // Find student in database
  const student = await prisma.user.findUnique({
    where: { studentId },
    select: { email: true, isActive: true },
  });

  if (!student) {
    throw new ApiError(
      404,
      ErrorCodes.USER_NOT_FOUND,
      "Student not found. Please contact administration.",
    );
  }

  if (!student.isActive) {
    throw new ApiError(
      403,
      ErrorCodes.USER_INACTIVE,
      "Student account is inactive. Please contact administration.",
    );
  }

  const email = student.email;

  // Check for rate limiting (recent OTP requests)
  const recentOtp = await prisma.otpVerification.findFirst({
    where: {
      email,
      createdAt: {
        gte: new Date(
          Date.now() - config.otp.rateLimitWindowMinutes * 60 * 1000,
        ),
      },
      isUsed: false,
    },
    orderBy: { createdAt: "desc" },
  });

  // Count recent requests
  const recentCount = await prisma.otpVerification.count({
    where: {
      email,
      createdAt: {
        gte: new Date(
          Date.now() - config.otp.rateLimitWindowMinutes * 60 * 1000,
        ),
      },
    },
  });

  if (recentCount >= config.otp.rateLimitMaxRequests) {
    throw new ApiError(
      429,
      ErrorCodes.OTP_RATE_LIMITED,
      `Too many OTP requests. Please wait ${config.otp.rateLimitWindowMinutes} minutes.`,
    );
  }

  // Generate new OTP
  const otpCode = generateOtpCode(6);
  const hashedOtp = await bcrypt.hash(otpCode, 10);

  // Store OTP in database
  await prisma.otpVerification.create({
    data: {
      email,
      otpCode: hashedOtp,
      expiresAt: new Date(Date.now() + config.otp.expirySeconds * 1000),
    },
  });

  // Send OTP via email
  const emailSent = await sendOtpEmail(email, otpCode);
  if (!emailSent) {
    throw new ApiError(
      500,
      ErrorCodes.EXTERNAL_SERVICE_ERROR,
      "Failed to send OTP email. Please try again.",
    );
  }

  logger.info(`OTP sent to ${email}`);
  return {
    message: "OTP sent successfully",
    email: email.replace(/^(.{3}).*(@.*)$/, "$1****$2"), // Masked email
  };
}

/**
 * Resend OTP to student email (invalidates previous OTPs)
 */
export async function resendOtp(
  studentId: string,
): Promise<{ message: string; email: string; expiresIn: number }> {
  // Find student in database
  const student = await prisma.user.findUnique({
    where: { studentId },
    select: { email: true, isActive: true },
  });

  if (!student) {
    throw new ApiError(
      404,
      ErrorCodes.USER_NOT_FOUND,
      "Student not found. Please contact administration.",
    );
  }

  if (!student.isActive) {
    throw new ApiError(
      403,
      ErrorCodes.USER_INACTIVE,
      "Student account is inactive. Please contact administration.",
    );
  }

  const email = student.email;

  // Check for rate limiting (recent OTP requests including resends)
  const recentCount = await prisma.otpVerification.count({
    where: {
      email,
      createdAt: {
        gte: new Date(
          Date.now() - config.otp.rateLimitWindowMinutes * 60 * 1000,
        ),
      },
    },
  });

  if (recentCount >= config.otp.rateLimitMaxRequests) {
    throw new ApiError(
      429,
      ErrorCodes.OTP_RATE_LIMITED,
      `Too many OTP requests. Please wait ${config.otp.rateLimitWindowMinutes} minutes.`,
    );
  }

  // Invalidate all previous unused OTPs for this email
  await prisma.otpVerification.updateMany({
    where: {
      email,
      isUsed: false,
    },
    data: {
      isUsed: true,
    },
  });

  // Generate new OTP
  const otpCode = generateOtpCode(6);
  const hashedOtp = await bcrypt.hash(otpCode, 10);

  // Store OTP in database
  await prisma.otpVerification.create({
    data: {
      email,
      otpCode: hashedOtp,
      expiresAt: new Date(Date.now() + config.otp.expirySeconds * 1000),
    },
  });

  // Send OTP via email
  const emailSent = await sendOtpEmail(email, otpCode);
  if (!emailSent) {
    throw new ApiError(
      500,
      ErrorCodes.EXTERNAL_SERVICE_ERROR,
      "Failed to resend OTP email. Please try again.",
    );
  }

  logger.info(`OTP resent to ${email}`);
  return {
    message: "New OTP sent successfully",
    email: email.replace(/^(.{3}).*(@.*)$/, "$1****$2"), // Masked email
    expiresIn: config.otp.expirySeconds,
  };
}

/**
 * Verify OTP and return tokens
 */
export async function verifyOtp(
  studentId: string,
  otpCode: string,
): Promise<TokenResponse> {
  // Find student in database
  const student = await prisma.user.findUnique({
    where: { studentId },
  });

  if (!student) {
    throw new ApiError(
      404,
      ErrorCodes.USER_NOT_FOUND,
      "Student not found. Please contact administration.",
    );
  }

  const email = student.email;

  // Find the most recent unused OTP for this email
  const otpRecord = await prisma.otpVerification.findFirst({
    where: {
      email,
      isUsed: false,
      expiresAt: { gte: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!otpRecord) {
    throw new ApiError(
      400,
      ErrorCodes.OTP_EXPIRED,
      "OTP expired or not found. Please request a new one.",
    );
  }

  // Check attempts
  if (otpRecord.attempts >= config.otp.maxAttempts) {
    throw new ApiError(
      400,
      ErrorCodes.OTP_MAX_ATTEMPTS,
      "Maximum OTP attempts exceeded. Please request a new OTP.",
    );
  }

  // Verify OTP
  const isValid = await bcrypt.compare(otpCode, otpRecord.otpCode);

  if (!isValid) {
    // Increment attempts
    await prisma.otpVerification.update({
      where: { id: otpRecord.id },
      data: { attempts: { increment: 1 } },
    });

    const remainingAttempts = config.otp.maxAttempts - otpRecord.attempts - 1;
    throw new ApiError(
      400,
      ErrorCodes.OTP_INVALID,
      `Invalid OTP. ${remainingAttempts} attempt(s) remaining.`,
    );
  }

  // Mark OTP as used
  await prisma.otpVerification.update({
    where: { id: otpRecord.id },
    data: { isUsed: true },
  });

  // Update user verification status
  const user = await prisma.user.update({
    where: { id: student.id },
    data: { isVerified: true },
  });

  logger.info(`User verified: ${studentId}`);

  // Generate tokens
  const tokenPayload: JwtPayload = {
    userId: user.id,
    studentId: user.studentId,
    email: user.email,
    role: user.role,
  };

  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  // Store refresh token
  const refreshExpiresAt = new Date();
  refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 30); // 30 days

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expiresAt: refreshExpiresAt,
    },
  });

  // Prepare user profile response
  const userProfile: UserProfile = {
    id: user.id,
    studentId: user.studentId,
    email: user.email,
    fullName: user.fullName,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    program: user.program,
    classYear: user.classYear,
    skills: safeJsonParse(user.skills, []),
    interests: safeJsonParse(user.interests, []),
    portfolioUrl: user.portfolioUrl,
    role: user.role,
    isVerified: user.isVerified,
    createdAt: user.createdAt,
  };

  // Check if profile setup is needed
  const needsProfileSetup = !user.fullName || !user.program || !user.classYear;

  return {
    accessToken,
    refreshToken,
    expiresIn: 3600, // 1 hour in seconds
    user: userProfile,
    needsProfileSetup,
  };
}

/**
 * Refresh access token
 */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<{ accessToken: string; expiresIn: number }> {
  // Verify refresh token
  let decoded: JwtPayload;
  try {
    decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as JwtPayload;
  } catch {
    throw new ApiError(401, ErrorCodes.TOKEN_INVALID, "Invalid refresh token");
  }

  // Check if refresh token exists in database
  const tokenRecord = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
    include: { user: true },
  });

  if (!tokenRecord) {
    throw new ApiError(
      401,
      ErrorCodes.TOKEN_INVALID,
      "Refresh token not found",
    );
  }

  if (tokenRecord.expiresAt < new Date()) {
    // Delete expired token
    await prisma.refreshToken.delete({ where: { id: tokenRecord.id } });
    throw new ApiError(401, ErrorCodes.TOKEN_EXPIRED, "Refresh token expired");
  }

  if (!tokenRecord.user.isActive) {
    throw new ApiError(
      401,
      ErrorCodes.UNAUTHORIZED,
      "User account is inactive",
    );
  }

  // Generate new access token
  const tokenPayload: JwtPayload = {
    userId: tokenRecord.user.id,
    studentId: tokenRecord.user.studentId,
    email: tokenRecord.user.email,
    role: tokenRecord.user.role,
  };

  const accessToken = generateAccessToken(tokenPayload);

  return {
    accessToken,
    expiresIn: 3600,
  };
}

/**
 * Logout - invalidate refresh token
 */
export async function logout(refreshToken: string): Promise<void> {
  await prisma.refreshToken.deleteMany({
    where: { token: refreshToken },
  });
}

/**
 * Logout from all devices
 */
export async function logoutAll(userId: string): Promise<void> {
  await prisma.refreshToken.deleteMany({
    where: { userId },
  });
}

/**
 * Clean up expired OTPs and refresh tokens
 */
export async function cleanupExpiredTokens(): Promise<void> {
  const now = new Date();

  // Delete expired OTPs
  const deletedOtps = await prisma.otpVerification.deleteMany({
    where: { expiresAt: { lt: now } },
  });

  // Delete expired refresh tokens
  const deletedTokens = await prisma.refreshToken.deleteMany({
    where: { expiresAt: { lt: now } },
  });

  logger.info(
    `Cleaned up ${deletedOtps.count} expired OTPs and ${deletedTokens.count} expired refresh tokens`,
  );
}

export default {
  generateAccessToken,
  generateRefreshToken,
  sendOtp,
  verifyOtp,
  refreshAccessToken,
  logout,
  logoutAll,
  cleanupExpiredTokens,
};
