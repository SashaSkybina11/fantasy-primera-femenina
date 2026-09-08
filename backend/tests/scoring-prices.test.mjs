import test from "node:test";
import assert from "node:assert/strict";
import { calculatePlayerPoints, assertOpenMarket } from "../dist/services/gameweeks.js";
import { calculatePlayerPriceDelta, rebasePriceHistory, previewPlayerPrices, applyPlayerPrices } from "../dist/services/player-prices.js";
import { applyTeamResults, normalizeGoalkeeperStats } from "../dist/services/player-stats.js";
import { madridInstant, marketDatesForWeek } from "../dist/services/market-schedule.js";

const stats = { started: false, goals: 0, yellowCards: 0, redCards: 0, cleanSheet: false, goalsConceded: null, result: "LOSS", position: "FIELD_PLAYER" };
test("non-starter scores goals/result; starting bonus is independent", () => {
  assert.equal(calculatePlayerPoints({ ...stats, goals: 3 }), 18);
  assert.equal(calculatePlayerPoints({ ...stats, goals: 3, result: "WIN" }), 20);
  assert.equal(calculatePlayerPoints({ ...stats, started: true }), 2);
  assert.equal(calculatePlayerPoints({ ...stats, result: "WIN" }), 2);
});
test("price examples and unknown team bonus", () => {
  for (const [input, expected] of [[{ goals: 2 },200],[{ started: true, goals: 1 },130],[{ yellowCards: 2, redCards: 1 },-60],[{ started: true, goals: 2, yellowCards: 1 },215],[{ position: "GOALKEEPER", started: true, goalsConceded: 0, yellowCards: 1 },65]]) {
    assert.equal(calculatePlayerPriceDelta({ ...stats, ...input }, null).priceDelta, expected);
  }
  assert.equal(calculatePlayerPriceDelta({ ...stats, goals: 2, started: true }, null).priceDelta, 230);
  assert.equal(calculatePlayerPriceDelta({ ...stats, yellowCards: 1, redCards: 1 }, null).priceDelta, -45);
  for (const [goalsConceded, expected] of [[0,50],[1,0],[2,-10],[3,-20],[4,-30],[5,-40],[6,-50],[null,0]]) {
    assert.equal(calculatePlayerPriceDelta({ ...stats, position: "GOALKEEPER", goalsConceded }, null).priceDelta, expected);
  }
  assert.equal(calculatePlayerPriceDelta({ ...stats, goalsConceded: 0 }, null).priceDelta, 0);
  assert.equal(calculatePlayerPriceDelta({ ...stats, position: "GOALKEEPER", goals: 2 }, null).priceDelta, 200);
  assert.equal(calculatePlayerPriceDelta({ ...stats, result: "WIN" }, null).priceDelta, 0);
  assert.equal(calculatePlayerPriceDelta({ ...stats, result: "WIN" }, 70).priceDelta, 70);
});
test("goalkeeper validation rejects impossible states", () => {
  assert.equal(normalizeGoalkeeperStats("GOALKEEPER", { cleanSheet: false, goalsConceded: 0 }).cleanSheet, true);
  for (const input of [{ cleanSheet: true, goalsConceded: 3 }, { cleanSheet: true, goalsConceded: null }, { cleanSheet: false, goalsConceded: -1 }]) assert.throws(() => normalizeGoalkeeperStats("GOALKEEPER", input));
  assert.throws(() => normalizeGoalkeeperStats("FIELD_PLAYER", { cleanSheet: false, goalsConceded: 0 }));
});
test("Madrid windows follow CET/CEST, including both DST Sundays", () => {
  for (const [date, open, close] of [
    ["2026-09-05", "2026-09-01T08:00:00.000Z", "2026-09-04T10:00:00.000Z"],
    ["2026-10-25", "2026-10-20T08:00:00.000Z", "2026-10-23T10:00:00.000Z"],
    ["2026-10-31", "2026-10-27T09:00:00.000Z", "2026-10-30T11:00:00.000Z"],
    ["2027-03-28", "2027-03-23T09:00:00.000Z", "2027-03-26T11:00:00.000Z"],
    ["2027-04-03", "2027-03-30T08:00:00.000Z", "2027-04-02T10:00:00.000Z"],
  ]) { const dates = marketDatesForWeek(new Date(date)); assert.equal(dates.marketOpenAt.toISOString(), open); assert.equal(dates.deadlineAt.toISOString(), close); }
  assert.equal(madridInstant(2026, 9, 25, 23, 59, 59).toISOString(), "2026-10-25T22:59:59.000Z");
});
test("market guard rejects lineup at deadline with 409", async () => {
  const dates = marketDatesForWeek(new Date("2026-09-05"));
  const tx = { gameweek: { findFirst: async ({ where }) => dates.marketOpenAt <= where.marketOpenAt.lte && dates.deadlineAt > where.deadlineAt.gt ? { id: "week" } : null } };
  assert.equal((await assertOpenMarket(tx, true, dates.marketOpenAt)).id, "week");
  await assert.rejects(assertOpenMarket(tx, true, dates.deadlineAt), error => error.status === 409 && error.message === "LINEUP_MARKET_CLOSED");
});

test("bulk club result preserves negative totals and adjustments and updates rank", async () => {
  const old = { ...stats, id: "stat", playerId: "p1", gameweekId: "w", goals: 3, adjustmentPoints: -100, adjustmentReason: "correction" };
  const stored = new Map([["p1", old]]); const ranks = [];
  const tx = {
    gameweek: { findUnique: async () => ({ status: "LOCKED" }), findUniqueOrThrow: async () => ({ status: "LOCKED" }) },
    club: { findUnique: async () => ({ players: [{ id: "p1", position: "FIELD_PLAYER", gameweekStats: [old] }, { id: "p2", position: "FIELD_PLAYER", gameweekStats: [] }] }) },
    playerGameweekStats: {
      upsert: async ({ create, update }) => { const data = stored.has(create.playerId) ? { ...stored.get(create.playerId), ...update } : { ...stats, adjustmentPoints: 0, ...create }; stored.set(create.playerId, data); return data; },
      findMany: async () => [...stored.values()].map(s => ({ ...s, player: { position: "FIELD_PLAYER" } })),
      update: async ({ where, data }) => Object.assign([...stored.values()].find(s => s.id === where.id), data),
    },
    adminAuditLog: { create: async () => ({}) },
    userGameweekSquad: { findMany: async () => [{ userId: "user", players: [{ status: "STARTER", playerId: "p2", player: { name: "Player" }, isCaptain: true }] }] },
    userPointAdjustment: { groupBy: async () => [] },
    userGameweekPoints: { updateMany: async () => ({}), upsert: async ({ create }) => { ranks.push({ id: "u", ...create }); }, findMany: async () => ranks, update: async ({ data }) => Object.assign(ranks[0], data) },
  };
  await applyTeamResults(tx, "w", [{ clubId: "club", result: "WIN" }], "admin");
  assert.equal(stored.get("p1").goals, 3);
  assert.equal(stored.get("p1").adjustmentReason, "correction");
  assert.equal(stored.get("p1").started, false);
  assert.equal(stored.get("p1").calculatedPoints, 20);
  assert.equal(stored.get("p1").totalPoints, -80);
  assert.equal(stored.get("p2").totalPoints, 2);
  assert.equal(ranks[0].totalPoints, 2);
  assert.equal(ranks[0].rank, 1);
});

test("price application replaces a week, rebases later weeks, rejects stale preview", async () => {
  const weeks = [{ id: "w1", number: 1, status: "COMPLETED" }, { id: "w2", number: 2, status: "COMPLETED" }];
  const player = { id: "p", price: 3000, name: "Test", number: 10, clubId: "c", club: { name: "Club" }, position: "FIELD_PLAYER", priceChanges: [] };
  const events = { w1: { ...stats, goals: 2 }, w2: { ...stats, goals: 1 } };
  const tx = {
    gameweek: { findUnique: async ({ where }) => weeks.find(w => w.id === where.id), findUniqueOrThrow: async ({ where }) => weeks.find(w => w.id === where.id) },
    priceSettings: { findUnique: async () => ({ teamWin: null }) },
    player: { findMany: async ({ include }) => [{ ...player, gameweekStats: [events[include.gameweekStats.where.gameweekId]], priceChanges: [...player.priceChanges].sort((a,b) => a.gameweek.number - b.gameweek.number) }], update: async ({ data }) => Object.assign(player, data) },
    playerPriceChange: {
      upsert: async ({ create, update }) => { const existing = player.priceChanges.find(r => r.gameweekId === create.gameweekId); if (existing) Object.assign(existing, update); else player.priceChanges.push({ ...create, id: create.gameweekId, gameweek: weeks.find(w => w.id === create.gameweekId) }); },
      update: async ({ where, data }) => Object.assign(player.priceChanges.find(r => r.id === where.id), data),
    },
  };
  const apply = async id => applyPlayerPrices(tx, id, (await previewPlayerPrices(tx, id)).revision);
  const first = await previewPlayerPrices(tx, "w1");
  await applyPlayerPrices(tx, "w1", first.revision); assert.equal(player.price, 3200);
  await assert.rejects(applyPlayerPrices(tx, "w1", first.revision), /PRICE_PREVIEW_STALE/);
  await apply("w1"); assert.equal(player.price, 3200);
  await apply("w2"); assert.equal(player.price, 3300);
  events.w1.goals = 3;
  await apply("w1"); assert.equal(player.price, 3400);
  assert.equal(player.priceChanges.length, 2);
  assert.equal(player.priceChanges.find(r => r.gameweekId === "w2").priceBefore, 3300);
  await apply("w1"); assert.equal(player.price, 3400);
  assert.deepEqual(rebasePriceHistory(3000, [230, -45]).map(r => r.priceAfter), [3230, 3185]);
});

test("a price cannot be reduced to zero", () => {
  assert.throws(() => rebasePriceHistory(100, [-100]), error => error.message === "INVALID_PLAYER_PRICE");
});
