import { MatchResult, PlayerPosition, Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { ApiError } from "../utils/http.js";

export const PRICE_RULES = { goal: 100, started: 30, yellowCard: -15, redCard: -30, goalkeeperCleanSheet: 50, conceded: -10 } as const;

export function calculatePlayerPriceDelta(input: {
  position: PlayerPosition; goals: number; started: boolean; yellowCards: number;
  redCards: number; goalsConceded: number | null; result: MatchResult;
}, teamWin: number | null) {
  const components = {
    teamResultDelta: input.result === "WIN" ? teamWin ?? 0 : 0,
    goalsDelta: input.goals * PRICE_RULES.goal,
    startedDelta: input.started ? PRICE_RULES.started : 0,
    yellowCardsDelta: input.yellowCards * PRICE_RULES.yellowCard,
    redCardsDelta: input.redCards * PRICE_RULES.redCard,
    goalkeeperDelta: input.position !== "GOALKEEPER" || input.goalsConceded === null ? 0
      : input.goalsConceded === 0 ? PRICE_RULES.goalkeeperCleanSheet
      : Math.max(0, input.goalsConceded - 1) * PRICE_RULES.conceded,
  };
  return { ...components, priceDelta: Object.values(components).reduce((sum, value) => sum + value, 0) };
}

// Rebase subsequent recorded weeks when an earlier result is corrected.
export function rebasePriceHistory(priceBefore: number, deltas: number[]) {
  return deltas.map(priceDelta => {
    const row = { priceBefore, priceDelta, priceAfter: priceBefore + priceDelta };
    priceBefore = row.priceAfter;
    if (priceBefore < 0) throw new ApiError(409, "NEGATIVE_PLAYER_PRICE");
    return row;
  });
}

export async function previewPlayerPrices(tx: Prisma.TransactionClient, gameweekId: string) {
  const gameweek = await tx.gameweek.findUnique({ where: { id: gameweekId } });
  if (!gameweek) throw new ApiError(404, "Тур не найден");
  const settings = await tx.priceSettings.findUnique({ where: { id: "default" } });
  const players = await tx.player.findMany({
    orderBy: { id: "asc" },
    include: { club: true, gameweekStats: { where: { gameweekId } }, priceChanges: { include: { gameweek: true }, orderBy: { gameweek: { number: "asc" } } } },
  });
  const rows = players.map(player => {
    const stat = player.gameweekStats[0];
    const existing = player.priceChanges.find(row => row.gameweekId === gameweekId);
    const later = player.priceChanges.filter(row => row.gameweek.number > gameweek.number);
    const teamWinBonus = existing ? existing.teamWinBonus : settings?.teamWin ?? null;
    const delta = calculatePlayerPriceDelta(stat ? { ...stat, position: player.position } : {
      position: player.position, goals: 0, started: false, yellowCards: 0, redCards: 0, goalsConceded: null, result: "LOSS",
    }, teamWinBonus);
    const priceBefore = existing?.priceBefore ?? later[0]?.priceBefore ?? player.price;
    const rebased = rebasePriceHistory(priceBefore, [delta.priceDelta, ...later.map(row => row.priceDelta)]);
    return {
      playerId: player.id, number: player.number, name: player.name, clubId: player.clubId,
      club: player.club.name, position: player.position, currentPrice: player.price,
      lastDelta: player.priceChanges.at(-1)?.priceDelta ?? 0,
      priceBefore, ...delta, priceAfter: rebased[0]!.priceAfter,
      newCurrentPrice: rebased.at(-1)!.priceAfter, teamWinBonus,
      applied: Boolean(existing), missingStats: !stat,
      later: later.map((row, index) => ({ id: row.id, ...rebased[index + 1]! })),
    };
  });
  const revision = createHash("sha256").update(JSON.stringify({ gameweek, settings, players })).digest("hex");
  return { gameweekId, teamWin: settings?.teamWin ?? null, revision, rows };
}

export async function applyPlayerPrices(tx: Prisma.TransactionClient, gameweekId: string, revision: string) {
  const preview = await previewPlayerPrices(tx, gameweekId);
  if (preview.revision !== revision) throw new ApiError(409, "PRICE_PREVIEW_STALE");
  const gameweek = await tx.gameweek.findUniqueOrThrow({ where: { id: gameweekId } });
  if (gameweek.status !== "COMPLETED") throw new ApiError(409, "PRICE_GAMEWEEK_NOT_COMPLETED");
  for (const row of preview.rows) {
    const data = {
      priceBefore: row.priceBefore, priceAfter: row.priceAfter, priceDelta: row.priceDelta,
      teamResultDelta: row.teamResultDelta, goalsDelta: row.goalsDelta, startedDelta: row.startedDelta,
      yellowCardsDelta: row.yellowCardsDelta, redCardsDelta: row.redCardsDelta, goalkeeperDelta: row.goalkeeperDelta,
      teamWinBonus: row.teamWinBonus,
    };
    await tx.playerPriceChange.upsert({ where: { playerId_gameweekId: { playerId: row.playerId, gameweekId } },
      create: { playerId: row.playerId, gameweekId, ...data }, update: data });
    for (const later of row.later) await tx.playerPriceChange.update({ where: { id: later.id }, data: { priceBefore: later.priceBefore, priceAfter: later.priceAfter } });
    await tx.player.update({ where: { id: row.playerId }, data: { price: row.newCurrentPrice } });
  }
  return preview;
}
