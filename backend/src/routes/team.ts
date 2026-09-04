import { PlayerPosition, SquadStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { inTransaction } from "../lib/transaction.js";
import { authenticate } from "../middleware/auth.js";
import { ensureValidLineup, getOwnTeam, teamInclude, withTeamDisplayNumbers } from "../services/team.js";
import { asyncRoute, ApiError } from "../utils/http.js";
import { assertOpenMarket, requireOpenMarket, synchronizeGameweeks } from "../services/gameweeks.js";

const router = Router();
const playerIdSchema = z.object({ playerId: z.string().cuid() });
const captainSchema = z.object({ playerId: z.string().cuid().nullable() });
const statusSchema = z.object({ status: z.nativeEnum(SquadStatus) });
const lineupSchema = z.object({
  players: z.array(z.object({ playerId: z.string().cuid(), status: z.nativeEnum(SquadStatus) })).length(10),
});

router.use(authenticate);

router.get("/", asyncRoute(async (request, response) => {
  response.json(await getOwnTeam(request.auth!.userId));
}));

router.get("/transfers", asyncRoute(async (request, response) => {
  await synchronizeGameweeks();
  const now = new Date();
  const gameweek = await prisma.gameweek.findFirst({ where: { marketOpenAt: { lte: now }, endsAt: { gte: now } }, orderBy: { number: "desc" } })
    ?? await prisma.gameweek.findFirst({ where: { marketOpenAt: { gt: now } }, orderBy: { number: "asc" } });
  if (!gameweek) return response.json({ gameweek: null, marketIsOpen: false, bought: 0, sold: 0, limit: 2, initialSquad: true });
  const [team, grouped] = await Promise.all([
    prisma.fantasyTeam.findUnique({ where: { userId: request.auth!.userId }, select: { isInitialSquadComplete: true } }),
    prisma.userTransfer.groupBy({ by: ["type"], where: { userId: request.auth!.userId, gameweekId: gameweek.id }, _count: true }),
  ]);
  response.json({ gameweek, marketIsOpen: gameweek.status === "OPEN" && gameweek.marketOpenAt <= now && now < gameweek.deadlineAt, bought: grouped.find((row) => row.type === "BUY")?._count ?? 0, sold: grouped.find((row) => row.type === "SELL")?._count ?? 0, limit: 2, initialSquad: !team?.isInitialSquadComplete });
}));

router.post("/players", asyncRoute(async (request, response) => {
  const gameweek = await requireOpenMarket();
  const { playerId } = playerIdSchema.parse(request.body);
  const team = await inTransaction(async (tx) => {
    await assertOpenMarket(tx, request.method === "PATCH");
    const current = await tx.fantasyTeam.findUnique({
      where: { userId: request.auth!.userId },
      include: { players: { include: { player: { select: { clubId: true } } } } },
    });
    if (!current) throw new ApiError(404, "Fantasy-команда не найдена");
    if (current.players.length >= 10) throw new ApiError(400, "Состав уже заполнен");
    if (current.players.some((entry) => entry.playerId === playerId)) throw new ApiError(409, "Игрок уже выбран");

    const player = await tx.player.findUnique({ where: { id: playerId } });
    if (!player) throw new ApiError(404, "Игрок не найден");
    if (current.budget < player.price) throw new ApiError(400, "Недостаточно бюджета для этого игрока");
    if (current.players.filter((entry) => entry.player.clubId === player.clubId).length >= 2) {
      throw new ApiError(400, "Максимум 2 игрока из одной команды");
    }
    if (current.isInitialSquadComplete) {
      const purchases = await tx.userTransfer.count({ where: { userId: request.auth!.userId, gameweekId: gameweek.id, type: "BUY" } });
      if (purchases >= 2) throw new ApiError(409, "Лимит покупок этого тура исчерпан");
    }

    await tx.fantasyTeamPlayer.create({ data: { fantasyTeamId: current.id, playerId, status: SquadStatus.BENCH } });
    if (current.isInitialSquadComplete) await tx.userTransfer.create({ data: { userId: request.auth!.userId, gameweekId: gameweek.id, playerId, type: "BUY", price: player.price } });
    return tx.fantasyTeam.update({
      where: { id: current.id },
      data: { budget: { decrement: player.price }, ...(current.players.length + 1 >= 10 ? { isInitialSquadComplete: true } : {}) },
      include: teamInclude,
    });
  });
  response.status(201).json(await withTeamDisplayNumbers(team));
}));

router.delete("/players/:playerId", asyncRoute(async (request, response) => {
  const gameweek = await requireOpenMarket();
  const playerId = z.string().cuid().parse(request.params.playerId);
  const team = await inTransaction(async (tx) => {
    await assertOpenMarket(tx, request.method === "PATCH");
    const current = await tx.fantasyTeam.findUnique({ where: { userId: request.auth!.userId } });
    if (!current) throw new ApiError(404, "Fantasy-команда не найдена");
    const entry = await tx.fantasyTeamPlayer.findUnique({
      where: { fantasyTeamId_playerId: { fantasyTeamId: current.id, playerId } },
      include: { player: true },
    });
    if (!entry) throw new ApiError(404, "Этот игрок не состоит в вашей команде");
    if (current.isInitialSquadComplete) {
      const sales = await tx.userTransfer.count({ where: { userId: request.auth!.userId, gameweekId: gameweek.id, type: "SELL" } });
      if (sales >= 2) throw new ApiError(409, "Лимит продаж этого тура исчерпан");
      await tx.userTransfer.create({ data: { userId: request.auth!.userId, gameweekId: gameweek.id, playerId, type: "SELL", price: entry.player.price } });
    }
    await tx.fantasyTeamPlayer.delete({ where: { id: entry.id } });
    return tx.fantasyTeam.update({
      where: { id: current.id },
      data: { budget: { increment: entry.player.price } },
      include: teamInclude,
    });
  });
  response.json(await withTeamDisplayNumbers(team));
}));

router.patch("/players/:playerId", asyncRoute(async (request, response) => {
  await requireOpenMarket(true);
  const playerId = z.string().cuid().parse(request.params.playerId);
  const { status } = statusSchema.parse(request.body);
  const team = await inTransaction(async (tx) => {
    await assertOpenMarket(tx, request.method === "PATCH");
    const current = await tx.fantasyTeam.findUnique({
      where: { userId: request.auth!.userId },
      include: { players: true },
    });
    if (!current) throw new ApiError(404, "Fantasy-команда не найдена");
    const entry = current.players.find((item) => item.playerId === playerId);
    if (!entry) throw new ApiError(404, "Этот игрок не состоит в вашей команде");
    if (status === SquadStatus.STARTER && entry.status !== SquadStatus.STARTER && current.players.filter((item) => item.status === SquadStatus.STARTER).length >= 5) {
      throw new ApiError(400, "В основном составе уже 5 игроков");
    }
    await tx.fantasyTeamPlayer.update({
      where: { id: entry.id },
      data: { status, ...(status === SquadStatus.BENCH && entry.isCaptain ? { isCaptain: false } : {}) },
    });
    return tx.fantasyTeam.findUniqueOrThrow({ where: { id: current.id }, include: teamInclude });
  });
  response.json(await withTeamDisplayNumbers(team));
}));

router.patch("/lineup", asyncRoute(async (request, response) => {
  await requireOpenMarket(true);
  const input = lineupSchema.parse(request.body);
  const uniqueIds = new Set(input.players.map((player) => player.playerId));
  if (uniqueIds.size !== 10) throw new ApiError(400, "В составе есть повторяющиеся игроки");

  const team = await inTransaction(async (tx) => {
    await assertOpenMarket(tx, request.method === "PATCH");
    const current = await tx.fantasyTeam.findUnique({ where: { userId: request.auth!.userId }, include: teamInclude });
    if (!current) throw new ApiError(404, "Fantasy-команда не найдена");
    const ownedIds = new Set(current.players.map((entry) => entry.playerId));
    if (ownedIds.size !== uniqueIds.size || [...uniqueIds].some((id) => !ownedIds.has(id))) {
      throw new ApiError(400, "Можно сохранять только игроков из своей команды");
    }
    const requestedStatuses = new Map(input.players.map((entry) => [entry.playerId, entry.status]));
    const preview = {
      budget: current.budget,
      players: current.players.map((entry) => ({
        ...entry,
        status: requestedStatuses.get(entry.playerId)!,
      })),
    };
    ensureValidLineup(preview);
    await tx.fantasyTeam.update({ where: { id: current.id }, data: { isInitialSquadComplete: true } });
    await Promise.all(input.players.map((entry) => tx.fantasyTeamPlayer.updateMany({
      where: { fantasyTeamId: current.id, playerId: entry.playerId },
      data: { status: entry.status },
    })));
    return tx.fantasyTeam.findUniqueOrThrow({ where: { id: current.id }, include: teamInclude });
  });
  response.json(await withTeamDisplayNumbers(team));
}));

router.patch("/captain", asyncRoute(async (request, response) => {
  await requireOpenMarket(true);
  const { playerId } = captainSchema.parse(request.body);
  const team = await inTransaction(async (tx) => {
    await assertOpenMarket(tx, request.method === "PATCH");
    const current = await tx.fantasyTeam.findUnique({ where: { userId: request.auth!.userId } });
    if (!current) throw new ApiError(404, "Fantasy-команда не найдена");
    if (playerId === null) {
      await tx.fantasyTeamPlayer.updateMany({ where: { fantasyTeamId: current.id }, data: { isCaptain: false } });
      return tx.fantasyTeam.findUniqueOrThrow({ where: { id: current.id }, include: teamInclude });
    }
    const entry = await tx.fantasyTeamPlayer.findUnique({
      where: { fantasyTeamId_playerId: { fantasyTeamId: current.id, playerId } },
    });
    if (!entry) throw new ApiError(404, "Этот игрок не состоит в вашей команде");
    if (entry.status !== SquadStatus.STARTER) throw new ApiError(400, "Капитан должен быть в основном составе");
    await tx.fantasyTeamPlayer.updateMany({ where: { fantasyTeamId: current.id }, data: { isCaptain: false } });
    await tx.fantasyTeamPlayer.update({ where: { id: entry.id }, data: { isCaptain: true } });
    return tx.fantasyTeam.findUniqueOrThrow({ where: { id: current.id }, include: teamInclude });
  });
  response.json(await withTeamDisplayNumbers(team));
}));

export default router;
