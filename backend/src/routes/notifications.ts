import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { Prisma } from "@prisma/client";
import { authenticate } from "../middleware/auth.js";
import { asyncRoute, ApiError } from "../utils/http.js";
import { interpolateNotificationContent, normalizeNotificationLocale, notificationTemplate, runNotificationJobs, type NotificationContents, type NotificationLocale, type NotificationType } from "../services/notifications.js";
import { env } from "../config/env.js";

const router = Router();
router.get("/cron", asyncRoute(async (request, response) => {
  if (!env.cronSecret || request.header("authorization") !== `Bearer ${env.cronSecret}`) throw new ApiError(401, "Недействительный ключ задачи");
  response.json(await prisma.$transaction(tx => runNotificationJobs(new Date(), tx), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 8000 }));
}));
router.use(authenticate);
const visibleNotification = (userId: string) => ({ recipients: { some: { userId } } });

router.get("/", asyncRoute(async (request, response) => {
  const status = z.enum(["all", "unread", "read"]).default("all").parse(request.query.status);
  const userId = request.auth!.userId;
  const where = { cancelledAt: null, ...visibleNotification(userId), ...(status === "unread" ? { recipients: { some: { userId, readAt: null } } } : status === "read" ? { recipients: { some: { userId, readAt: { not: null } } } } : {}) };
  const [rows, unreadCount, totalCount] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: { createdAt: "desc" }, take: 200, include: { recipients: { where: { userId }, select: { readAt: true, variables: true } } } }),
    prisma.notificationRecipient.count({ where: { userId, readAt: null, notification: { is: { cancelledAt: null } } } }),
    prisma.notificationRecipient.count({ where: { userId, notification: { is: { cancelledAt: null } } } }),
  ]);
  const locale: NotificationLocale = normalizeNotificationLocale(request.header("accept-language"));
  const items = rows.map(notification => {
    const payload = notification.payload as { variables?: Record<string, string>; contents?: Partial<NotificationContents> | null };
    const recipient = notification.recipients[0];
    const localized = interpolateNotificationContent(payload.contents?.[locale] ?? notificationTemplate(notification.type as NotificationType, locale), { ...payload.variables, ...(recipient?.variables as Record<string, string> | null ?? {}) });
    return { id: notification.id, ...localized, type: notification.type, createdAt: notification.createdAt, readAt: recipient?.readAt ?? null, isRead: recipient?.readAt !== null && recipient?.readAt !== undefined };
  });
  response.json({ items, unreadCount, totalCount });
}));

router.get("/unread-count", asyncRoute(async (request, response) => {
  const unreadCount = await prisma.notificationRecipient.count({ where: { userId: request.auth!.userId, readAt: null, notification: { is: { cancelledAt: null } } } });
  response.json({ unreadCount });
}));

router.post("/:id/read", asyncRoute(async (request, response) => {
  const id = z.string().cuid().parse(request.params.id);
  const userId = request.auth!.userId;
  const result = await prisma.notificationRecipient.updateMany({ where: { notificationId: id, userId, readAt: null, notification: { is: { cancelledAt: null } } }, data: { readAt: new Date() } });
  const exists = result.count || await prisma.notificationRecipient.count({ where: { notificationId: id, userId, notification: { is: { cancelledAt: null } } } });
  if (!exists) throw new ApiError(404, "Уведомление не найдено");
  response.json({ ok: true });
}));

export default router;
