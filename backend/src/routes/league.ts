import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { teamInclude } from "../services/team.js";
import { asyncRoute, ApiError } from "../utils/http.js";

const router = Router();
const mainLeagueName = "Fantasy Primera División Femenina";

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

router.get("/members/:userId", asyncRoute(async (request, response) => {
  const userId = z.string().cuid().parse(request.params.userId);
  const membership = await prisma.leagueMember.findFirst({
    where: { userId, league: { name: mainLeagueName } },
    include: { user: { select: { id: true, name: true, avatarUrl: true, fantasyTeam: { include: teamInclude } } } },
  });
  if (!membership?.user.fantasyTeam) throw new ApiError(404, "Участник не найден в этой лиге");
  const { user } = membership;
  response.json({ id: user.id, name: user.name, avatarUrl: user.avatarUrl, fantasyTeam: user.fantasyTeam });
}));

export default router;
