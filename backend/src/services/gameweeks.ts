import { AdminActionType, GameweekStatus, MatchResult, PlayerPosition, Prisma, SquadStatus } from "@prisma/client";
import { marketDatesForWeek } from "./market-schedule.js";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/http.js";

type Db = Prisma.TransactionClient;

export const scoringRules = {
  started: 2,
  win: 2,
  draw: 1,
  fieldGoal: 5,
  goalkeeperGoal: 8,
  goalkeeperCleanSheet: 5,
  hatTrickBonus: 3,
  yellowCard: -1,
  redCard: -4,
} as const;

export async function ensureSeasonGameweeks() {
  const firstMonday = Date.UTC(2026, 7, 31);
  await prisma.$transaction(async (tx) => {
    for (let number = 1; number <= 30; number += 1) {
      const monday = firstMonday + (number - 1) * 7 * 24 * 60 * 60 * 1000;
      const { marketOpenAt, deadlineAt, endsAt } = marketDatesForWeek(new Date(monday));
      const existing = await tx.gameweek.findUnique({ where: { number } });
      if (existing && existing.marketOpenAt.getTime() === marketOpenAt.getTime() && existing.deadlineAt.getTime() === deadlineAt.getTime()) continue;
      await tx.gameweek.upsert({
        where: { number },
        update: { marketOpenAt, deadlineAt },
        create: { number, name: `Jornada ${number}`, marketOpenAt, deadlineAt, startsAt: deadlineAt, endsAt },
      });
    }
  });
}

export function calculatePlayerPoints(input: {
  started: boolean; result: MatchResult; goals: number; yellowCards: number;
  redCards: number; cleanSheet: boolean; position: PlayerPosition;
}) {
  return (input.started ? scoringRules.started : 0)
    + (input.result === MatchResult.WIN ? scoringRules.win : input.result === MatchResult.DRAW ? scoringRules.draw : 0)
    + input.goals * (input.position === PlayerPosition.GOALKEEPER ? scoringRules.goalkeeperGoal : scoringRules.fieldGoal)
    + (input.goals >= 3 ? scoringRules.hatTrickBonus : 0)
    + (input.position === PlayerPosition.GOALKEEPER && input.cleanSheet ? scoringRules.goalkeeperCleanSheet : 0)
    + input.yellowCards * scoringRules.yellowCard
    + input.redCards * scoringRules.redCard;
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
  await ensureSeasonGameweeks();
  await prisma.$transaction(async (tx) => {
    await tx.gameweek.updateMany({
      where: { status: GameweekStatus.UPCOMING, marketOpenAt: { lte: now }, deadlineAt: { gt: now } },
      data: { status: GameweekStatus.OPEN },
    });
    const expired = await tx.gameweek.findMany({ where: { status: { in: [GameweekStatus.OPEN, GameweekStatus.UPCOMING] }, deadlineAt: { lte: now } } });
    for (const gameweek of expired) {
      await snapshotGameweek(tx, gameweek.id);
      await tx.gameweek.update({ where: { id: gameweek.id }, data: { status: GameweekStatus.LOCKED } });
    }
  });
}

export async function requireOpenMarket(lineup = false) {
  await synchronizeGameweeks();
  return assertOpenMarket(prisma, lineup);
}

export async function assertOpenMarket(tx: Db, lineup = false, now = new Date()) {
  const gameweek = await tx.gameweek.findFirst({
    where: { status: GameweekStatus.OPEN, marketOpenAt: { lte: now }, deadlineAt: { gt: now } },
    orderBy: { number: "asc" },
  });
  if (!gameweek) throw new ApiError(lineup ? 409 : 423, lineup ? "LINEUP_MARKET_CLOSED" : "Трансферный рынок закрыт");
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
