import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { asyncRoute, ApiError } from "../utils/http.js";
const router = Router();
router.use(authenticate);
router.get("/:userId/lineup", asyncRoute(async (request, response) => {
  const userId = z.string().cuid().parse(request.params.userId);
  const user = await prisma.user.findUnique({ where: { id: userId }, select: {
    id: true, name: true, fantasyTeam: { select: { players: {
      where: { status: "STARTER" }, orderBy: { createdAt: "asc" }, select: {
        id: true, playerId: true, status: true, isCaptain: true,
        player: { select: { id: true, clubId: true, name: true, number: true, role: true, position: true,
          price: true, age: true, nationality: true, photoUrl: true,
          club: { select: { id: true, name: true, logoUrl: true, coach: true, president: true } },
          gameweekStats: { select: { totalPoints: true } }
        } }
      }
    } } }
  } });
  if (!user) throw new ApiError(404, "LINEUP_NOT_FOUND");
  response.json({ user: { id: user.id, name: user.name }, players: (user.fantasyTeam?.players ?? []).map(({ player, ...entry }) => {
    const { gameweekStats, ...publicPlayer } = player;
    return { ...entry, player: publicPlayer, points: gameweekStats.reduce((sum, row) => sum + row.totalPoints, 0) };
  }) });
}));
export default router;
