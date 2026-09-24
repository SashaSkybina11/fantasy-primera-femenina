import type { Club } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { normalizeScorerName, scorerSnapshot } from '../data/scorers.js';
import { scorerAliases } from '../data/scorer-aliases.js';

// Administrator confirmed the cumulative snapshot includes rounds 1–3.
export const snapshotThroughGameweek = 3;

type ScorerPlayer = {
  id: string; name: string; club: Club;
  gameweekStats: Array<{ goals: number; gameweek: { number: number } }>;
};

export function buildScorers(players: ScorerPlayer[], throughGameweek: number = snapshotThroughGameweek) {
  return players.map(player => {
    const snapshot = scorerSnapshot.find(([name, club]) => club === player.club.name &&
      [name, scorerAliases[name]].some(alias => alias && normalizeScorerName(alias) === normalizeScorerName(player.name)));
    const laterGoals = player.gameweekStats
      .filter(stat => stat.gameweek.number > throughGameweek)
      .reduce((sum, stat) => sum + stat.goals, 0);
    return { id: player.id, name: snapshot?.[0] ?? player.name, club: player.club, goals: (snapshot?.[2] ?? 0) + laterGoals };
  }).sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name, 'es') || a.id.localeCompare(b.id));
}

export async function getScorers(clubId?: string) {
  const players = await prisma.player.findMany({
    where: { clubId },
    include: { club: true, gameweekStats: { select: { goals: true, gameweek: { select: { number: true } } } } },
  });
  return buildScorers(players);
}
