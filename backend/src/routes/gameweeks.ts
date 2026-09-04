import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { synchronizeGameweeks } from "../services/gameweeks.js";
import { asyncRoute, ApiError } from "../utils/http.js";

const router = Router();
router.use(authenticate);

router.get("/current", asyncRoute(async (_request, response) => {
  await synchronizeGameweeks();
  const now = new Date();
  const gameweek = await prisma.gameweek.findFirst({ where: { marketOpenAt: { lte: now }, endsAt: { gte: now } }, orderBy: { number: "desc" } })
    ?? await prisma.gameweek.findFirst({ where: { marketOpenAt: { gt: now } }, orderBy: { marketOpenAt: "asc" } });
  response.json(gameweek);
}));

router.get("/leaderboard", asyncRoute(async (_request, response) => {
  const totals = await prisma.user.findMany({
    select: { id: true, name: true, avatarUrl: true, gameweekPoints: { select: { totalPoints: true }, where: { isFinal: true } } },
  });
  const ranked = totals.map((user) => ({ id: user.id, name: user.name, avatarUrl: user.avatarUrl, totalPoints: user.gameweekPoints.reduce((sum, row) => sum + row.totalPoints, 0), lastGameweekPoints: user.gameweekPoints.at(-1)?.totalPoints ?? 0 })).sort((a, b) => b.totalPoints - a.totalPoints);
  response.json(ranked.map((row, index) => ({ ...row, rank: index + 1 })));
}));

router.get("/:id/leaderboard", asyncRoute(async (request, response) => {
  const id = z.string().cuid().parse(request.params.id);
  const gameweek = await prisma.gameweek.findUnique({ where: { id }, select: { id: true } });
  if (!gameweek) throw new ApiError(404, "Тур не найден");
  response.json(await prisma.userGameweekPoints.findMany({ where: { gameweekId: id }, orderBy: [{ rank: "asc" }, { totalPoints: "desc" }], select: { userId: true, totalPoints: true, playerPoints: true, captainBonus: true, rank: true, isFinal: true, user: { select: { name: true, avatarUrl: true } } } }));
}));

router.get("/history/me", asyncRoute(async (request, response) => {
  response.json(await prisma.userGameweekPoints.findMany({ where: { userId: request.auth!.userId }, orderBy: { gameweek: { number: "desc" } }, include: { gameweek: true } }));
}));

export default router;
