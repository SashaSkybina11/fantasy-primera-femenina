import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildScorers } from '../dist/services/scorers.js';
import { scorerSnapshot } from '../dist/data/scorers.js';
import { scorerAliases } from '../dist/data/scorer-aliases.js';

test('all 87 official totals match club-scoped roster aliases without changing fantasy stats', () => {
  const players = scorerSnapshot.map(([name, club], i) => ({
    id: String(i), name: scorerAliases[name], club: { id: club, name: club },
    gameweekStats: [{ goals: 99, gameweek: { number: 1 } }],
  }));
  const before = JSON.stringify(players);
  const rows = buildScorers(players, 3);
  assert.equal(rows.length, 87);
  assert.equal(new Set(rows.map(row => row.id)).size, 87);
  for (const [name, club, goals] of scorerSnapshot) {
    assert.equal(rows.find(row => row.name === name && row.club.name === club)?.goals, goals);
  }
  assert.equal(JSON.stringify(players), before);
});

test('only later rounds add goals; corrections replace totals instead of accumulating twice', () => {
  const player = { id: '1', name: 'Laura Sánchez', club: { id: 'poio', name: 'Poio Pescamar' }, gameweekStats: [
    { goals: 6, gameweek: { number: 3 } }, { goals: 2, gameweek: { number: 4 } },
  ] };
  assert.equal(buildScorers([player], 3)[0].goals, 8);
  assert.equal(buildScorers([player], 3)[0].goals, 8);
  player.gameweekStats[1].goals = 1;
  assert.equal(buildScorers([player], 3)[0].goals, 7);
  assert.equal(buildScorers([{ ...player, id: '2', club: { id: 'other', name: 'Other' } }], 3)[0].goals, 1);
});

test('players without historical goals can enter the ranking in later rounds', () => {
  const player = { id: 'new', name: 'New player', club: { name: 'Poio Pescamar' }, gameweekStats: [
    { goals: 4, gameweek: { number: 1 } }, { goals: 1, gameweek: { number: 4 } },
  ] };
  assert.equal(buildScorers([player], 3)[0].goals, 1);
});
