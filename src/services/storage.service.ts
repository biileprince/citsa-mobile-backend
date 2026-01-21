import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";
import config from "../config/index.js";
import logger from "../utils/logger.js";

// Initialize S3 client
const s3Client = new S3Client({
  region: config.aws.region,
  credentials: {
    accessKeyId: config.aws.accessKeyId,
    secretAccessKey: config.aws.secretAccessKey,
  },
});

// Allowed file types
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];
const MAX_FILE_SIZE = {
  avatar: 5 * 1024 * 1024, // 5MB
  post: 10 * 1024 * 1024, // 10MB
  event: 10 * 1024 * 1024, // 10MB
};

export type UploadType = "avatar" | "post" | "event" | "group";

/**
 * Generate S3 key for upload
 */
function generateS3Key(
  type: UploadType,
  userId: string,
  filename: string,
): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "jpg";
  const uniqueId = uuidv4();

  switch (type) {
    case "avatar":
      return `avatars/${userId}/${uniqueId}.${ext}`;
    case "post":
      return `posts/${userId}/${uniqueId}.${ext}`;
    case "event":
      return `events/${userId}/${uniqueId}.${ext}`;
    case "group":
      return `groups/${uniqueId}.${ext}`;
    default:
      return `uploads/${userId}/${uniqueId}.${ext}`;
  }
}

/**
 * Upload file to S3
 */
export async function uploadFile(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  type: UploadType,
  userId: string,
): Promise<{ url: string; key: string }> {
  // Validate file type
  if (!ALLOWED_IMAGE_TYPES.includes(mimeType)) {
    throw new Error(
      `Invalid file type. Allowed types: ${ALLOWED_IMAGE_TYPES.join(", ")}`,
    );
  }

  // Validate file size
  const maxSize = MAX_FILE_SIZE[type] || MAX_FILE_SIZE.post;
  if (buffer.length > maxSize) {
    throw new Error(
      `File too large. Maximum size: ${maxSize / (1024 * 1024)}MB`,
    );
  }

  const key = generateS3Key(type, userId, filename);

  try {
    const command = new PutObjectCommand({
      Bucket: config.aws.s3Bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      // Make objects publicly readable
      ACL: "public-read",
    });

    await s3Client.send(command);

    const url = `${config.aws.s3Url}/${key}`;
    logger.info(`File uploaded to S3: ${key}`);

    return { url, key };
  } catch (error) {
    logger.error("Failed to upload file to S3:", error);
    throw new Error("Failed to upload file");
  }
}

/**
 * Delete file from S3
 */
export async function deleteFile(key: string): Promise<boolean> {
  try {
    const command = new DeleteObjectCommand({
      Bucket: config.aws.s3Bucket,
      Key: key,
    });

    await s3Client.send(command);
    logger.info(`File deleted from S3: ${key}`);
    return true;
  } catch (error) {
    logger.error("Failed to delete file from S3:", error);
    return false;
  }
}

/**
 * Generate presigned URL for file download
 */
export async function getPresignedUrl(
  key: string,
  expiresIn: number = 3600,
): Promise<string> {
  try {
    const command = new GetObjectCommand({
      Bucket: config.aws.s3Bucket,
      Key: key,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn });
    return url;
  } catch (error) {
    logger.error("Failed to generate presigned URL:", error);
    throw new Error("Failed to generate download URL");
  }
}

/**
 * Extract S3 key from URL
 */
export function extractKeyFromUrl(url: string): string | null {
  try {
    const s3UrlBase = config.aws.s3Url;
    if (url.startsWith(s3UrlBase)) {
      return url.replace(`${s3UrlBase}/`, "");
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Delete file by URL
 */
export async function deleteFileByUrl(url: string): Promise<boolean> {
  const key = extractKeyFromUrl(url);
  if (!key) {
    logger.warn(`Could not extract S3 key from URL: ${url}`);
    return false;
  }
  return deleteFile(key);
}

export default {
  uploadFile,
  deleteFile,
  getPresignedUrl,
  extractKeyFromUrl,
  deleteFileByUrl,
};
