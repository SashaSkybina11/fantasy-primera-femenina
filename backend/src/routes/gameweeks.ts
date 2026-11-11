import { PlayerPosition, PlayerRole } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import { currentGameweek, recalculateGameweek, scoringRules, synchronizeGameweeks } from "../services/gameweeks.js";
import { asyncRoute, ApiError } from "../utils/http.js";
import { overallStandings } from "../services/leaderboard.js";
import { marketIsOpen } from "../services/market-schedule.js";

const router = Router();
router.use(authenticate);

const idealFiveSlots = ["GOALKEEPER", "PIVOT", "CLOSER", "WINGER_ONE", "WINGER_TWO"] as const;
const idealFiveInput = z.object({
  players: z.array(z.object({ playerId: z.string().cuid(), slot: z.enum(idealFiveSlots) })).length(5),
});

router.get("/ideal-five", asyncRoute(async (_request, response) => {
  const entries = await prisma.gameweekIdealFiveEntry.findMany({
    orderBy: [{ gameweek: { number: "desc" } }, { slot: "asc" }],
    include: { gameweek: true, player: { include: { club: true } } },
  });
  response.json(entries);
}));

router.put("/:gameweekId/ideal-five", requireAdmin, asyncRoute(async (request, response) => {
  const gameweekId = z.string().cuid().parse(request.params.gameweekId);
  const { players } = idealFiveInput.parse(request.body);
  if (new Set(players.map(player => player.slot)).size !== 5 || new Set(players.map(player => player.playerId)).size !== 5) {
    throw new ApiError(400, "IDEAL_FIVE_DUPLICATE");
  }
  const gameweek = await prisma.gameweek.findUnique({ where: { id: gameweekId } });
  if (!gameweek) throw new ApiError(404, "Тур не найден");
  const roster = await prisma.player.findMany({ where: { id: { in: players.map(player => player.playerId) } }, select: { id: true, position: true, role: true } });
  if (roster.length !== 5) throw new ApiError(400, "IDEAL_FIVE_PLAYER_NOT_FOUND");
  const byId = new Map(roster.map(player => [player.id, player]));
  const validRole: Record<(typeof idealFiveSlots)[number], { position: PlayerPosition; role: PlayerRole }> = {
    GOALKEEPER: { position: PlayerPosition.GOALKEEPER, role: PlayerRole.PORTERA },
    PIVOT: { position: PlayerPosition.FIELD_PLAYER, role: PlayerRole.PIVOT },
    CLOSER: { position: PlayerPosition.FIELD_PLAYER, role: PlayerRole.CIERRE },
    WINGER_ONE: { position: PlayerPosition.FIELD_PLAYER, role: PlayerRole.ALA },
    WINGER_TWO: { position: PlayerPosition.FIELD_PLAYER, role: PlayerRole.ALA },
  };
  if (players.some(item => {
    const player = byId.get(item.playerId)!;
    const required = validRole[item.slot];
    return player.position !== required.position || player.role !== required.role;
  })) throw new ApiError(400, "IDEAL_FIVE_INVALID_ROLES");

  const saved = await prisma.$transaction(async tx => {
    await tx.gameweekIdealFiveEntry.deleteMany({ where: { gameweekId } });
    await tx.gameweekIdealFiveEntry.createMany({ data: players.map(item => ({ gameweekId, playerId: item.playerId, slot: item.slot })) });
    if (gameweek.status === "COMPLETED") await recalculateGameweek(tx, gameweekId);
    return tx.gameweekIdealFiveEntry.findMany({ where: { gameweekId }, orderBy: { slot: "asc" }, include: { gameweek: true, player: { include: { club: true } } } });
  });
  response.json(saved);
}));

router.get("/scoring-rules", (_request, response) => response.json(scoringRules));

router.get("/current", asyncRoute(async (_request, response) => {
  await synchronizeGameweeks();
  const now = new Date();
  const gameweek = await currentGameweek(prisma, now);
  response.json(gameweek ? { ...gameweek, marketIsOpen: marketIsOpen(gameweek, now) } : null);
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

router.get("/history/:userId", requireAdmin, asyncRoute(async (request, response) => {
  const userId = z.string().cuid().parse(request.params.userId);
  const user = await prisma.user.findFirst({ where: { id: userId, role: "USER" }, select: { id: true } });
  if (!user) throw new ApiError(404, "Пользователь не найден");
  response.json(await prisma.userGameweekPoints.findMany({ where: { userId }, orderBy: { gameweek: { number: "desc" } }, include: { gameweek: true } }));
}));

router.get("/history/:userId/:gameweekId/squad", requireAdmin, asyncRoute(async (request, response) => {
  const userId = z.string().cuid().parse(request.params.userId);
  const gameweekId = z.string().cuid().parse(request.params.gameweekId);
  const [user, snapshot] = await Promise.all([
    prisma.user.findFirst({ where: { id: userId, role: "USER" }, select: { id: true, name: true } }),
    prisma.userGameweekSquad.findUnique({
      where: { gameweekId_userId: { gameweekId, userId } },
      include: { players: { where: { status: "STARTER" }, include: { player: { include: { club: true } } } } },
    }),
  ]);
  if (!user) throw new ApiError(404, "Пользователь не найден");
  if (!snapshot) throw new ApiError(404, "Склад туру не знайдено");

  const points = await prisma.userGameweekPoints.findUnique({ where: { gameweekId_userId: { gameweekId, userId } }, select: { breakdown: true } });
  const breakdown = Array.isArray(points?.breakdown) ? points.breakdown as Array<{ playerId: string; points: number }> : [];
  const pointsByPlayer = new Map(breakdown.map((entry) => [entry.playerId, entry.points]));
  response.json({
    user,
    gameweekId,
    players: snapshot.players.map(({ player, ...entry }) => ({ ...entry, player, points: pointsByPlayer.get(player.id) ?? 0 })),
  });
}));

export default router;
