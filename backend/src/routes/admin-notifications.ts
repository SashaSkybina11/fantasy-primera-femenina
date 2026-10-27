import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import { asyncRoute, ApiError } from "../utils/http.js";
import { createNotification, defaultNotificationTemplates, getNotificationContents, previewNotificationAudience, type NotificationAudience, type NotificationContents, type NotificationType } from "../services/notifications.js";

const router = Router();
router.use(authenticate, requireAdmin);
const audienceSchema = z.enum(["ALL", "LEAGUE", "USERS", "INCOMPLETE_TEAM", "CAPTAIN_MISSING"]);
const contentSchema = z.object({ title: z.string().trim().min(1).max(160), message: z.string().trim().min(1).max(4000), action: z.string().trim().max(80), url: z.string().refine(value => value === "" || (value.startsWith("/") && !value.startsWith("//")), "Only internal app paths are allowed") });
const contentsSchema = z.object({ es: contentSchema, uk: contentSchema, en: contentSchema, pt: contentSchema });
const sendSchema = z.object({
  type: z.enum(["MARKET_OPEN", "MARKET_CLOSING", "INCOMPLETE_TEAM", "CAPTAIN_MISSING", "GAMEWEEK_STARTING", "GAMEWEEK_RESULTS", "INVITATION_RECEIVED", "GENERAL_ANNOUNCEMENT"]),
  audience: audienceSchema,
  leagueId: z.string().cuid().optional(),
  userIds: z.array(z.string().cuid()).max(500).optional(),
  hours: z.string().max(20).optional(),
  contents: contentsSchema.optional(),
});

router.get("/targets", asyncRoute(async (_request, response) => {
  const [leagues, users] = await Promise.all([
    prisma.privateLeague.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { role: "USER", status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
  ]);
  response.json({ leagues, users });
}));

router.get("/templates", asyncRoute(async (_request, response) => {
  const saved = await prisma.notificationTemplate.findMany();
  const overrides = new Map(saved.map(row => [row.type, row.contents]));
  response.json(Object.entries(defaultNotificationTemplates).map(([type, contents]) => ({ type, contents: overrides.get(type) ?? contents })));
}));

router.put("/templates/:type", asyncRoute(async (request, response) => {
  const type = z.enum(["MARKET_OPEN", "MARKET_CLOSING", "INCOMPLETE_TEAM", "CAPTAIN_MISSING", "GAMEWEEK_STARTING", "GAMEWEEK_RESULTS", "INVITATION_RECEIVED", "GENERAL_ANNOUNCEMENT"]).parse(request.params.type);
  const contents = contentsSchema.parse(request.body);
  const saved = await prisma.notificationTemplate.upsert({ where: { type }, create: { type, contents }, update: { contents } });
  response.json(saved);
}));

router.post("/preview", asyncRoute(async (request, response) => {
  const input = z.object({ audience: audienceSchema, leagueId: z.string().cuid().optional(), userIds: z.array(z.string().cuid()).max(500).optional() }).parse(request.body);
  if (input.audience === "LEAGUE" && !input.leagueId) throw new ApiError(400, "Выберите лигу");
  const users = await previewNotificationAudience(input.audience, input.leagueId, input.userIds);
  response.json({ count: users.length });
}));

router.get("/history", asyncRoute(async (_request, response) => {
  const rows = await prisma.notification.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { createdBy: { select: { id: true, name: true } }, _count: { select: { recipients: true } }, recipients: { where: { readAt: { not: null } }, select: { userId: true } } } });
  response.json(rows.map(row => ({ id: row.id, type: row.type, audience: row.audience, createdAt: row.createdAt, sentAt: row.sentAt, eventKey: row.eventKey, createdBy: row.createdBy, recipientCount: row._count.recipients, readCount: row.recipients.length })));
}));

router.post("/send", asyncRoute(async (request, response) => {
  const input = sendSchema.parse(request.body);
  if (input.audience === "LEAGUE" && !input.leagueId) throw new ApiError(400, "Выберите лигу");
  if (input.audience === "USERS" && !input.userIds?.length) throw new ApiError(400, "Выберите игроков");
  if ((input.type === "GENERAL_ANNOUNCEMENT" || input.contents) && !input.contents) throw new ApiError(400, "Заполните текст на всех четырех языках");
  if (input.leagueId && !(await prisma.privateLeague.findUnique({ where: { id: input.leagueId }, select: { id: true } }))) throw new ApiError(404, "Лига не найдена");

  const created = await prisma.$transaction(async tx => {
    // Resolve dynamic segments immediately before inserting recipients; do not trust the preview or client-supplied user ids.
    const recipientIds = await previewNotificationAudience(input.audience as NotificationAudience, input.leagueId, input.userIds, tx);
    if (input.audience === "USERS" && recipientIds.length !== new Set(input.userIds).size) throw new ApiError(400, "Выбран один или несколько недоступных игроков");
    if (!recipientIds.length) throw new ApiError(400, "Для выбранной аудитории нет получателей");
    const variables = { ...(input.hours ? { hours: input.hours } : {}), ...(input.leagueId ? { leagueName: (await tx.privateLeague.findUniqueOrThrow({ where: { id: input.leagueId }, select: { name: true } })).name } : {}) };
    const contents = input.contents as NotificationContents | undefined ?? await getNotificationContents(input.type as NotificationType, tx);
    return createNotification(tx, { type: input.type as NotificationType, audience: input.audience as NotificationAudience, userIds: recipientIds, variables, contents, createdById: request.auth!.userId });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 8000 });
  response.status(201).json({ id: created.id });
}));

export default router;
