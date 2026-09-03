import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { teamInclude, withTeamDisplayNumbers } from "../services/team.js";
import { asyncRoute, ApiError } from "../utils/http.js";

const router = Router();
const mainLeagueName = "Fantasy Primera División Fútbol Sala Femenino";

router.use(authenticate);

router.get("/", asyncRoute(async (_request, response) => {
  const league = await prisma.league.findUnique({
    where: { name: mainLeagueName },
    include: { _count: { select: { members: true } } },
  });
  if (!league) throw new ApiError(404, "Лига не найдена");
  response.json(league);
}));

router.get("/members", asyncRoute(async (_request, response) => {
  const league = await prisma.league.findUnique({ where: { name: mainLeagueName } });
  if (!league) throw new ApiError(404, "Лига не найдена");
  const members = await prisma.leagueMember.findMany({
    where: { leagueId: league.id },
    include: {
      user: { select: { id: true, name: true, avatarUrl: true, fantasyTeam: { select: { id: true, name: true, _count: { select: { players: true } } } } } },
    },
    orderBy: { createdAt: "asc" },
  });
  response.json(members.map((member) => member.user));
}));

router.get("/supporters", asyncRoute(async (_request, response) => {
  const clubs = await prisma.club.findMany({
    select: { id: true, name: true, logoUrl: true, _count: { select: { supporters: true } } },
    orderBy: { name: "asc" },
  });
  response.json(clubs.map((club) => ({ id: club.id, name: club.name, logoUrl: club.logoUrl, count: club._count.supporters })).filter((club) => club.count > 0));
}));

router.get("/members/:userId", asyncRoute(async (request, response) => {
  const userId = z.string().cuid().parse(request.params.userId);
  const membership = await prisma.leagueMember.findFirst({
    where: { userId, league: { name: mainLeagueName } },
    include: { user: { select: { id: true, name: true, avatarUrl: true, fantasyTeam: { include: teamInclude } } } },
  });
  const fantasyTeam = membership?.user.fantasyTeam;
  if (!membership || !fantasyTeam) throw new ApiError(404, "Участник не найден в этой лиге");
  const { user } = membership;
  response.json({ id: user.id, name: user.name, avatarUrl: user.avatarUrl, fantasyTeam: await withTeamDisplayNumbers(fantasyTeam) });
}));

export default router;
