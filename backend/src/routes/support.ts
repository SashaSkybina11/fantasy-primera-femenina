import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { asyncRoute, ApiError } from "../utils/http.js";
import { deleteSupportFile, safeSupportFileName, sendSupportFile, storeSupportFile, supportUpload } from "../services/support-files.js";

const router = Router();
router.use(authenticate);
async function requireSupportAdmin(request: import("express").Request, _response: import("express").Response, next: import("express").NextFunction) {
  try {
    const admin = await prisma.user.findUnique({ where: { id: request.auth!.userId }, select: { role: true, email: true } });
    if (admin?.role !== "ADMIN" || admin.email.toLowerCase() !== "sashaskibina16@gmail.com") return next(new ApiError(403, "Недостаточно прав администратора"));
    next();
  } catch (error) { next(error); }
}
const bodySchema = z.string().trim().max(4000);
const messageInclude = { sender: { select: { id: true, name: true, role: true } }, attachments: { select: { id: true, fileName: true, contentType: true, size: true } } } as const;
const conversationInclude = { user: { select: { id: true, name: true, email: true, avatarUrl: true } }, messages: { orderBy: { createdAt: "asc" as const }, include: messageInclude } };

async function createMessage(conversationId: string, senderId: string, isAdmin: boolean, bodyText: string, files: Express.Multer.File[]) {
  const body = bodySchema.parse(bodyText);
  if (!body && !files.length) throw new ApiError(400, "Write a message or attach a file");
  const stored = [] as Awaited<ReturnType<typeof storeSupportFile>>[];
  try {
    for (const file of files) stored.push(await storeSupportFile(file, conversationId));
    const message = await prisma.$transaction(async tx => {
      const created = await tx.supportMessage.create({ data: { conversationId, senderId, isAdmin, body, attachments: { create: stored.map(file => file) } }, include: messageInclude });
      await tx.supportConversation.update({ where: { id: conversationId }, data: { lastMessageAt: created.createdAt, ...(isAdmin ? { lastReadByAdminAt: created.createdAt } : { lastReadByUserAt: created.createdAt }) } });
      if (!isAdmin) {
        const admin = await tx.user.findUnique({ where: { email: "sashaskibina16@gmail.com" }, select: { id: true, role: true, status: true } });
        if (!admin || admin.role !== "ADMIN" || admin.status !== "ACTIVE") throw new ApiError(503, "The support administrator account is unavailable");
        const sender = await tx.user.findUniqueOrThrow({ where: { id: senderId }, select: { name: true, email: true } });
        const shortText = body.slice(0, 240) || `${stored.length} attachment(s)`;
        const contents = {
          es: { title: `Nuevo mensaje de ${sender.name}`, message: `${sender.email}: ${shortText}`, action: "Abrir chat", url: "/admin/support" },
          uk: { title: `Нове повідомлення від ${sender.name}`, message: `${sender.email}: ${shortText}`, action: "Відкрити чат", url: "/admin/support" },
          en: { title: `New message from ${sender.name}`, message: `${sender.email}: ${shortText}`, action: "Open chat", url: "/admin/support" },
          pt: { title: `Nova mensagem de ${sender.name}`, message: `${sender.email}: ${shortText}`, action: "Abrir conversa", url: "/admin/support" },
        };
        const notification = await tx.notification.create({ data: { type: "SUPPORT_MESSAGE", audience: "USERS", createdById: senderId, eventKey: `SUPPORT_MESSAGE:${created.id}`, payload: { contents }, recipients: { create: { userId: admin.id } } } });
        void notification;
      } else {
        const owner = await tx.supportConversation.findUniqueOrThrow({ where: { id: conversationId }, select: { userId: true } });
        const sender = await tx.user.findUniqueOrThrow({ where: { id: senderId }, select: { name: true } });
        const contents = {
          es: { title: "Respuesta del administrador", message: `${sender.name}: ${body.slice(0, 240) || `${stored.length} archivo(s) adjunto(s)}`}`, action: "Abrir chat", url: "/support" },
          uk: { title: "Відповідь адміністратора", message: `${sender.name}: ${body.slice(0, 240) || `Додано файлів: ${stored.length}`}`, action: "Відкрити чат", url: "/support" },
          en: { title: "Reply from the administrator", message: `${sender.name}: ${body.slice(0, 240) || `${stored.length} attachment(s)}`}`, action: "Open chat", url: "/support" },
          pt: { title: "Resposta do administrador", message: `${sender.name}: ${body.slice(0, 240) || `${stored.length} ficheiro(s) anexado(s)`}`, action: "Abrir conversa", url: "/support" },
        };
        await tx.notification.create({ data: { type: "SUPPORT_MESSAGE", audience: "USERS", createdById: senderId, eventKey: `SUPPORT_MESSAGE:${created.id}`, payload: { contents }, recipients: { create: { userId: owner.userId } } } });
      }
      return created;
    });
    return message;
  } catch (error) {
    await Promise.all(stored.map(file => deleteSupportFile(file.storageKey)));
    throw error;
  }
}

router.get("/conversation", asyncRoute(async (request, response) => {
  const conversation = await prisma.supportConversation.findUnique({ where: { userId: request.auth!.userId }, include: conversationInclude });
  if (conversation) await prisma.supportConversation.update({ where: { id: conversation.id }, data: { lastReadByUserAt: new Date() } });
  response.json(conversation);
}));
router.post("/messages", supportUpload.array("attachments", 5), asyncRoute(async (request, response) => {
  const userId = request.auth!.userId;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, status: true } });
  if (!user || user.role !== "USER" || user.status !== "ACTIVE") throw new ApiError(403, "Only active players can contact support");
  const conversation = await prisma.supportConversation.upsert({ where: { userId }, create: { userId }, update: {} });
  const message = await createMessage(conversation.id, userId, false, String(request.body?.body ?? ""), request.files as Express.Multer.File[] ?? []);
  response.status(201).json(message);
}));
router.get("/admin/conversations", requireSupportAdmin, asyncRoute(async (_request, response) => {
  const conversations = await prisma.supportConversation.findMany({ orderBy: { lastMessageAt: "desc" }, include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } }, messages: { orderBy: { createdAt: "desc" }, take: 1, include: messageInclude } } });
  response.json(await Promise.all(conversations.map(async conversation => ({ ...conversation, unreadCount: await prisma.supportMessage.count({ where: { conversationId: conversation.id, isAdmin: false, createdAt: { gt: conversation.lastReadByAdminAt ?? new Date(0) } } }) }))));
}));
router.get("/admin/conversations/:id/messages", requireSupportAdmin, asyncRoute(async (request, response) => {
  const id = z.string().cuid().parse(request.params.id);
  const conversation = await prisma.supportConversation.findUnique({ where: { id }, include: conversationInclude });
  if (!conversation) throw new ApiError(404, "Conversation not found");
  await prisma.supportConversation.update({ where: { id }, data: { lastReadByAdminAt: new Date() } });
  response.json(conversation);
}));
router.post("/admin/conversations/:id/messages", requireSupportAdmin, supportUpload.array("attachments", 5), asyncRoute(async (request, response) => {
  const id = z.string().cuid().parse(request.params.id);
  if (!(await prisma.supportConversation.findUnique({ where: { id }, select: { id: true } }))) throw new ApiError(404, "Conversation not found");
  const message = await createMessage(id, request.auth!.userId, true, String(request.body?.body ?? ""), request.files as Express.Multer.File[] ?? []);
  response.status(201).json(message);
}));
router.get("/attachments/:id", asyncRoute(async (request, response) => {
  const id = z.string().cuid().parse(request.params.id);
  const attachment = await prisma.supportAttachment.findUnique({ where: { id }, include: { message: { include: { conversation: { select: { userId: true } } } } } });
  if (!attachment) throw new ApiError(404, "Support attachment not found");
  const viewer = await prisma.user.findUnique({ where: { id: request.auth!.userId }, select: { role: true } });
  if (attachment.message.conversation.userId !== request.auth!.userId && (viewer?.role !== "ADMIN" || (await prisma.user.findUnique({ where: { id: request.auth!.userId }, select: { email: true } }))?.email.toLowerCase() !== "sashaskibina16@gmail.com")) throw new ApiError(403, "You cannot access this attachment");
  response.setHeader("Content-Type", attachment.contentType);
  response.setHeader("Content-Length", String(attachment.size));
  response.setHeader("Content-Disposition", `inline; filename="${safeSupportFileName(attachment.fileName).replace(/"/g, "")}"; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`);
  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  await sendSupportFile(attachment.storageKey, response);
}));

export default router;
