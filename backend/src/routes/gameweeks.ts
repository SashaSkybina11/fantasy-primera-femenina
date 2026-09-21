import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { scoringRules, synchronizeGameweeks } from "../services/gameweeks.js";
import { asyncRoute, ApiError } from "../utils/http.js";
import { overallStandings } from "../services/leaderboard.js";

const router = Router();
router.use(authenticate);

router.get("/scoring-rules", (_request, response) => response.json(scoringRules));

router.get("/current", asyncRoute(async (request, response) => {
  await synchronizeGameweeks();
  const now = new Date();
  const gameweek = await prisma.gameweek.findFirst({ where: { marketOpenAt: { lte: now }, endsAt: { gte: now } }, orderBy: { number: "desc" } })
    ?? await prisma.gameweek.findFirst({ where: { marketOpenAt: { gt: now } }, orderBy: { marketOpenAt: "asc" } });
  response.json(gameweek ? { ...gameweek, marketIsOpen: (await prisma.user.findUnique({ where: { id: request.auth!.userId }, select: { role: true } }))?.role === "ADMIN" || (gameweek.status === "OPEN" && gameweek.marketOpenAt <= now && now < gameweek.deadlineAt) } : null);
}));

router.get("/leaderboard", asyncRoute(async (_request, response) => {
  const totals = await prisma.user.findMany({
    where: { role: "USER" },
    select: { id: true, name: true, avatarUrl: true, fantasyTeam: { select: { players: { select: { player: { select: { position: true } } } } } }, gameweekPoints: { select: { totalPoints: true, gameweek: { select: { number: true } } }, where: { isFinal: true, gameweek: { status: "COMPLETED" } }, orderBy: { gameweek: { number: "asc" } } } },
  });
  const weeks = await prisma.gameweek.findMany({ where: { status: "COMPLETED" }, orderBy: { number: "desc" }, take: 2, select: { number: true } });
  response.json(overallStandings(totals, weeks.map(week => week.number)));
}));

router.get("/:id/leaderboard", asyncRoute(async (request, response) => {
  const id = z.string().cuid().parse(request.params.id);
  const gameweek = await prisma.gameweek.findUnique({ where: { id }, select: { id: true } });
  if (!gameweek) throw new ApiError(404, "Тур не найден");
  response.json(await prisma.userGameweekPoints.findMany({ where: { gameweekId: id, user: { role: "USER" } }, orderBy: [{ rank: "asc" }, { totalPoints: "desc" }], select: { userId: true, totalPoints: true, playerPoints: true, captainBonus: true, rank: true, isFinal: true, user: { select: { name: true, avatarUrl: true } } } }));
}));

router.get("/history/me", asyncRoute(async (request, response) => {
  response.json(await prisma.userGameweekPoints.findMany({ where: { userId: request.auth!.userId }, orderBy: { gameweek: { number: "desc" } }, include: { gameweek: true } }));
}));

export default router;
