import { v2 as cloudinary } from "cloudinary";
import { v4 as uuidv4 } from "uuid";
import config from "../config/index.js";
import logger from "../utils/logger.js";

// Initialize Cloudinary client
cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
  secure: true,
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
  group: 10 * 1024 * 1024, // 10MB
};

export type UploadType = "avatar" | "post" | "event" | "group";

/**
 * Generate Cloudinary public ID for upload
 */
function generatePublicId(
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
 * Upload file to Cloudinary
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

  const publicId = generatePublicId(type, userId, filename);

  try {
    // Validate Cloudinary credentials are configured
    if (
      !config.cloudinary.cloudName ||
      !config.cloudinary.apiKey ||
      !config.cloudinary.apiSecret
    ) {
      throw new Error(
        "Cloudinary credentials not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.",
      );
    }

    const dataUri = `data:${mimeType};base64,${buffer.toString("base64")}`;
    const result = await cloudinary.uploader.upload(dataUri, {
      public_id: publicId,
      folder: config.cloudinary.folder,
      resource_type: "image",
      overwrite: true,
    });

    const url = result.secure_url;
    logger.info(`File uploaded to Cloudinary: ${result.public_id}`);

    return { url, key: result.public_id };
  } catch (error: any) {
    logger.error("Failed to upload file to Cloudinary:", {
      error: error.message,
      code: error.code || error.name,
      publicId,
    });

    throw new Error(`Failed to upload file: ${error.message}`);
  }
}

/**
 * Delete file from Cloudinary
 */
export async function deleteFile(key: string): Promise<boolean> {
  try {
    const result = await cloudinary.uploader.destroy(key, {
      resource_type: "image",
    });
    if (result.result !== "ok" && result.result !== "not found") {
      logger.warn("Unexpected Cloudinary delete response", { key, result });
    }
    logger.info(`File deleted from Cloudinary: ${key}`);
    return true;
  } catch (error: any) {
    logger.error("Failed to delete file from Cloudinary:", {
      key,
      error: error.message,
    });
    return false;
  }
}

/**
 * Generate URL for file download
 */
export async function getPresignedUrl(
  key: string,
  _expiresIn: number = 3600,
): Promise<string> {
  try {
    return cloudinary.url(key, {
      secure: true,
      resource_type: "image",
    });
  } catch (error) {
    logger.error("Failed to generate Cloudinary URL:", error);
    throw new Error("Failed to generate download URL");
  }
}

/**
 * Extract Cloudinary public ID from URL
 */
export function extractKeyFromUrl(url: string): string | null {
  try {
    const marker = "/upload/";
    const idx = url.indexOf(marker);
    if (idx === -1) {
      return null;
    }

    let pathPart = url.slice(idx + marker.length);
    const queryIdx = pathPart.indexOf("?");
    if (queryIdx !== -1) {
      pathPart = pathPart.slice(0, queryIdx);
    }

    const segments = pathPart.split("/");
    // Remove transformation/version segment if present (e.g., v1712345678)
    if (segments.length > 0 && /^v\d+$/.test(segments[0])) {
      segments.shift();
    }

    const joined = segments.join("/");
    const dotIdx = joined.lastIndexOf(".");
    return dotIdx === -1 ? joined : joined.slice(0, dotIdx);
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
    logger.warn(`Could not extract Cloudinary public ID from URL: ${url}`);
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
