import { Request, Response, NextFunction } from "express";
import { sendError } from "../utils/helpers.js";
import { ErrorCodes } from "../types/index.js";
import logger from "../utils/logger.js";

/**
 * Custom API Error class
 */
export class ApiError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  static badRequest(message: string, details?: unknown): ApiError {
    return new ApiError(400, ErrorCodes.INVALID_INPUT, message, details);
  }

  static unauthorized(message: string = "Unauthorized"): ApiError {
    return new ApiError(401, ErrorCodes.UNAUTHORIZED, message);
  }

  static forbidden(message: string = "Forbidden"): ApiError {
    return new ApiError(403, ErrorCodes.FORBIDDEN, message);
  }

  static notFound(message: string = "Resource not found"): ApiError {
    return new ApiError(404, ErrorCodes.NOT_FOUND, message);
  }

  static conflict(message: string, details?: unknown): ApiError {
    return new ApiError(409, ErrorCodes.CONFLICT, message, details);
  }

  static internal(message: string = "Internal server error"): ApiError {
    return new ApiError(500, ErrorCodes.INTERNAL_ERROR, message);
  }
}

/**
 * Global error handler middleware
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Log the error
  logger.error(`Error: ${err.message}`, {
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Handle ApiError
  if (err instanceof ApiError) {
    sendError(
      res,
      err.code as (typeof ErrorCodes)[keyof typeof ErrorCodes],
      err.message,
      err.statusCode,
      err.details,
    );
    return;
  }

  // Handle Prisma errors
  if (err.name === "PrismaClientKnownRequestError") {
    const prismaError = err as { code: string; meta?: { target?: string[] } };

    switch (prismaError.code) {
      case "P2002":
        sendError(
          res,
          ErrorCodes.ALREADY_EXISTS,
          `A record with this ${prismaError.meta?.target?.join(", ") || "field"} already exists`,
          409,
        );
        return;
      case "P2025":
        sendError(res, ErrorCodes.NOT_FOUND, "Record not found", 404);
        return;
      default:
        sendError(
          res,
          ErrorCodes.DATABASE_ERROR,
          "Database error occurred",
          500,
        );
        return;
    }
  }

  // Handle validation errors
  if (err.name === "ValidationError") {
    sendError(res, ErrorCodes.VALIDATION_ERROR, err.message, 400);
    return;
  }

  // Handle JWT errors
  if (err.name === "JsonWebTokenError") {
    sendError(res, ErrorCodes.TOKEN_INVALID, "Invalid token", 401);
    return;
  }

  if (err.name === "TokenExpiredError") {
    sendError(res, ErrorCodes.TOKEN_EXPIRED, "Token expired", 401);
    return;
  }

  // Default to internal server error
  sendError(
    res,
    ErrorCodes.INTERNAL_ERROR,
    process.env.NODE_ENV === "production"
      ? "Internal server error"
      : err.message,
    500,
  );
}

/**
 * Not found handler - for undefined routes
 */
export function notFoundHandler(req: Request, res: Response): void {
  sendError(
    res,
    ErrorCodes.NOT_FOUND,
    `Route ${req.method} ${req.path} not found`,
    404,
  );
}

/**
 * Async wrapper to catch errors in async route handlers
 */
export function asyncHandler<T>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
