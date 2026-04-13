import serverless from "serverless-http";
import { createApp } from "../src/app";

let handler: ReturnType<typeof serverless> | null = null;
let bootstrapError: unknown = null;

try {
  const app = createApp();
  handler = serverless(app);
} catch (error) {
  bootstrapError = error;
}

export default async function vercelHandler(req: any, res: any) {
  if (!handler) {
    const message = bootstrapError instanceof Error ? bootstrapError.message : "Unknown bootstrap error";
    (res as { statusCode: number; setHeader: (name: string, value: string) => void; end: (body: string) => void }).statusCode = 500;
    (res as { setHeader: (name: string, value: string) => void }).setHeader("content-type", "application/json; charset=utf-8");
    (res as { end: (body: string) => void }).end(
      JSON.stringify({
        data: null,
        meta: null,
        error: {
          code: "BOOTSTRAP_ERROR",
          message: "Server bootstrap failed",
          details: message,
        },
      }),
    );
    return;
  }

  return handler(req, res);
}
