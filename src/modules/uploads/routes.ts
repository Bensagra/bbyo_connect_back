import crypto from "crypto";
import { Role } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { ok } from "../../common/api-response";
import { asyncHandler } from "../../common/async-handler";
import { env } from "../../config/env";
import { requireAuth } from "../../middlewares/auth";
import { denyRoles } from "../../middlewares/rbac";
import { validateBody } from "../../middlewares/validate";

const uploadsRouter = Router();

const presignSchema = z.object({
  fileName: z.string().min(1).max(256),
  contentType: z.string().min(1).max(120),
  sizeBytes: z.number().int().positive().max(20 * 1024 * 1024),
});

uploadsRouter.post(
  "/presign",
  requireAuth,
  denyRoles([Role.guest]),
  validateBody(presignSchema),
  asyncHandler(async (req, res) => {
    const actor = req.authUser!;
    const body = req.body as z.infer<typeof presignSchema>;

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const objectKey = `${actor.id}/${Date.now()}-${body.fileName}`;
    const payload = `${objectKey}:${body.contentType}:${body.sizeBytes}:${expiresAt.toISOString()}`;
    const signature = crypto.createHmac("sha256", env.uploadSigningSecret).update(payload).digest("hex");

    const uploadUrl = `https://uploads.bbyo-connect.example/upload/${encodeURIComponent(objectKey)}?sig=${signature}`;
    const fileUrl = `https://cdn.bbyo-connect.example/${encodeURIComponent(objectKey)}`;

    return ok(
      res,
      {
        uploadUrl,
        fileUrl,
        method: "PUT",
        headers: {
          "content-type": body.contentType,
          "x-upload-signature": signature,
        },
        expiresAt: expiresAt.toISOString(),
      },
      undefined,
      201,
    );
  }),
);

export { uploadsRouter };
