import admin from "firebase-admin";
import prisma from "../config/database.js";
import config from "../config/index.js";
import logger from "../utils/logger.js";

export interface PushMessagePayload {
  title: string;
  body: string;
  data?: Record<string, string | number | boolean | null | undefined>;
}

let firebaseInitialized = false;

function ensureFirebaseInitialized(): boolean {
  if (firebaseInitialized) {
    return true;
  }

  const { projectId, clientEmail, privateKey } = config.firebase;
  if (!projectId || !clientEmail || !privateKey) {
    logger.warn(
      "Firebase credentials are not configured. Push notifications will be skipped.",
    );
    return false;
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      } as admin.ServiceAccount),
    });
  }

  firebaseInitialized = true;
  return true;
}

function normalizeData(
  data?: Record<string, string | number | boolean | null | undefined>,
): Record<string, string> | undefined {
  if (!data) {
    return undefined;
  }

  const normalized = Object.entries(data).reduce<Record<string, string>>(
    (accumulator, [key, value]) => {
      if (value === undefined || value === null) {
        return accumulator;
      }

      accumulator[key] = String(value);
      return accumulator;
    },
    {},
  );

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function isInvalidTokenError(error: any): boolean {
  const code = error?.code || "";
  return [
    "messaging/invalid-registration-token",
    "messaging/registration-token-not-registered",
    "messaging/invalid-argument",
  ].includes(code);
}

async function cleanupInvalidTokens(tokens: string[]): Promise<void> {
  if (tokens.length === 0) {
    return;
  }

  await prisma.deviceToken.deleteMany({
    where: { token: { in: tokens } },
  });
}

export async function sendPushToTokens(
  tokens: string[],
  payload: PushMessagePayload,
): Promise<{ sent: number; failed: number; removed: number }> {
  if (!ensureFirebaseInitialized() || tokens.length === 0) {
    return { sent: 0, failed: 0, removed: 0 };
  }

  const messaging = admin.messaging();
  const invalidTokens: string[] = [];
  let sent = 0;
  let failed = 0;

  for (let index = 0; index < tokens.length; index += 500) {
    const chunk = tokens.slice(index, index + 500);
    const response = await messaging.sendEachForMulticast({
      tokens: chunk,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: normalizeData(payload.data),
    });

    sent += response.successCount;
    failed += response.failureCount;

    response.responses.forEach((item, responseIndex) => {
      if (!item.success && isInvalidTokenError(item.error)) {
        invalidTokens.push(chunk[responseIndex]);
      }
    });
  }

  await cleanupInvalidTokens(invalidTokens);

  return { sent, failed, removed: invalidTokens.length };
}

export async function sendPushToUsers(
  userIds: string[],
  payload: PushMessagePayload,
): Promise<{ sent: number; failed: number; removed: number }> {
  if (userIds.length === 0) {
    return { sent: 0, failed: 0, removed: 0 };
  }

  const tokens = await prisma.deviceToken.findMany({
    where: {
      userId: { in: userIds },
      isActive: true,
    },
    select: { token: true },
  });

  return sendPushToTokens(
    tokens.map((entry) => entry.token),
    payload,
  );
}

export async function sendPushToUser(
  userId: string,
  payload: PushMessagePayload,
): Promise<{ sent: number; failed: number; removed: number }> {
  return sendPushToUsers([userId], payload);
}

export default {
  sendPushToTokens,
  sendPushToUsers,
  sendPushToUser,
};
