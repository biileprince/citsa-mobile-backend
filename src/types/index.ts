import { Request, Response, NextFunction } from "express";

// API Response Interface
export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  pagination?: PaginationMeta;
}

// Pagination
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

// JWT Payload
export interface JwtPayload {
  userId: string;
  studentId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

// Extend Express Request to include user
export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

// Controller function type
export type ControllerFunction = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<void> | void;

// Auth Types
export interface SendOtpRequest {
  studentId: string;
}

export interface VerifyOtpRequest {
  studentId: string;
  otpCode: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: UserProfile;
  needsProfileSetup?: boolean;
}

// User Types
export interface UserProfile {
  id: string;
  studentId: string;
  email: string;
  fullName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  program: string | null;
  classYear: string | null;
  skills: string[];
  interests: string[];
  portfolioUrl: string | null;
  role: string;
  isVerified: boolean;
  createdAt: Date;
}

export interface ProfileSetupRequest {
  fullName: string;
  bio?: string;
  program: string;
  classYear: string;
  skills?: string[];
  interests?: string[];
  portfolioUrl?: string;
}

export interface ProfileUpdateRequest {
  fullName?: string;
  bio?: string;
  program?: string;
  classYear?: string;
  skills?: string[];
  interests?: string[];
  portfolioUrl?: string;
}

// Post Types
export interface CreatePostRequest {
  type: "ANNOUNCEMENT" | "EVENT" | "OPPORTUNITY" | "BLOG" | "TESTIMONY";
  category?: "POSITIVE_NEWS" | "EVENTS" | "OPPORTUNITY" | "BLOG" | "TESTIMONY";
  title?: string;
  content: string;
  imageUrl?: string;
  isPinned?: boolean;
  // Event-specific fields
  eventDate?: string;
  eventTime?: string;
  location?: string;
  capacityMax?: number;
  registrationDeadline?: string;
  tags?: string[];
  isUrgent?: boolean;
}

export interface PostQueryParams {
  type?: string;
  category?: string;
  page?: string;
  limit?: string;
  search?: string;
}

// Comment Types
export interface CreateCommentRequest {
  content: string;
  parentCommentId?: string;
}

// Event Types
export interface EventQueryParams {
  page?: string;
  limit?: string;
  search?: string;
  upcoming?: string;
}

// Group Types
export interface GroupQueryParams {
  category?: string;
  page?: string;
  limit?: string;
  search?: string;
}

// Classroom Types
export interface CreateAnnouncementRequest {
  title: string;
  content: string;
  isPinned?: boolean;
  isUrgent?: boolean;
}

// Notification Types
export interface NotificationQueryParams {
  page?: string;
  limit?: string;
  unreadOnly?: string;
}

// Error Codes
export const ErrorCodes = {
  // Auth errors
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  TOKEN_INVALID: "TOKEN_INVALID",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",

  // OTP errors
  OTP_EXPIRED: "OTP_EXPIRED",
  OTP_INVALID: "OTP_INVALID",
  OTP_MAX_ATTEMPTS: "OTP_MAX_ATTEMPTS",
  OTP_RATE_LIMITED: "OTP_RATE_LIMITED",

  // Validation errors
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_INPUT: "INVALID_INPUT",

  // Resource errors
  NOT_FOUND: "NOT_FOUND",
  ALREADY_EXISTS: "ALREADY_EXISTS",
  CONFLICT: "CONFLICT",

  // Server errors
  INTERNAL_ERROR: "INTERNAL_ERROR",
  DATABASE_ERROR: "DATABASE_ERROR",
  EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR",

  // Event errors
  EVENT_FULL: "EVENT_FULL",
  REGISTRATION_CLOSED: "REGISTRATION_CLOSED",
  ALREADY_REGISTERED: "ALREADY_REGISTERED",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
