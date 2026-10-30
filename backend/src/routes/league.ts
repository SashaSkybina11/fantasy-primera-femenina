import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { teamInclude, withTeamDisplayNumbers } from "../services/team.js";
import { asyncRoute, ApiError } from "../utils/http.js";
import { protocolSchema } from "../services/match-protocol.js";

const router = Router();
const mainLeagueName = "Fantasy Primera División Fútbol Sala Femenino";

router.use(authenticate);

router.get("/", asyncRoute(async (_request, response) => {
  const league = await prisma.league.findUnique({
    where: { name: mainLeagueName },
    include: { _count: { select: { members: { where: { user: { role: "USER" } } } } } },
  });
  if (!league) throw new ApiError(404, "Лига не найдена");
  response.json(league);
}));

router.get("/members", asyncRoute(async (_request, response) => {
  const league = await prisma.league.findUnique({ where: { name: mainLeagueName } });
  if (!league) throw new ApiError(404, "Лига не найдена");
  const members = await prisma.leagueMember.findMany({
    where: { leagueId: league.id, user: { role: "USER" } },
    include: {
      user: { select: { id: true, name: true, avatarUrl: true, fantasyTeam: { select: { id: true, name: true, _count: { select: { players: true } } } } } },
    },
    orderBy: { createdAt: "asc" },
  });
  response.json(members.map((member) => member.user));
}));

router.get("/supporters", asyncRoute(async (_request, response) => {
  const clubs = await prisma.club.findMany({
    select: { id: true, name: true, logoUrl: true, _count: { select: { supporters: { where: { role: "USER" } } } } },
    orderBy: { name: "asc" },
  });
  response.json(clubs.map((club) => ({ id: club.id, name: club.name, logoUrl: club.logoUrl, count: club._count.supporters })).filter((club) => club.count > 0));
}));

router.get("/standings", asyncRoute(async (_request, response) => {
  // User-provided official table after five completed gameweeks. New published
  // results from gameweek six onward are added to these opening totals.
  const openingTable: Record<string, { played: number; wins: number; draws: number; losses: number; goalsFor: number; goalsAgainst: number; points: number }> = {
    "Melilla CD Torreblanca": { played: 5, wins: 5, draws: 0, losses: 0, goalsFor: 18, goalsAgainst: 8, points: 15 },
    "FSF Castro Bloques Cando": { played: 5, wins: 4, draws: 1, losses: 0, goalsFor: 19, goalsAgainst: 7, points: 13 },
    "Futsi Atlético Navalcarnero": { played: 5, wins: 4, draws: 0, losses: 1, goalsFor: 22, goalsAgainst: 7, points: 12 },
    "STV Roldán": { played: 5, wins: 4, draws: 0, losses: 1, goalsFor: 22, goalsAgainst: 14, points: 12 },
    "Ourense Ontime": { played: 5, wins: 3, draws: 0, losses: 2, goalsFor: 13, goalsAgainst: 9, points: 9 },
    "Poio Pescamar": { played: 5, wins: 2, draws: 2, losses: 1, goalsFor: 21, goalsAgainst: 10, points: 8 },
    "Arriva AD Alcorcón": { played: 5, wins: 2, draws: 1, losses: 2, goalsFor: 13, goalsAgainst: 9, points: 7 },
    "MRB Móstoles FSF": { played: 5, wins: 2, draws: 1, losses: 2, goalsFor: 15, goalsAgainst: 20, points: 7 },
    "LBTL Futsal Alcantarilla": { played: 5, wins: 2, draws: 0, losses: 3, goalsFor: 10, goalsAgainst: 11, points: 6 },
    "Les Corts UBAE": { played: 5, wins: 2, draws: 0, losses: 3, goalsFor: 6, goalsAgainst: 9, points: 6 },
    "Rodiles FS": { played: 5, wins: 2, draws: 0, losses: 3, goalsFor: 13, goalsAgainst: 23, points: 6 },
    "Estrela Revoltosa Verín FSF": { played: 5, wins: 1, draws: 2, losses: 2, goalsFor: 7, goalsAgainst: 9, points: 5 },
    "Nueces de Ronda Atlético Torcal": { played: 5, wins: 1, draws: 1, losses: 3, goalsFor: 13, goalsAgainst: 17, points: 4 },
    "Cajasol Guadalcacin FS": { played: 5, wins: 1, draws: 0, losses: 4, goalsFor: 8, goalsAgainst: 13, points: 3 },
    "AD Ceuta FC": { played: 5, wins: 0, draws: 2, losses: 3, goalsFor: 7, goalsAgainst: 20, points: 2 },
    "Wanapix Aldelis": { played: 5, wins: 0, draws: 0, losses: 5, goalsFor: 6, goalsAgainst: 27, points: 0 },
  };
  const displayNames: Record<string, string> = { "Arriva AD Alcorcón": "Arriva AD Alcorcón FSF", "Rodiles FS": "Gaitero Rodiles FS", "Estrela Revoltosa Verín FSF": "Estrela Revoltosa Verin FSF", "Cajasol Guadalcacin FS": "Cajasol Guadalcacin", "Wanapix Aldelis": "Aldelis Zaragoza" };
  const [clubs, matches] = await Promise.all([
    prisma.club.findMany({ select: { id: true, name: true, logoUrl: true, coach: true, president: true } }),
    prisma.match.findMany({ where: { publishedAt: { not: null }, gameweek: { number: { gt: 5 } } }, include: { teams: { include: { club: { select: { id: true, name: true, logoUrl: true } } } } } }),
  ]);
  const rows = new Map(clubs.map(club => [club.id, { ...club, name: displayNames[club.name] ?? club.name, ...(openingTable[club.name] ?? { played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, points: 0 }) }]));
  for (const match of matches) {
    const protocol = protocolSchema.safeParse(match.published);
    if (!protocol.success || protocol.data.homeScore === null || protocol.data.awayScore === null) continue;
    const home = match.teams.find(team => team.side === "home");
    const away = match.teams.find(team => team.side === "away");
    if (!home || !away) continue;
    const homeRow = rows.get(home.clubId);
    const awayRow = rows.get(away.clubId);
    if (!homeRow || !awayRow) continue;
    const homeGoals = protocol.data.homeScore;
    const awayGoals = protocol.data.awayScore;
    homeRow.played += 1; awayRow.played += 1;
    homeRow.goalsFor += homeGoals; homeRow.goalsAgainst += awayGoals;
    awayRow.goalsFor += awayGoals; awayRow.goalsAgainst += homeGoals;
    if (homeGoals === awayGoals) { homeRow.draws += 1; awayRow.draws += 1; homeRow.points += 1; awayRow.points += 1; }
    else if (homeGoals > awayGoals) { homeRow.wins += 1; awayRow.losses += 1; homeRow.points += 3; }
    else { awayRow.wins += 1; homeRow.losses += 1; awayRow.points += 3; }
  }
  response.json([...rows.values()].sort((a, b) => b.points - a.points || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst) || b.goalsFor - a.goalsFor || b.wins - a.wins || a.name.localeCompare(b.name)).map((row, index) => ({ ...row, rank: index + 1 })));
}));

router.get("/members/:userId", asyncRoute(async (request, response) => {
  const userId = z.string().cuid().parse(request.params.userId);
  const membership = await prisma.leagueMember.findFirst({
    where: { userId, league: { name: mainLeagueName } },
    include: { user: { select: { id: true, name: true, avatarUrl: true, fantasyTeam: { include: teamInclude }, gameweekPoints: { where: { isFinal: true, gameweek: { status: "COMPLETED" } }, orderBy: { gameweek: { number: "desc" } }, select: { id: true, totalPoints: true, playerPoints: true, captainBonus: true, adjustmentPoints: true, breakdown: true, gameweek: { select: { id: true, number: true, name: true } } } } } } },
  });
  const fantasyTeam = membership?.user.fantasyTeam;
  if (!membership || !fantasyTeam) throw new ApiError(404, "Участник не найден в этой лиге");
  const { user } = membership;
  response.json({ id: user.id, name: user.name, avatarUrl: user.avatarUrl, fantasyTeam: await withTeamDisplayNumbers(fantasyTeam), gameweekPoints: user.gameweekPoints });
}));

export default router;
