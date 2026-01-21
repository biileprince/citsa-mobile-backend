import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import {
  AuthenticatedRequest,
  JwtPayload,
  ErrorCodes,
} from "../types/index.js";
import { sendError } from "../utils/helpers.js";
import config from "../config/index.js";
import prisma from "../config/database.js";

/**
 * Authentication middleware - verifies JWT token
 */
export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      sendError(res, ErrorCodes.UNAUTHORIZED, "Access token required", 401);
      return;
    }

    const token = authHeader.split(" ")[1];

    try {
      const decoded = jwt.verify(token, config.jwt.accessSecret) as JwtPayload;

      // Verify user still exists and is active
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, isActive: true, role: true },
      });

      if (!user || !user.isActive) {
        sendError(
          res,
          ErrorCodes.UNAUTHORIZED,
          "User not found or inactive",
          401,
        );
        return;
      }

      req.user = decoded;
      next();
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        sendError(res, ErrorCodes.TOKEN_EXPIRED, "Access token expired", 401);
        return;
      }
      if (err instanceof jwt.JsonWebTokenError) {
        sendError(res, ErrorCodes.TOKEN_INVALID, "Invalid access token", 401);
        return;
      }
      throw err;
    }
  } catch (error) {
    next(error);
  }
}

/**
 * Optional authentication - sets user if token is valid, but doesn't require it
 */
export async function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      next();
      return;
    }

    const token = authHeader.split(" ")[1];

    try {
      const decoded = jwt.verify(token, config.jwt.accessSecret) as JwtPayload;
      req.user = decoded;
    } catch {
      // Token invalid, but we continue without user
    }

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Authorization middleware - checks if user has required role(s)
 */
export function authorize(...allowedRoles: string[]) {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): void => {
    if (!req.user) {
      sendError(res, ErrorCodes.UNAUTHORIZED, "Authentication required", 401);
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      sendError(
        res,
        ErrorCodes.FORBIDDEN,
        "You do not have permission to perform this action",
        403,
      );
      return;
    }

    next();
  };
}

/**
 * Role-based access control helpers
 */
export const requireAdmin = authorize("ADMIN");
export const requireClassRep = authorize("CLASS_REP", "ADMIN");
export const requireStudent = authorize("STUDENT", "CLASS_REP", "ADMIN");
