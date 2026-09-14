import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { inTransaction } from "../lib/transaction.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import { asyncRoute, ApiError } from "../utils/http.js";
import { audit, calculatePlayerPoints, recalculateGameweek, synchronizeGameweeks, snapshotGameweek } from "../services/gameweeks.js";
import { protocolSchema, validateProtocol } from "../services/match-protocol.js";

const router = Router();
router.use(authenticate);
const include = { teams: { include: { club: true }, orderBy: { side: "desc" as const } }, gameweek: true };
router.get("/weeks", asyncRoute(async (_req, res) => {
  await synchronizeGameweeks();
  res.json(await prisma.gameweek.findMany({ orderBy: { number: "asc" } }));
}));
router.get("/", asyncRoute(async (req, res) => {
  const gameweekId = z.string().cuid().parse(req.query.gameweekId);
  const matches = await prisma.match.findMany({ where: { gameweekId }, include, orderBy: [{ kickoffAt: "asc" }, { createdAt: "asc" }] });
  res.json(matches.map(({ draft: _draft, ...match }) => match));
}));
router.get("/:id", asyncRoute(async (req, res) => {
  const match = await prisma.match.findUnique({ where: { id: z.string().cuid().parse(req.params.id) }, include });
  if (!match) throw new ApiError(404, "MATCH_NOT_FOUND");
  const { draft: _draft, ...publicMatch } = match;
  res.json(publicMatch);
}));
router.post("/", requireAdmin, asyncRoute(async (req, res) => {
  const data = z.object({ gameweekId: z.string().cuid(), homeId: z.string().cuid(), awayId: z.string().cuid(), kickoffAt: z.string().datetime().nullable() }).parse(req.body);
  if (data.homeId === data.awayId) throw new ApiError(400, "MATCH_TEAMS");
  res.status(201).json(await inTransaction(async tx => {
    const week = await tx.gameweek.findUnique({ where: { id: data.gameweekId } });
    if (!week) throw new ApiError(404, "MATCH_NOT_FOUND");
    if (week.status === "COMPLETED") throw new ApiError(409, "MATCH_LOCKED");
    if (await tx.matchTeam.count({ where: { gameweekId: data.gameweekId, clubId: { in: [data.homeId, data.awayId] } } })) throw new ApiError(409, "MATCH_DUPLICATE");
    if (await tx.club.count({ where: { id: { in: [data.homeId, data.awayId] } } }) !== 2) throw new ApiError(400, "MATCH_TEAMS");
    return tx.match.create({ data: { gameweekId: data.gameweekId, kickoffAt: data.kickoffAt, teams: { create: [{ gameweekId: data.gameweekId, clubId: data.homeId, side: "home" }, { gameweekId: data.gameweekId, clubId: data.awayId, side: "away" }] } }, include });
  }));
}));
router.get("/:id/editor", requireAdmin, asyncRoute(async (req, res) => {
  const match = await prisma.match.findUnique({ where: { id: z.string().cuid().parse(req.params.id) }, include });
  if (!match) throw new ApiError(404, "MATCH_NOT_FOUND");
  const clubIds = match.teams.map(t => t.clubId);
  const roster = await prisma.player.findMany({ where: { clubId: { in: clubIds } }, orderBy: [{ role: "asc" }, { number: "asc" }], include: { gameweekStats: { where: { gameweekId: match.gameweekId } } } });
  const previous = await prisma.match.findMany({ where: { publishedAt: { not: null }, gameweek: { number: { lt: match.gameweek.number } }, teams: { some: { clubId: { in: clubIds } } } }, orderBy: { gameweek: { number: "desc" } }, include: { teams: true } });
  const previousStarters = Object.fromEntries(clubIds.map(id => {
    const old = previous.find(m => m.teams.some(t => t.clubId === id));
    const parsed = protocolSchema.safeParse(old?.published);
    return [id, parsed.success ? parsed.data.players.filter(p => p.started && roster.some(r => r.id === p.playerId && r.clubId === id)).map(p => p.playerId) : []];
  }));
  const reported = z.object({ homeScore: z.number(), awayScore: z.number() }).safeParse(match.reportedResult);
  const initial = { homeScore: reported.success ? reported.data.homeScore : null, awayScore: reported.success ? reported.data.awayScore : null, homeOwnGoals: 0, awayOwnGoals: 0, players: roster.map(p => ({ playerId: p.id, started: p.gameweekStats[0]?.started ?? false, goals: p.gameweekStats[0]?.goals ?? 0, yellowCards: p.gameweekStats[0]?.yellowCards ?? 0, redCards: p.gameweekStats[0]?.redCards ?? 0, goalsConceded: p.gameweekStats[0]?.goalsConceded ?? null })) };
  res.json({ match, roster, previousStarters, protocol: match.draft ?? match.published ?? initial });
}));
router.put("/:id/editor", requireAdmin, asyncRoute(async (req, res) => {
  const id = z.string().cuid().parse(req.params.id);
  const input = z.object({ protocol: protocolSchema, version: z.number().int(), publish: z.boolean(), kickoffAt: z.string().datetime().nullable() }).parse(req.body);
  res.json(await inTransaction(async tx => {
    const match = await tx.match.findUnique({ where: { id }, include });
    if (!match) throw new ApiError(404, "MATCH_NOT_FOUND");
    if (match.gameweek.status === "COMPLETED") throw new ApiError(409, "MATCH_LOCKED");
    if (input.version !== match.version) throw new ApiError(409, "MATCH_STALE");
    const home = match.teams.find(t => t.side === "home")!;
    const away = match.teams.find(t => t.side === "away")!;
    const roster = await tx.player.findMany({ where: { clubId: { in: [home.clubId, away.clubId] } } });
    validateProtocol(input.protocol, roster, home.clubId, away.clubId, input.publish);
    let published;
    if (input.publish) {
      if (match.gameweek.deadlineAt > new Date()) throw new ApiError(409, "GAMEWEEK_NOT_LOCKED");
      if (match.gameweek.status === "OPEN" || match.gameweek.status === "UPCOMING") {
        await snapshotGameweek(tx, match.gameweekId);
        await tx.gameweek.update({ where: { id: match.gameweekId }, data: { status: "LOCKED" } });
      }
      const rows = [];
      for (const row of input.protocol.players) {
        const player = roster.find(p => p.id === row.playerId)!;
        const own = player.clubId === home.clubId ? input.protocol.homeScore! : input.protocol.awayScore!;
        const other = player.clubId === home.clubId ? input.protocol.awayScore! : input.protocol.homeScore!;
        const result = own === other ? "DRAW" as const : own > other ? "WIN" as const : "LOSS" as const;
        const { playerId, ...stats } = row;
        const cleanSheet = player.position === "GOALKEEPER" && stats.goalsConceded === 0;
        const calculatedPoints = calculatePlayerPoints({ ...stats, cleanSheet, result, position: player.position });
        const old = await tx.playerGameweekStats.findUnique({ where: { gameweekId_playerId: { gameweekId: match.gameweekId, playerId } } });
        const totalPoints = calculatedPoints + (old?.adjustmentPoints ?? 0);
        const data = { ...stats, cleanSheet, result, calculatedPoints, totalPoints };
        await tx.playerGameweekStats.upsert({ where: { gameweekId_playerId: { gameweekId: match.gameweekId, playerId } }, create: { ...data, gameweekId: match.gameweekId, playerId }, update: data });
        rows.push({ ...row, name: player.name, number: player.number, clubId: player.clubId, position: player.position, totalPoints, calculatedPoints, adjustmentPoints: old?.adjustmentPoints ?? 0, result });
      }
      published = { ...input.protocol, players: rows };
      await recalculateGameweek(tx, match.gameweekId);
    }
    const saved = await tx.match.update({ where: { id }, data: { draft: input.protocol, kickoffAt: input.kickoffAt, ...(published ? { published, publishedAt: new Date() } : {}), version: { increment: 1 } }, include });
    await audit(tx, req.auth!.userId, "PLAYER_STATS_UPDATED", "Match", id, match, saved);
    return saved;
  }));
}));
router.delete("/:id", requireAdmin, asyncRoute(async (req, res) => {
 const id = z.string().cuid().parse(req.params.id);
 await inTransaction(async tx => {
  const match = await tx.match.findUnique({ where: { id }, include: { gameweek: true } });
  if (!match) throw new ApiError(404, "MATCH_NOT_FOUND");
  if (match.publishedAt || match.reportedResult || match.gameweek.status === "COMPLETED") throw new ApiError(409, "MATCH_LOCKED");
  await audit(tx, req.auth!.userId, "PLAYER_STATS_UPDATED", "Match", id, match, { deleted: true });
  await tx.match.delete({ where: { id } });
 });
 res.json({ ok: true });
}));
export default router;
