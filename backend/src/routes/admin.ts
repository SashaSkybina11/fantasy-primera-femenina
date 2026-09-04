import { AdminActionType, GameweekStatus, MatchResult, PlayerPosition } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import { asyncRoute, ApiError } from "../utils/http.js";
import { inTransaction } from "../lib/transaction.js";
import { audit, calculatePlayerPoints, recalculateGameweek, snapshotGameweek, synchronizeGameweeks } from "../services/gameweeks.js";

const router = Router();

router.use(authenticate, requireAdmin);

router.get("/users", asyncRoute(async (_request, response) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      instagram: true,
      whatsapp: true,
      contactConsent: true,
      createdAt: true,
      fantasyTeam: { select: { _count: { select: { players: true } } } },
      gameweekPoints: { where: { isFinal: true }, select: { totalPoints: true } },
    },
  });
  response.json(users.map(({ fantasyTeam, gameweekPoints, ...user }) => ({ ...user, playerCount: fantasyTeam?._count.players ?? 0, totalPoints: gameweekPoints.reduce((sum, row) => sum + row.totalPoints, 0) })));
}));

router.get("/users/:id", asyncRoute(async (request, response) => {
  const id = z.string().cuid().parse(request.params.id);
  const user = await prisma.user.findUnique({ where: { id }, include: { fantasyTeam: { include: { players: { include: { player: { include: { club: true } } } } } }, gameweekPoints: { include: { gameweek: true }, orderBy: { gameweek: { number: "desc" } } } } });
  if (!user) throw new ApiError(404, "Пользователь не найден");
  response.json(user);
}));

const gameweekSchema = z.object({ number: z.number().int().positive(), name: z.string().trim().min(2), startsAt: z.coerce.date(), endsAt: z.coerce.date(), marketOpenAt: z.coerce.date(), deadlineAt: z.coerce.date() });
router.get("/gameweeks", asyncRoute(async (_request, response) => {
  await synchronizeGameweeks();
  response.json(await prisma.gameweek.findMany({ orderBy: { number: "asc" }, include: { winners: { include: { user: { select: { id: true, name: true, email: true, instagram: true, whatsapp: true, contactConsent: true } } } } } }));
}));
router.post("/gameweeks", asyncRoute(async (request, response) => {
  const input = gameweekSchema.parse(request.body);
  if (!(input.marketOpenAt < input.deadlineAt && input.startsAt <= input.endsAt)) throw new ApiError(400, "Некорректный диапазон дат тура");
  response.status(201).json(await prisma.gameweek.create({ data: input }));
}));

router.get("/player-points", asyncRoute(async (request, response) => {
  const gameweekId = z.string().cuid().optional().parse(request.query.gameweekId);
  const players = await prisma.player.findMany({ include: { club: true, gameweekStats: { ...(gameweekId ? { where: { gameweekId } } : {}), orderBy: { gameweek: { number: "desc" } }, include: { gameweek: true } } }, orderBy: { name: "asc" } });
  response.json(players.map((player) => ({ ...player, totalFantasyPoints: player.gameweekStats.reduce((sum, stat) => sum + stat.totalPoints, 0), lastGameweekPoints: player.gameweekStats[0]?.totalPoints ?? 0 })));
}));

router.patch("/players/:id/price", asyncRoute(async (request, response) => {
  const id = z.string().cuid().parse(request.params.id);
  const { price } = z.object({ price: z.number().int().min(0).max(1_000_000) }).parse(request.body);
  const player = await prisma.player.update({ where: { id }, data: { price } }).catch(() => null);
  if (!player) throw new ApiError(404, "Игрок не найден");
  response.json(player);
}));

const statsSchema = z.object({ participated: z.boolean(), result: z.nativeEnum(MatchResult), goals: z.number().int().min(0).max(99), yellowCards: z.number().int().min(0).max(9), redCards: z.number().int().min(0).max(9), cleanSheet: z.boolean(), adjustmentPoints: z.number().int().min(-100).max(100).default(0), adjustmentReason: z.string().trim().max(500).optional() });
router.put("/gameweeks/:gameweekId/players/:playerId/stats", asyncRoute(async (request, response) => {
  const gameweekId = z.string().cuid().parse(request.params.gameweekId); const playerId = z.string().cuid().parse(request.params.playerId); const input = statsSchema.parse(request.body);
  const result = await inTransaction(async (tx) => {
    const [gameweek, player, old] = await Promise.all([tx.gameweek.findUnique({ where: { id: gameweekId } }), tx.player.findUnique({ where: { id: playerId } }), tx.playerGameweekStats.findUnique({ where: { gameweekId_playerId: { gameweekId, playerId } } })]);
    if (!gameweek || !player) throw new ApiError(404, "Тур или игрок не найден");
    if (gameweek.status === GameweekStatus.COMPLETED) throw new ApiError(409, "Сначала повторно откройте завершённый тур");
    if (player.position !== PlayerPosition.GOALKEEPER && input.cleanSheet) throw new ApiError(400, "Сухой матч доступен только вратарям");
    if (input.adjustmentPoints !== 0 && !input.adjustmentReason) throw new ApiError(400, "Укажите причину корректировки");
    const calculatedPoints = calculatePlayerPoints({ ...input, position: player.position });
    const data = { ...input, calculatedPoints, totalPoints: calculatedPoints + input.adjustmentPoints, adjustedById: input.adjustmentPoints !== 0 ? request.auth!.userId : null, adjustedAt: input.adjustmentPoints !== 0 ? new Date() : null };
    const saved = await tx.playerGameweekStats.upsert({ where: { gameweekId_playerId: { gameweekId, playerId } }, update: data, create: { gameweekId, playerId, ...data } });
    await audit(tx, request.auth!.userId, old?.adjustmentPoints !== input.adjustmentPoints ? AdminActionType.PLAYER_POINTS_ADJUSTED : AdminActionType.PLAYER_STATS_UPDATED, "PlayerGameweekStats", saved.id, old, saved);
    await recalculateGameweek(tx, gameweekId);
    return saved;
  });
  response.json(result);
}));

router.post("/gameweeks/:id/complete", asyncRoute(async (request, response) => {
  const id = z.string().cuid().parse(request.params.id);
  const result = await inTransaction(async (tx) => {
    const gameweek = await tx.gameweek.findUnique({ where: { id } }); if (!gameweek) throw new ApiError(404, "Тур не найден");
    if (gameweek.status === GameweekStatus.COMPLETED) throw new ApiError(409, "Тур уже завершён");
    await snapshotGameweek(tx, id); await recalculateGameweek(tx, id);
    const leaders = await tx.userGameweekPoints.findMany({ where: { gameweekId: id, rank: 1 } });
    const oldWinners = await tx.gameweekWinner.findMany({ where: { gameweekId: id } });
    await tx.gameweekWinner.deleteMany({ where: { gameweekId: id } });
    if (leaders.length) await tx.gameweekWinner.createMany({ data: leaders.map((row) => ({ gameweekId: id, userId: row.userId, rank: 1, points: row.totalPoints })) });
    await tx.userGameweekPoints.updateMany({ where: { gameweekId: id }, data: { isFinal: true } });
    const saved = await tx.gameweek.update({ where: { id }, data: { status: GameweekStatus.COMPLETED, completedAt: new Date() } });
    await audit(tx, request.auth!.userId, AdminActionType.GAMEWEEK_COMPLETED, "Gameweek", id, gameweek, saved);
    if (JSON.stringify(oldWinners.map((w) => w.userId).sort()) !== JSON.stringify(leaders.map((w) => w.userId).sort())) await audit(tx, request.auth!.userId, AdminActionType.WINNERS_CHANGED, "Gameweek", id, oldWinners, leaders);
    return saved;
  }); response.json(result);
}));

router.post("/gameweeks/:id/reopen", asyncRoute(async (request, response) => {
  const id = z.string().cuid().parse(request.params.id);
  const result = await inTransaction(async (tx) => { const old = await tx.gameweek.findUnique({ where: { id } }); if (!old) throw new ApiError(404, "Тур не найден"); if (old.status !== GameweekStatus.COMPLETED) throw new ApiError(409, "Тур не завершён"); await tx.userGameweekPoints.updateMany({ where: { gameweekId: id }, data: { isFinal: false } }); const saved = await tx.gameweek.update({ where: { id }, data: { status: GameweekStatus.CALCULATING, completedAt: null } }); await audit(tx, request.auth!.userId, AdminActionType.GAMEWEEK_REOPENED, "Gameweek", id, old, saved); return saved; }); response.json(result);
}));

router.post("/gameweeks/:gameweekId/users/:userId/adjustments", asyncRoute(async (request, response) => {
  const gameweekId = z.string().cuid().parse(request.params.gameweekId); const userId = z.string().cuid().parse(request.params.userId);
  const input = z.object({ points: z.number().int().min(-100).max(100).refine((value) => value !== 0), reason: z.string().trim().min(3).max(500) }).parse(request.body);
  const saved = await inTransaction(async (tx) => {
    const [gameweek, user] = await Promise.all([tx.gameweek.findUnique({ where: { id: gameweekId } }), tx.user.findUnique({ where: { id: userId } })]);
    if (!gameweek || !user) throw new ApiError(404, "Тур или пользователь не найден");
    if (gameweek.status === GameweekStatus.COMPLETED) throw new ApiError(409, "Сначала повторно откройте завершённый тур");
    const adjustment = await tx.userPointAdjustment.create({ data: { gameweekId, userId, adminId: request.auth!.userId, ...input } });
    await audit(tx, request.auth!.userId, AdminActionType.PLAYER_POINTS_ADJUSTED, "UserPointAdjustment", adjustment.id, null, adjustment);
    await recalculateGameweek(tx, gameweekId); return adjustment;
  });
  response.status(201).json(saved);
}));

router.get("/winners", asyncRoute(async (_request, response) => response.json(await prisma.gameweekWinner.findMany({ orderBy: { gameweek: { number: "desc" } }, include: { gameweek: true, user: { select: { id: true, name: true, email: true, instagram: true, whatsapp: true, contactConsent: true } } } }))));

router.get("/audit-log", asyncRoute(async (_request, response) => response.json(await prisma.adminAuditLog.findMany({ take: 200, orderBy: { createdAt: "desc" }, include: { admin: { select: { id: true, name: true } } } }))));

router.delete("/users/:id", asyncRoute(async (request, response) => {
  const id = z.string().cuid().parse(request.params.id);
  if (id === request.auth!.userId) throw new ApiError(400, "Нельзя удалить собственный аккаунт администратора");
  const result = await prisma.user.deleteMany({ where: { id } });
  if (!result.count) throw new ApiError(404, "Пользователь не найден");
  response.status(204).send();
}));

export default router;
