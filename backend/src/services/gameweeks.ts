import { AdminActionType, GameweekStatus, MatchResult, PlayerPosition, Prisma, SquadStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/http.js";

type Db = Prisma.TransactionClient;

export function calculatePlayerPoints(input: {
  participated: boolean; result: MatchResult; goals: number; yellowCards: number;
  redCards: number; cleanSheet: boolean; position: PlayerPosition;
}) {
  if (!input.participated) return 0;
  return 1
    + (input.result === MatchResult.WIN ? 2 : input.result === MatchResult.DRAW ? 1 : 0)
    + input.goals * (input.position === PlayerPosition.GOALKEEPER ? 8 : 5)
    + (input.goals >= 3 ? 3 : 0)
    + (input.position === PlayerPosition.GOALKEEPER && input.cleanSheet ? 5 : 0)
    - input.yellowCards
    - input.redCards * 4;
}

export async function snapshotGameweek(tx: Db, gameweekId: string) {
  const teams = await tx.fantasyTeam.findMany({ include: { user: true, players: { include: { player: true } } } });
  for (const team of teams) {
    const starters = team.players.filter((item) => item.status === SquadStatus.STARTER);
    const valid = team.players.length === 10 && starters.length === 5
      && starters.filter((item) => item.player.position === PlayerPosition.GOALKEEPER).length === 1
      && starters.filter((item) => item.player.position === PlayerPosition.FIELD_PLAYER).length === 4
      && starters.filter((item) => item.isCaptain).length === 1;
    if (!valid) continue;
    await tx.userGameweekSquad.upsert({
      where: { gameweekId_userId: { gameweekId, userId: team.userId } },
      update: {},
      create: {
        gameweekId, userId: team.userId, fantasyTeamName: team.name,
        players: { create: team.players.map((item) => ({ playerId: item.playerId, status: item.status, isCaptain: item.isCaptain })) },
      },
    });
  }
}

export async function synchronizeGameweeks(now = new Date()) {
  await prisma.$transaction(async (tx) => {
    await tx.gameweek.updateMany({
      where: { status: GameweekStatus.UPCOMING, marketOpenAt: { lte: now }, deadlineAt: { gt: now } },
      data: { status: GameweekStatus.OPEN },
    });
    const expired = await tx.gameweek.findMany({ where: { status: GameweekStatus.OPEN, deadlineAt: { lte: now } } });
    for (const gameweek of expired) {
      await snapshotGameweek(tx, gameweek.id);
      await tx.gameweek.update({ where: { id: gameweek.id }, data: { status: GameweekStatus.LOCKED } });
    }
  });
}

export async function requireOpenMarket() {
  await synchronizeGameweeks();
  const now = new Date();
  const gameweek = await prisma.gameweek.findFirst({
    where: { status: GameweekStatus.OPEN, marketOpenAt: { lte: now }, deadlineAt: { gt: now } },
    orderBy: { number: "asc" },
  });
  if (!gameweek) throw new ApiError(423, "Трансферный рынок закрыт");
  return gameweek;
}

export async function recalculateGameweek(tx: Db, gameweekId: string) {
  const squads = await tx.userGameweekSquad.findMany({
    where: { gameweekId },
    include: { players: { include: { player: true } } },
  });
  const stats = await tx.playerGameweekStats.findMany({ where: { gameweekId } });
  const statsByPlayer = new Map(stats.map((item) => [item.playerId, item]));
  const adjustments = await tx.userPointAdjustment.groupBy({ by: ["userId"], where: { gameweekId }, _sum: { points: true } });
  const adjustmentsByUser = new Map(adjustments.map((item) => [item.userId, item._sum.points ?? 0]));

  for (const squad of squads) {
    let playerPoints = 0; let captainBonus = 0; let starterGoals = 0;
    const breakdown = squad.players.filter((item) => item.status === SquadStatus.STARTER).map((item) => {
      const stat = statsByPlayer.get(item.playerId);
      const basePoints = stat?.totalPoints ?? 0;
      const points = basePoints * (item.isCaptain ? 2 : 1);
      playerPoints += basePoints;
      if (item.isCaptain) captainBonus += basePoints;
      starterGoals += stat?.goals ?? 0;
      return { playerId: item.playerId, name: item.player.name, isCaptain: item.isCaptain, basePoints, points };
    });
    const adjustmentPoints = adjustmentsByUser.get(squad.userId) ?? 0;
    await tx.userGameweekPoints.upsert({
      where: { gameweekId_userId: { gameweekId, userId: squad.userId } },
      update: { playerPoints, captainBonus, adjustmentPoints, totalPoints: playerPoints + captainBonus + adjustmentPoints, starterGoals, breakdown },
      create: { gameweekId, userId: squad.userId, playerPoints, captainBonus, adjustmentPoints, totalPoints: playerPoints + captainBonus + adjustmentPoints, starterGoals, breakdown },
    });
  }

  const rows = await tx.userGameweekPoints.findMany({ where: { gameweekId }, orderBy: [{ totalPoints: "desc" }, { playerPoints: "desc" }, { starterGoals: "desc" }] });
  let rank = 0;
  for (let index = 0; index < rows.length; index += 1) {
    const previous = rows[index - 1]; const row = rows[index]!;
    if (!previous || previous.totalPoints !== row.totalPoints || previous.playerPoints !== row.playerPoints || previous.starterGoals !== row.starterGoals) rank = index + 1;
    await tx.userGameweekPoints.update({ where: { id: row.id }, data: { rank } });
  }
  return rows;
}

export async function audit(tx: Db, adminUserId: string, action: AdminActionType, entityType: string, entityId: string, oldData: unknown, newData: unknown) {
  await tx.adminAuditLog.create({ data: { adminUserId, action, entityType, entityId, oldData: oldData as Prisma.InputJsonValue, newData: newData as Prisma.InputJsonValue } });
}
