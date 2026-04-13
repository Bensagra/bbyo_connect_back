import { MessageContentType, Role } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { ok, fail } from "../../common/api-response";
import { asyncHandler } from "../../common/async-handler";
import { canModerate } from "../../common/permissions";
import { findBlockedWord } from "../../common/safety";
import { requireAuth } from "../../middlewares/auth";
import { denyRoles } from "../../middlewares/rbac";
import { validateBody, validateParams, validateQuery } from "../../middlewares/validate";
import { prisma } from "../../lib/prisma";
import { emitToConversation, emitToUser } from "../../realtime/socket";

const messagingRouter = Router();

const conversationIdSchema = z.object({
  id: z.string().min(1),
});

const messageIdSchema = z.object({
  id: z.string().min(1),
});

const createConversationSchema = z.object({
  type: z.enum(["private", "group", "chapter"]),
  title: z.string().max(120).optional(),
  isEncrypted: z.boolean().default(false),
  memberIds: z.array(z.string().min(1)).min(1).max(100),
});

const createMessageSchema = z.object({
  content: z.string().min(1).max(5000),
  contentType: z.enum(["text", "image", "video", "audio", "voice_note", "file", "system"]).default("text"),
  attachments: z
    .array(
      z.object({
        url: z.string().url(),
        type: z.enum(["image", "video", "audio", "voice_note", "file"]),
        sizeBytes: z.number().int().positive().optional(),
      }),
    )
    .default([]),
});

const updateMessageSchema = z.object({
  content: z.string().min(1).max(5000),
});

const listMessagesQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

async function ensureConversationMember(conversationId: string, userId: string) {
  const member = await prisma.conversationMember.findFirst({
    where: {
      conversationId,
      userId,
      deletedAt: null,
    },
  });
  return Boolean(member);
}

messagingRouter.get(
  "/conversations",
  requireAuth,
  denyRoles([Role.guest]),
  asyncHandler(async (req, res) => {
    const actor = req.authUser!;

    const memberships = await prisma.conversationMember.findMany({
      where: {
        userId: actor.id,
        deletedAt: null,
      },
      include: {
        conversation: {
          include: {
            members: {
              where: { deletedAt: null },
            },
          },
        },
      },
      orderBy: {
        conversation: {
          updatedAt: "desc",
        },
      },
    });

    const conversations = memberships.map((m) => m.conversation);
    return ok(res, conversations);
  }),
);

messagingRouter.post(
  "/conversations",
  requireAuth,
  denyRoles([Role.guest]),
  validateBody(createConversationSchema),
  asyncHandler(async (req, res) => {
    const actor = req.authUser!;
    const body = req.body as z.infer<typeof createConversationSchema>;

    if (actor.role === Role.teen_pending && body.type === "private") {
      return fail(res, 403, "PENDING_PRIVATE_CHAT_RESTRICTED", "Pending teens cannot use private messaging");
    }

    const uniqueMemberIds = [...new Set([...body.memberIds, actor.id])];
    const members = await prisma.user.findMany({
      where: {
        id: { in: uniqueMemberIds },
        deletedAt: null,
      },
      select: { id: true, role: true, status: true },
    });

    if (members.length !== uniqueMemberIds.length) {
      return fail(res, 400, "INVALID_MEMBERS", "One or more members do not exist");
    }

    if (members.some((member) => member.role === Role.guest)) {
      return fail(res, 403, "GUEST_CHAT_FORBIDDEN", "Guest users cannot be part of chat conversations");
    }

    const conversation = await prisma.conversation.create({
      data: {
        type: body.type,
        title: body.title,
        isEncrypted: body.isEncrypted,
        members: {
          create: uniqueMemberIds.map((id) => ({
            userId: id,
            role: id === actor.id ? "owner" : "member",
          })),
        },
      },
      include: {
        members: true,
      },
    });

    emitToConversation(conversation.id, "conversation.updated", {
      action: "created",
      conversation,
    });

    return ok(res, conversation, undefined, 201);
  }),
);

messagingRouter.get(
  "/conversations/:id/messages",
  requireAuth,
  denyRoles([Role.guest]),
  validateParams(conversationIdSchema),
  validateQuery(listMessagesQuery),
  asyncHandler(async (req, res) => {
    const actor = req.authUser!;
    const { id } = req.params as z.infer<typeof conversationIdSchema>;
    const { cursor, limit } = req.query as unknown as z.infer<typeof listMessagesQuery>;

    const isMember = await ensureConversationMember(id, actor.id);
    if (!isMember) {
      return fail(res, 403, "FORBIDDEN", "You are not part of this conversation");
    }

    const messages = await prisma.message.findMany({
      where: {
        conversationId: id,
        deletedAt: null,
      },
      include: {
        attachments: {
          where: { deletedAt: null },
        },
        readReceipts: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasNextPage = messages.length > limit;
    const sliced = hasNextPage ? messages.slice(0, limit) : messages;

    return ok(res, sliced, {
      nextCursor: hasNextPage ? sliced[sliced.length - 1]?.id : null,
      hasNextPage,
    });
  }),
);

messagingRouter.post(
  "/conversations/:id/messages",
  requireAuth,
  denyRoles([Role.guest]),
  validateParams(conversationIdSchema),
  validateBody(createMessageSchema),
  asyncHandler(async (req, res) => {
    const actor = req.authUser!;
    const { id: conversationId } = req.params as z.infer<typeof conversationIdSchema>;
    const body = req.body as z.infer<typeof createMessageSchema>;

    const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation || conversation.deletedAt) {
      return fail(res, 404, "CONVERSATION_NOT_FOUND", "Conversation not found");
    }

    const isMember = await ensureConversationMember(conversationId, actor.id);
    if (!isMember) {
      return fail(res, 403, "FORBIDDEN", "You are not part of this conversation");
    }

    if (actor.role === Role.teen_pending && conversation.type === "private") {
      return fail(res, 403, "PENDING_PRIVATE_CHAT_RESTRICTED", "Pending teens cannot send private messages");
    }

    const blockedWord = findBlockedWord(body.content);
    if (blockedWord) {
      return fail(res, 422, "CONTENT_FLAGGED", "Message contains restricted language", { blockedWord });
    }

    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId: actor.id,
        content: body.content,
        contentType: body.contentType as MessageContentType,
        attachments: {
          create: body.attachments,
        },
      },
      include: {
        attachments: true,
      },
    });

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });

    const recipients = await prisma.conversationMember.findMany({
      where: {
        conversationId,
        deletedAt: null,
        userId: { not: actor.id },
      },
      select: { userId: true },
    });

    for (const recipient of recipients) {
      const notification = await prisma.notification.create({
        data: {
          userId: recipient.userId,
          type: "message",
          title: "New message",
          body: "You received a new message",
          dataJson: {
            conversationId,
            messageId: message.id,
            senderId: actor.id,
          },
        },
      });

      emitToUser(recipient.userId, "notification.created", notification);
    }

    emitToConversation(conversationId, "message.created", message);

    return ok(res, message, undefined, 201);
  }),
);

messagingRouter.patch(
  "/messages/:id",
  requireAuth,
  denyRoles([Role.guest]),
  validateParams(messageIdSchema),
  validateBody(updateMessageSchema),
  asyncHandler(async (req, res) => {
    const actor = req.authUser!;
    const { id } = req.params as z.infer<typeof messageIdSchema>;
    const body = req.body as z.infer<typeof updateMessageSchema>;

    const message = await prisma.message.findUnique({ where: { id } });
    if (!message || message.deletedAt) {
      return fail(res, 404, "MESSAGE_NOT_FOUND", "Message not found");
    }

    if (message.senderId !== actor.id && !canModerate(actor.role)) {
      return fail(res, 403, "FORBIDDEN", "Only sender or moderator can edit this message");
    }

    const blockedWord = findBlockedWord(body.content);
    if (blockedWord) {
      return fail(res, 422, "CONTENT_FLAGGED", "Message contains restricted language", { blockedWord });
    }

    const updated = await prisma.message.update({
      where: { id },
      data: {
        content: body.content,
        editedAt: new Date(),
      },
      include: { attachments: true },
    });

    emitToConversation(updated.conversationId, "message.edited", updated);

    return ok(res, updated);
  }),
);

messagingRouter.delete(
  "/messages/:id",
  requireAuth,
  denyRoles([Role.guest]),
  validateParams(messageIdSchema),
  asyncHandler(async (req, res) => {
    const actor = req.authUser!;
    const { id } = req.params as z.infer<typeof messageIdSchema>;

    const message = await prisma.message.findUnique({ where: { id } });
    if (!message || message.deletedAt) {
      return fail(res, 404, "MESSAGE_NOT_FOUND", "Message not found");
    }

    if (message.senderId !== actor.id && !canModerate(actor.role)) {
      return fail(res, 403, "FORBIDDEN", "Only sender or moderator can delete this message");
    }

    const deleted = await prisma.message.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });

    emitToConversation(deleted.conversationId, "message.deleted", {
      id: deleted.id,
      conversationId: deleted.conversationId,
      deletedAt: deleted.deletedAt,
    });

    return ok(res, { deleted: true });
  }),
);

messagingRouter.post(
  "/messages/:id/read",
  requireAuth,
  denyRoles([Role.guest]),
  validateParams(messageIdSchema),
  asyncHandler(async (req, res) => {
    const actor = req.authUser!;
    const { id } = req.params as z.infer<typeof messageIdSchema>;

    const message = await prisma.message.findUnique({ where: { id } });
    if (!message || message.deletedAt) {
      return fail(res, 404, "MESSAGE_NOT_FOUND", "Message not found");
    }

    const isMember = await ensureConversationMember(message.conversationId, actor.id);
    if (!isMember) {
      return fail(res, 403, "FORBIDDEN", "You are not part of this conversation");
    }

    const receipt = await prisma.messageReadReceipt.upsert({
      where: {
        messageId_userId: {
          messageId: id,
          userId: actor.id,
        },
      },
      create: {
        messageId: id,
        userId: actor.id,
        readAt: new Date(),
      },
      update: {
        readAt: new Date(),
      },
    });

    emitToConversation(message.conversationId, "conversation.updated", {
      action: "read-receipt",
      receipt,
    });

    return ok(res, receipt, undefined, 201);
  }),
);

export { messagingRouter };
