import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { once } from 'node:events';

const url = new URL(process.env.DATABASE_URL!);
assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
const setup = new PrismaClient();
// A fresh, isolated database; never reset the application database.
const database = `fantasy_consistency_${Date.now()}`;
await setup.$executeRawUnsafe(`CREATE DATABASE "${database}"`);
await setup.$disconnect();
url.pathname = '/' + database;
process.env.DATABASE_URL = url.toString();
const migration = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy', '--schema', 'backend/prisma/schema.prisma'], { env: process.env, encoding: 'utf8' });
assert.equal(migration.status, 0, migration.stderr);
const { prisma } = await import('../src/lib/prisma.js');
const { inTransaction } = await import('../src/lib/transaction.js');
const { recalculateGameweek, snapshotGameweek } = await import('../src/services/gameweeks.js');
const { getPlayerPopularity } = await import('../src/services/player-popularity.js');
const { app } = await import('../src/app.js');
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
const port = (server.address() as { port: number }).port;
const request = async (path: string, userId: string, method = 'GET', body?: unknown) => {
  const token = jwt.sign({}, process.env.JWT_SECRET!, { subject: userId });
  const response = await fetch(`http://127.0.0.1:${port}/api${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, data: await response.json() };
};
try {
  const clubs = await Promise.all(Array.from({ length: 5 }, (_, i) => prisma.club.create({ data: { name: `Club ${i}` } })));
  const players = await Promise.all(Array.from({ length: 11 }, (_, i) => prisma.player.create({ data: { clubId: clubs[i % 5]!.id, name: `Player ${i}`, number: i, position: i === 0 || i === 5 ? 'GOALKEEPER' : 'FIELD_PLAYER', role: i === 0 || i === 5 ? 'PORTERA' : 'ALA', price: 4000 } })));
  const users = await Promise.all(['USER', 'USER', 'ADMIN'].map((role, i) => prisma.user.create({ data: { email: `u${i}@example.invalid`, passwordHash: 'unused', name: `User ${i}`, role: role as 'USER' | 'ADMIN', fantasyTeam: { create: { name: `Squad ${i}`, players: { create: players.slice(0, 10).map((p, j) => ({ playerId: p.id, status: j < 5 ? 'STARTER' : 'BENCH', isCaptain: j === 0, createdAt: new Date('2026-01-01') })) } } } }, include: { fantasyTeam: true } })));
  const week = await prisma.gameweek.create({ data: { number: 1, name: 'J1', status: 'LOCKED', startsAt: new Date('2026-09-04'), endsAt: new Date('2026-09-06'), marketOpenAt: new Date('2026-09-01'), deadlineAt: new Date('2026-09-04') } });
  await inTransaction(tx => snapshotGameweek(tx, week.id));
  for (const [i, points] of [8, 4, -1, 6, 3].entries()) await prisma.playerGameweekStats.create({ data: { gameweekId: week.id, playerId: players[i]!.id, adjustmentPoints: points } });
  await prisma.userPointAdjustment.create({ data: { gameweekId: week.id, userId: users[0]!.id, adminId: users[2]!.id, points: 2, reason: 'Preserve adjustment' } });
  await prisma.gameweek.update({ where: { id: week.id }, data: { status: 'COMPLETED' } });
  await inTransaction(tx => recalculateGameweek(tx, week.id));
  const totals = () => prisma.userGameweekPoints.findMany({ where: { gameweekId: week.id }, orderBy: { userId: 'asc' }, select: { userId: true, totalPoints: true, adjustmentPoints: true, rank: true, breakdown: true } });
  const first = await totals();
  assert.equal(first.find(r => r.userId === users[0]!.id)!.totalPoints, 22);
  assert.equal(first.find(r => r.userId === users[1]!.id)!.totalPoints, 20);
  assert.equal(first.find(r => r.userId === users[2]!.id)!.rank, null);
  await inTransaction(tx => recalculateGameweek(tx, week.id));
  assert.deepEqual(await totals(), first);
  assert.equal(await prisma.playerPriceChange.count(), 11);
  // The live squad changes; old-week totals must continue using the frozen squad.
  await prisma.fantasyTeamPlayer.update({ where: { fantasyTeamId_playerId: { fantasyTeamId: users[0]!.fantasyTeam!.id, playerId: players[1]!.id } }, data: { playerId: players[10]!.id } });
  await inTransaction(tx => recalculateGameweek(tx, week.id));
  assert.deepEqual(await totals(), first);
  await prisma.playerGameweekStats.update({ where: { gameweekId_playerId: { gameweekId: week.id, playerId: players[1]!.id } }, data: { goals: 1 } });
  await inTransaction(tx => recalculateGameweek(tx, week.id));
  assert.equal((await prisma.player.findUniqueOrThrow({ where: { id: players[1]!.id } })).price, 4100);
  const later = await prisma.gameweek.create({ data: { number: 2, name: 'J2', status: 'COMPLETED', startsAt: new Date('2026-09-11'), endsAt: new Date('2026-09-13'), marketOpenAt: new Date('2026-09-08'), deadlineAt: new Date('2026-09-11') } });
  await prisma.playerGameweekStats.create({ data: { gameweekId: later.id, playerId: players[1]!.id, goals: 1 } });
  await inTransaction(tx => recalculateGameweek(tx, later.id));
  await prisma.playerGameweekStats.update({ where: { gameweekId_playerId: { gameweekId: week.id, playerId: players[1]!.id } }, data: { goals: 2 } });
  await inTransaction(tx => recalculateGameweek(tx, week.id));
  const history = await prisma.playerPriceChange.findMany({ where: { playerId: players[1]!.id }, orderBy: { gameweek: { number: 'asc' } } });
  assert.deepEqual(history.map(r => [r.priceBefore, r.priceDelta, r.priceAfter]), [[4000,200,4200],[4200,100,4300]]);
  assert.equal(history[0]!.goalsPriceDelta, 200);
  assert.equal(history[0]!.starterPriceDelta, 0);
  assert.equal(history[0]!.teamResultPriceDelta, 0);
  assert.equal(history[0]!.yellowCardsPriceDelta, 0);
  assert.equal(history[0]!.redCardsPriceDelta, 0);
  assert.equal(history[0]!.goalkeeperPriceDelta, 0);
  await assert.rejects(prisma.playerPriceChange.create({ data: { ...history[0]!, id: undefined } }));
  assert.equal((await prisma.player.findUniqueOrThrow({ where: { id: players[1]!.id } })).price, 4300);
  const corrected = await totals();
  assert.equal(corrected.find(r => r.userId === users[0]!.id)!.totalPoints, 32);
  assert.equal(corrected.find(r => r.userId === users[1]!.id)!.totalPoints, 30);
  const league = await prisma.privateLeague.create({ data: { name: 'Friends', inviteCode: 'TEST123', ownerId: users[0]!.id, members: { create: users.map(u => ({ userId: u.id })) } } });
  const general = (await request('/gameweeks/leaderboard', users[0]!.id)).data;
  const friends = (await request('/private-leagues/' + league.id, users[0]!.id)).data.members;
  assert.equal(general.length, 2); assert.equal(friends.length, 2);
  assert.ok(general.every((r: any) => r.id !== users[2]!.id));
  assert.ok(friends.every((r: any) => r.id !== users[2]!.id));
  const weekly = await request('/gameweeks/' + week.id + '/leaderboard', users[0]!.id);
  assert.equal(weekly.status, 200); assert.equal(weekly.data.length, 2);
  assert.ok(weekly.data.every((r: any) => r.userId !== users[2]!.id));
  const mainLeague = await prisma.league.create({ data: { name: 'Fantasy Primera División Fútbol Sala Femenino', members: { create: users.map(u => ({ userId: u.id })) } } });
  const members = await request('/league/members', users[0]!.id);
  assert.equal(members.status, 200); assert.equal(members.data.length, 2);
  assert.ok(members.data.every((r: any) => r.id !== users[2]!.id));
  assert.equal((await request('/league', users[0]!.id)).data._count.members, 2);
  for (const row of general) assert.equal(friends.find((f: any) => f.id === row.id).points, row.totalPoints);
  assert.equal(await prisma.gameweekWinner.count({ where: { userId: users[2]!.id } }), 0);
  const popularity = await getPlayerPopularity(prisma);
  assert.equal(popularity.totalUsers, 2);
  assert.equal(popularity.ownerCount, 2);
  assert.equal(popularity.percentage, 100);
  // synchronizeGameweeks must not overwrite completed weeks or reopen the market.
  const userSell = await request('/my-team/players/' + players[2]!.id, users[0]!.id, 'DELETE');
  assert.equal(userSell.status, 423);
  const adminSell = await request('/my-team/players/' + players[2]!.id, users[2]!.id, 'DELETE');
  assert.equal(adminSell.status, 200, JSON.stringify(adminSell));
  const adminBuy = await request('/my-team/players', users[2]!.id, 'POST', { playerId: players[2]!.id });
  assert.equal(adminBuy.status, 201, JSON.stringify(adminBuy));
  // All guarded routes: sale/removal share DELETE, individual and full lineup,
  // captain and purchase. ADMIN bypasses only the window/transfer quota.
  const adminId = users[2]!.id;
  const userId = users[0]!.id;
  const lineup = { players: players.slice(0, 10).map((p, i) => ({ playerId: p.id, status: i < 5 ? 'STARTER' : 'BENCH' })) };
  for (const [path, method, body, expected] of [
    ['/my-team/players', 'POST', { playerId: players[2]!.id }, 423],
    ['/my-team/players/' + players[2]!.id, 'PATCH', { status: 'BENCH' }, 409],
    ['/my-team/lineup', 'PATCH', lineup, 409],
    ['/my-team/captain', 'PATCH', { playerId: players[0]!.id }, 409],
  ] as const) assert.equal((await request(path, userId, method, body)).status, expected, path);
  for (const status of ['STARTER', 'BENCH', 'STARTER']) {
    const result = await request('/my-team/players/' + players[2]!.id, adminId, 'PATCH', { status });
    assert.equal(result.status, 200, JSON.stringify(result));
    assert.equal(result.data.players.find((p: any) => p.playerId === players[2]!.id).status, status);
  }
  const saved = await request('/my-team/lineup', adminId, 'PATCH', lineup);
  assert.equal(saved.status, 200, JSON.stringify(saved));
  assert.equal((await request('/my-team/captain', adminId, 'PATCH', { playerId: players[1]!.id })).status, 200);
  for (let i = 0; i < 3; i++) {
    assert.equal((await request('/my-team/players/' + players[2]!.id, adminId, 'DELETE')).status, 200);
    assert.equal((await request('/my-team/players', adminId, 'POST', { playerId: players[2]!.id })).status, 201);
  }
  assert.equal((await request('/my-team/transfers', userId)).data.marketIsOpen, false);
  assert.equal((await request('/my-team/transfers', adminId)).data.marketIsOpen, true);
  assert.equal((await request('/gameweeks/current', userId)).data.marketIsOpen, false);
  assert.equal((await request('/gameweeks/current', adminId)).data.marketIsOpen, true);
  const beforeRollback = await totals();
  await assert.rejects(inTransaction(async tx => { await recalculateGameweek(tx, week.id); throw new Error('rollback'); }), /rollback/);
  assert.deepEqual(await totals(), beforeRollback);
  console.log('PASS: migrations, signed totals, adjustments, repeat recalculation, snapshots, price correction/rebase, standings, admin market, popularity, rollback');
  console.log('Isolated test database retained:', database);
} finally {
  server.close();
  await prisma.$disconnect();
}
