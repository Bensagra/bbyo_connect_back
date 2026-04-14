import { getApps, initializeApp, cert, App } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { logger } from "../config/logger";
import { prisma } from "./prisma";

let firebaseApp: App | null = null;
let initAttempted = false;

function getFirebaseApp(): App | null {
  if (firebaseApp) {
    return firebaseApp;
  }

  if (initAttempted) {
    return null;
  }

  initAttempted = true;

  const projectId = process.env["FIREBASE_PROJECT_ID"]?.trim() ?? "";
  const clientEmail = process.env["FIREBASE_CLIENT_EMAIL"]?.trim() ?? "";
  const privateKey =
    process.env["FIREBASE_PRIVATE_KEY"]?.replace(/\\n/g, "\n") ?? "";

  if (!projectId || !clientEmail || !privateKey) {
    logger.warn(
      "Firebase messaging disabled: missing FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY",
    );
    return null;
  }

  try {
    firebaseApp =
      getApps()[0] ??
      initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });

    logger.info("Firebase messaging initialized");
    return firebaseApp;
  } catch (error) {
    logger.warn({ err: error }, "Failed to initialize Firebase messaging");
    firebaseApp = null;
    return null;
  }
}

function toStringData(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") {
    return {};
  }

  const entries = Object.entries(value as Record<string, unknown>);
  const output: Record<string, string> = {};
  for (const [key, raw] of entries) {
    if (raw == null) {
      continue;
    }
    output[key] = String(raw);
  }
  return output;
}

export async function sendPushNotificationToUser(params: {
  userId: string;
  title: string;
  body: string;
  dataJson?: unknown;
}) {
  const app = getFirebaseApp();
  if (!app) {
    return;
  }

  const tokens = await prisma.deviceToken.findMany({
    where: {
      userId: params.userId,
      deletedAt: null,
    },
    select: {
      pushToken: true,
    },
  });

  if (!tokens.length) {
    return;
  }

  try {
    const messaging = getMessaging(app);
    const response = await messaging.sendEachForMulticast({
      tokens: tokens.map((item) => item.pushToken),
      notification: {
        title: params.title,
        body: params.body,
      },
      data: toStringData(params.dataJson),
    });

    if (response.failureCount > 0) {
      logger.warn(
        {
          userId: params.userId,
          failureCount: response.failureCount,
        },
        "Some push notifications failed",
      );
    }
  } catch (error) {
    logger.warn(
      {
        err: error,
        userId: params.userId,
      },
      "Push notification send failed",
    );
  }
}
