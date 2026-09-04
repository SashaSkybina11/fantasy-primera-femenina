import { AdminActionType, MatchResult, PlayerPosition, Prisma } from "@prisma/client";
import { ApiError } from "../utils/http.js";
import { audit, calculatePlayerPoints, recalculateGameweek } from "./gameweeks.js";

export function normalizeGoalkeeperStats(position: PlayerPosition, input: { cleanSheet: boolean; goalsConceded: number | null }) {
  if (input.goalsConceded !== null && (!Number.isInteger(input.goalsConceded) || input.goalsConceded < 0)) throw new ApiError(400, "INVALID_GOALKEEPER_STATS");
  if (position !== "GOALKEEPER" && (input.cleanSheet || input.goalsConceded !== null)) throw new ApiError(400, "INVALID_GOALKEEPER_STATS");
  if (input.cleanSheet && input.goalsConceded !== 0) throw new ApiError(400, "INVALID_GOALKEEPER_STATS");
  return { ...input, cleanSheet: position === "GOALKEEPER" && input.goalsConceded === 0 };
}

export async function applyTeamResults(tx: Prisma.TransactionClient, gameweekId: string, results: Array<{ clubId: string; result: MatchResult }>, adminUserId: string) {
    const gameweek = await tx.gameweek.findUnique({ where: { id: gameweekId } });
    if (!gameweek) throw new ApiError(404, "Тур не найден");
    if (gameweek.status === "COMPLETED") throw new ApiError(409, "Сначала повторно откройте завершённый тур");
    for (const { clubId, result } of results) {
      const club = await tx.club.findUnique({ where: { id: clubId }, include: { players: { include: { gameweekStats: { where: { gameweekId } } } } } });
      if (!club) throw new ApiError(404, "Команда не найдена");
      for (const player of club.players) {
        const old = player.gameweekStats[0];
        const calculatedPoints = calculatePlayerPoints({ ...(old ?? { started: false, goals: 0, yellowCards: 0, redCards: 0, cleanSheet: false }), result, position: player.position });
        const data = { result, calculatedPoints, totalPoints: Math.max(0, calculatedPoints + (old?.adjustmentPoints ?? 0)) };
        const saved = await tx.playerGameweekStats.upsert({ where: { gameweekId_playerId: { gameweekId, playerId: player.id } }, update: data, create: { gameweekId, playerId: player.id, ...data } });
        await audit(tx, adminUserId, AdminActionType.PLAYER_STATS_UPDATED, "PlayerGameweekStats", saved.id, old ?? null, saved);
      }
    }
    await recalculateGameweek(tx, gameweekId);
}
