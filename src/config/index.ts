import dotenv from "dotenv";
import path from "path";

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export const config = {
  // Server
  env: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "3000", 10),
  apiVersion: process.env.API_VERSION || "v1",

  // JWT
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || "default-access-secret",
    refreshSecret: process.env.JWT_REFRESH_SECRET || "default-refresh-secret",
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || "1h",
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || "30d",
  },

  // OTP
  otp: {
    expirySeconds: parseInt(process.env.OTP_EXPIRY_SECONDS || "60", 10),
    maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS || "3", 10),
    rateLimitWindowMinutes: parseInt(
      process.env.OTP_RATE_LIMIT_WINDOW_MINUTES || "5",
      10,
    ),
    rateLimitMaxRequests: parseInt(
      process.env.OTP_RATE_LIMIT_MAX_REQUESTS || "3",
      10,
    ),
  },

  // Resend API (email delivery)
  resend: {
    apiKey: process.env.RESEND_API_KEY || "",
    fromEmail: process.env.RESEND_FROM_EMAIL || "noreply@clink.citsaucc.org",
    fromName: process.env.RESEND_FROM_NAME || "CITSA App",
  },

  // AWS S3
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    region: process.env.AWS_REGION || "us-east-1",
    s3Bucket: process.env.AWS_S3_BUCKET || "citsa-uploads",
    s3Url: process.env.AWS_S3_URL || "",
  },

  // University
  universityEmailDomain:
    process.env.UNIVERSITY_EMAIL_DOMAIN || "university.edu",

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100", 10),
  },

  // CORS
  corsOrigin: process.env.CORS_ORIGIN || "*",

  // Logging
  logLevel: process.env.LOG_LEVEL || "debug",

  // Pagination
  pagination: {
    defaultLimit: 20,
    maxLimit: 100,
  },
};

export default config;
