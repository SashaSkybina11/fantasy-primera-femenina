import { randomBytes } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { ApiError, asyncRoute } from "../utils/http.js";

const router = Router();
router.use(authenticate);

function newInviteCode() {
  return `FUT${randomBytes(3).toString("hex").toUpperCase()}`;
}

async function uniqueInviteCode() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const inviteCode = newInviteCode();
    if (!(await prisma.privateLeague.findUnique({ where: { inviteCode }, select: { id: true } }))) return inviteCode;
  }
  throw new ApiError(503, "Не удалось создать код приглашения");
}

router.post("/", asyncRoute(async (request, response) => {
  const { name } = z.object({ name: z.string().trim().min(3).max(50) }).parse(request.body);
  const inviteCode = await uniqueInviteCode();
  const league = await prisma.privateLeague.create({ data: { name, inviteCode, ownerId: request.auth!.userId, members: { create: { userId: request.auth!.userId } } } });
  response.status(201).json(league);
}));

router.post("/join", asyncRoute(async (request, response) => {
  const { code } = z.object({ code: z.string().trim().min(6).max(10).transform((value) => value.toUpperCase()) }).parse(request.body);
  const league = await prisma.privateLeague.findUnique({ where: { inviteCode: code } });
  if (!league) throw new ApiError(404, "Лига с таким кодом не найдена");
  const existing = await prisma.privateLeagueMember.findUnique({ where: { leagueId_userId: { leagueId: league.id, userId: request.auth!.userId } } });
  if (existing) throw new ApiError(409, "Вы уже состоите в этой лиге");
  await prisma.privateLeagueMember.create({ data: { leagueId: league.id, userId: request.auth!.userId } });
  response.json(league);
}));

router.get("/my", asyncRoute(async (request, response) => {
  const memberships = await prisma.privateLeagueMember.findMany({ where: { userId: request.auth!.userId }, include: { league: { include: { members: { include: { user: { select: { id: true, gameweekPoints: { where: { isFinal: true }, select: { totalPoints: true } } } } } }, _count: { select: { members: true } } } } }, orderBy: { joinedAt: "desc" } });
  response.json(memberships.map((membership) => {
    const ranking = membership.league.members.map((member) => ({ id: member.userId, points: member.user.gameweekPoints.reduce((sum, row) => sum + row.totalPoints, 0) })).sort((a, b) => b.points - a.points);
    const { members: _members, ...league } = membership.league;
    return { ...league, rank: ranking.findIndex((member) => member.id === request.auth!.userId) + 1 };
  }));
}));

router.get("/:id", asyncRoute(async (request, response) => {
  const id = z.string().cuid().parse(request.params.id);
  const league = await prisma.privateLeague.findFirst({ where: { id, members: { some: { userId: request.auth!.userId } } }, include: { members: { include: { user: { select: { id: true, name: true, avatarUrl: true, gameweekPoints: { where: { isFinal: true }, select: { totalPoints: true } } } } } } } });
  if (!league) throw new ApiError(404, "Лига не найдена или доступ запрещён");
  const members = league.members.map(({ user, joinedAt }) => ({ id: user.id, name: user.name, avatarUrl: user.avatarUrl, joinedAt, points: user.gameweekPoints.reduce((sum, row) => sum + row.totalPoints, 0) })).sort((a, b) => b.points - a.points || a.joinedAt.getTime() - b.joinedAt.getTime()).map((member, index) => ({ ...member, rank: index + 1 }));
  response.json({ id: league.id, name: league.name, inviteCode: league.inviteCode, ownerId: league.ownerId, members });
}));

router.post("/:id/leave", asyncRoute(async (request, response) => {
  const id = z.string().cuid().parse(request.params.id);
  const league = await prisma.privateLeague.findFirst({ where: { id, members: { some: { userId: request.auth!.userId } } } });
  if (!league) throw new ApiError(404, "Лига не найдена");
  if (league.ownerId === request.auth!.userId) throw new ApiError(409, "Владелец не может покинуть лигу");
  await prisma.privateLeagueMember.delete({ where: { leagueId_userId: { leagueId: id, userId: request.auth!.userId } } });
  response.status(204).send();
}));

router.delete("/:id", asyncRoute(async (request, response) => {
  const id = z.string().cuid().parse(request.params.id);
  const result = await prisma.privateLeague.deleteMany({ where: { id, ownerId: request.auth!.userId } });
  if (!result.count) throw new ApiError(403, "Удалить лигу может только владелец");
  response.status(204).send();
}));

export default router;
