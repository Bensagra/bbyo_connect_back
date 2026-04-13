import serverless from "serverless-http";

let handler: ReturnType<typeof serverless> | null = null;
let bootstrapError: string | null = null;

async function ensureHandler() {
  if (handler || bootstrapError) {
    return;
  }

  try {
    const module = await import("../src/app");
    const app = module.default;
    handler = serverless(app);
  } catch (error) {
    bootstrapError = error instanceof Error ? error.message : "Unknown bootstrap error";
  }
}

export default async function vercelHandler(req: any, res: any) {
  await ensureHandler();

  if (!handler) {
    const message = bootstrapError ?? "Unknown bootstrap error";
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
