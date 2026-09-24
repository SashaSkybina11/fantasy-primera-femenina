import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import assert from 'node:assert/strict';

// Import confirmed scores only. Never publish protocols or recalculate player data.
const fixtures = JSON.parse(readFileSync(new URL('../data/results-jornada-1-2.json', import.meta.url), 'utf8')) as Array<{
  week: number; home: string; away: string; homeScore: number; awayScore: number; date: string; kickoffAt: string;
}>;
const prisma = new PrismaClient();
try {
  const results = await prisma.$transaction(async tx => {
    const clubs = await tx.club.findMany();
    const weeks = await tx.gameweek.findMany({ where: { number: { in: [1, 2] } } });
    const snapshot = async () => JSON.stringify({
      stats: await tx.playerGameweekStats.findMany({ orderBy: { id: 'asc' } }),
      points: await tx.userGameweekPoints.findMany({ orderBy: { id: 'asc' } }),
      prices: await tx.player.findMany({ select: { id: true, price: true }, orderBy: { id: 'asc' } }),
      priceHistory: await tx.playerPriceChange.findMany({ orderBy: { id: 'asc' } }),
      teams: await tx.fantasyTeam.findMany({ orderBy: { id: 'asc' } }),
    });
    const before = await snapshot();
    const saved = [];
    for (const fixture of fixtures) {
      const week = weeks.find(w => w.number === fixture.week);
      const home = clubs.find(c => c.name === fixture.home);
      const away = clubs.find(c => c.name === fixture.away);
      assert.ok(week && home && away, `Missing week or club: ${JSON.stringify(fixture)}`);
      const existing = await tx.match.findMany({ where: { gameweekId: week.id, teams: { some: { clubId: { in: [home.id, away.id] } } } }, include: { teams: true } });
      assert.ok(existing.length <= 1, 'Conflicting fixtures: manual reconciliation required');
      const match = existing[0];
      if (match) {
        assert.ok(match.teams.some(t => t.side === 'home' && t.clubId === home.id) && match.teams.some(t => t.side === 'away' && t.clubId === away.id), 'Conflicting home/away pairing');
        if (match.published) {
          const published = match.published as { homeScore: number; awayScore: number };
          assert.equal(published.homeScore, fixture.homeScore, 'Published score differs; preserving protocol');
          assert.equal(published.awayScore, fixture.awayScore, 'Published score differs; preserving protocol');
        }
      }
      const reportedResult = { homeScore: fixture.homeScore, awayScore: fixture.awayScore, date: fixture.date };
      if (match) await tx.match.update({ where: { id: match.id }, data: { reportedResult, kickoffAt: new Date(fixture.kickoffAt), version: { increment: 1 } } });
      else await tx.match.create({ data: { gameweekId: week.id, reportedResult, kickoffAt: new Date(fixture.kickoffAt), teams: { create: [
        { gameweekId: week.id, clubId: home.id, side: 'home' },
        { gameweekId: week.id, clubId: away.id, side: 'away' },
      ] } } });
      saved.push({ week: fixture.week, home: home.name, away: away.name, ...reportedResult });
    }
    assert.equal(await snapshot(), before, 'Player stats, fantasy points and prices must remain unchanged');
    return saved;
  }, { timeout: 30000 });
  console.log(JSON.stringify({ imported: results.length, playerDataUnchanged: true, results }, null, 2));
} finally { await prisma.$disconnect(); }
