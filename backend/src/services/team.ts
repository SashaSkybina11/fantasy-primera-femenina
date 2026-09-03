import { PlayerPosition, SquadStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/http.js";
import { withDisplayNumbers } from "../utils/players.js";

export const teamInclude = {
  user: { select: { id: true, name: true, avatarUrl: true } },
  players: {
    include: { player: { include: { club: true } } },
    orderBy: { createdAt: "asc" as const },
  },
};

export async function getOwnTeam(userId: string) {
  const team = await prisma.fantasyTeam.findUnique({
    where: { userId },
    include: teamInclude,
  });
  if (!team) throw new ApiError(404, "Fantasy-команда не найдена");
  return withTeamDisplayNumbers(team);
}

export async function withTeamDisplayNumbers<T extends { players: Array<{ player: { id: string; clubId: string; number: number } }> }>(team: T) {
  const catalog = await prisma.player.findMany({ orderBy: [{ clubId: "asc" }, { role: "asc" }, { number: "asc" }] });
  const displayNumbers = new Map(withDisplayNumbers(catalog).map((player) => [player.id, player.displayNumber]));

  return {
    ...team,
    players: team.players.map((entry) => ({
      ...entry,
      player: { ...entry.player, displayNumber: displayNumbers.get(entry.player.id) ?? String(entry.player.number) },
    })),
  };
}

export function ensureValidLineup(
  team: { budget: number; players: Array<{ status: SquadStatus; isCaptain: boolean; player: { position: PlayerPosition } }> },
) {
  if (team.budget < 0) throw new ApiError(400, "Бюджет не может быть отрицательным");
  if (team.players.length !== 10) throw new ApiError(400, "Нужно выбрать ровно 10 игроков");

  const starters = team.players.filter((entry) => entry.status === SquadStatus.STARTER);
  const bench = team.players.filter((entry) => entry.status === SquadStatus.BENCH);
  if (starters.length !== 5) throw new ApiError(400, "В основном составе должно быть ровно 5 игроков");
  if (bench.length !== 5) throw new ApiError(400, "На скамейке должно быть ровно 5 игроков");
  if (starters.filter((entry) => entry.player.position === PlayerPosition.GOALKEEPER).length !== 1) {
    throw new ApiError(400, "В основном составе должен быть ровно один вратарь");
  }
  if (starters.filter((entry) => entry.player.position === PlayerPosition.FIELD_PLAYER).length !== 4) {
    throw new ApiError(400, "В основном составе должны быть четыре полевых игрока");
  }
  const captains = team.players.filter((entry) => entry.isCaptain);
  if (captains.length !== 1 || captains[0]?.status !== SquadStatus.STARTER) {
    throw new ApiError(400, "Выберите одного капитана из основного состава");
  }
}
