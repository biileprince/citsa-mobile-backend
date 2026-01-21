import { Response } from "express";
import { ApiResponse, PaginationMeta, ErrorCode } from "../types/index.js";

/**
 * Send a successful response
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode: number = 200,
  pagination?: PaginationMeta,
): Response {
  const response: ApiResponse<T> = {
    success: true,
    message,
    data,
    pagination,
  };
  return res.status(statusCode).json(response);
}

/**
 * Send an error response
 */
export function sendError(
  res: Response,
  code: ErrorCode,
  message: string,
  statusCode: number = 400,
  details?: unknown,
): Response {
  const response: ApiResponse = {
    success: false,
    error: {
      code,
      message,
      details,
    },
  };
  return res.status(statusCode).json(response);
}

/**
 * Send created response (201)
 */
export function sendCreated<T>(
  res: Response,
  data: T,
  message?: string,
): Response {
  return sendSuccess(res, data, message, 201);
}

/**
 * Send no content response (204)
 */
export function sendNoContent(res: Response): Response {
  return res.status(204).send();
}

/**
 * Calculate pagination metadata
 */
export function calculatePagination(
  page: number,
  limit: number,
  total: number,
): PaginationMeta {
  const totalPages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

/**
 * Parse pagination params from query
 */
export function parsePaginationParams(
  page?: string,
  limit?: string,
  defaultLimit: number = 20,
  maxLimit: number = 100,
): { page: number; limit: number; skip: number } {
  const parsedPage = Math.max(1, parseInt(page || "1", 10));
  const parsedLimit = Math.min(
    maxLimit,
    Math.max(1, parseInt(limit || String(defaultLimit), 10)),
  );
  const skip = (parsedPage - 1) * parsedLimit;

  return {
    page: parsedPage,
    limit: parsedLimit,
    skip,
  };
}

/**
 * Generate a random OTP code
 */
export function generateOtpCode(length: number = 6): string {
  const digits = "0123456789";
  let otp = "";
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * digits.length)];
  }
  return otp;
}

/**
 * Generate student email from student ID
 */
export function generateStudentEmail(
  studentId: string,
  domain: string,
): string {
  return `${studentId}@${domain}`;
}

/**
 * Mask email for public display (e.g., 123****89@university.edu)
 */
export function maskEmail(email: string): string {
  const [localPart, domain] = email.split("@");
  if (localPart.length <= 4) {
    return `${localPart[0]}***@${domain}`;
  }
  const visibleStart = localPart.slice(0, 3);
  const visibleEnd = localPart.slice(-2);
  return `${visibleStart}****${visibleEnd}@${domain}`;
}

/**
 * Validate student ID format (9 digits)
 */
export function isValidStudentId(studentId: string): boolean {
  return /^\d{9}$/.test(studentId);
}

/**
 * Parse JSON safely
 */
export function safeJsonParse<T>(json: unknown, defaultValue: T): T {
  if (typeof json === "string") {
    try {
      return JSON.parse(json) as T;
    } catch {
      return defaultValue;
    }
  }
  if (Array.isArray(json) || (typeof json === "object" && json !== null)) {
    return json as T;
  }
  return defaultValue;
}

/**
 * Omit sensitive fields from user object
 */
export function sanitizeUser<T extends Record<string, unknown>>(
  user: T,
  fieldsToOmit: string[] = ["refreshTokens"],
): Partial<T> {
  const sanitized = { ...user };
  fieldsToOmit.forEach((field) => {
    delete sanitized[field];
  });
  return sanitized;
}
