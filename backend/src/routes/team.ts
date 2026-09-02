import { PlayerPosition, SquadStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { inTransaction } from "../lib/transaction.js";
import { authenticate } from "../middleware/auth.js";
import { ensureValidLineup, getOwnTeam, teamInclude } from "../services/team.js";
import { asyncRoute, ApiError } from "../utils/http.js";

const router = Router();
const playerIdSchema = z.object({ playerId: z.string().cuid() });
const statusSchema = z.object({ status: z.nativeEnum(SquadStatus) });
const lineupSchema = z.object({
  players: z.array(z.object({ playerId: z.string().cuid(), status: z.nativeEnum(SquadStatus) })).length(10),
});

router.use(authenticate);

router.get("/", asyncRoute(async (request, response) => {
  response.json(await getOwnTeam(request.auth!.userId));
}));

router.post("/players", asyncRoute(async (request, response) => {
  const { playerId } = playerIdSchema.parse(request.body);
  const team = await inTransaction(async (tx) => {
    const current = await tx.fantasyTeam.findUnique({
      where: { userId: request.auth!.userId },
      include: { players: true },
    });
    if (!current) throw new ApiError(404, "Fantasy-команда не найдена");
    if (current.players.length >= 10) throw new ApiError(400, "Состав уже заполнен");
    if (current.players.some((entry) => entry.playerId === playerId)) throw new ApiError(409, "Игрок уже выбран");

    const player = await tx.player.findUnique({ where: { id: playerId } });
    if (!player) throw new ApiError(404, "Игрок не найден");
    if (current.budget < player.price) throw new ApiError(400, "Недостаточно бюджета для этого игрока");

    await tx.fantasyTeamPlayer.create({ data: { fantasyTeamId: current.id, playerId, status: SquadStatus.BENCH } });
    return tx.fantasyTeam.update({
      where: { id: current.id },
      data: { budget: { decrement: player.price } },
      include: teamInclude,
    });
  });
  response.status(201).json(team);
}));

router.delete("/players/:playerId", asyncRoute(async (request, response) => {
  const playerId = z.string().cuid().parse(request.params.playerId);
  const team = await inTransaction(async (tx) => {
    const current = await tx.fantasyTeam.findUnique({ where: { userId: request.auth!.userId } });
    if (!current) throw new ApiError(404, "Fantasy-команда не найдена");
    const entry = await tx.fantasyTeamPlayer.findUnique({
      where: { fantasyTeamId_playerId: { fantasyTeamId: current.id, playerId } },
      include: { player: true },
    });
    if (!entry) throw new ApiError(404, "Этот игрок не состоит в вашей команде");
    await tx.fantasyTeamPlayer.delete({ where: { id: entry.id } });
    return tx.fantasyTeam.update({
      where: { id: current.id },
      data: { budget: { increment: entry.player.price } },
      include: teamInclude,
    });
  });
  response.json(team);
}));

router.patch("/players/:playerId", asyncRoute(async (request, response) => {
  const playerId = z.string().cuid().parse(request.params.playerId);
  const { status } = statusSchema.parse(request.body);
  const team = await inTransaction(async (tx) => {
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
  response.json(team);
}));

router.patch("/lineup", asyncRoute(async (request, response) => {
  const input = lineupSchema.parse(request.body);
  const uniqueIds = new Set(input.players.map((player) => player.playerId));
  if (uniqueIds.size !== 10) throw new ApiError(400, "В составе есть повторяющиеся игроки");

  const team = await inTransaction(async (tx) => {
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
    await Promise.all(input.players.map((entry) => tx.fantasyTeamPlayer.updateMany({
      where: { fantasyTeamId: current.id, playerId: entry.playerId },
      data: { status: entry.status },
    })));
    return tx.fantasyTeam.findUniqueOrThrow({ where: { id: current.id }, include: teamInclude });
  });
  response.json(team);
}));

router.patch("/captain", asyncRoute(async (request, response) => {
  const { playerId } = playerIdSchema.parse(request.body);
  const team = await inTransaction(async (tx) => {
    const current = await tx.fantasyTeam.findUnique({ where: { userId: request.auth!.userId } });
    if (!current) throw new ApiError(404, "Fantasy-команда не найдена");
    const entry = await tx.fantasyTeamPlayer.findUnique({
      where: { fantasyTeamId_playerId: { fantasyTeamId: current.id, playerId } },
    });
    if (!entry) throw new ApiError(404, "Этот игрок не состоит в вашей команде");
    if (entry.status !== SquadStatus.STARTER) throw new ApiError(400, "Капитан должен быть в основном составе");
    await tx.fantasyTeamPlayer.updateMany({ where: { fantasyTeamId: current.id }, data: { isCaptain: false } });
    await tx.fantasyTeamPlayer.update({ where: { id: entry.id }, data: { isCaptain: true } });
    return tx.fantasyTeam.findUniqueOrThrow({ where: { id: current.id }, include: teamInclude });
  });
  response.json(team);
}));

export default router;
