import test from 'node:test';
import assert from 'node:assert/strict';
import { getPlayerPopularity } from '../dist/services/player-popularity.js';

function fixture(total, owners) {
  return {
    fantasyTeam: { count: async query => {
      assert.deepEqual(query, { where: { players: { some: {} } } });
      return total;
    } },
    fantasyTeamPlayer: { groupBy: async query => {
      assert.deepEqual(query.orderBy, [{ _count: { playerId: 'desc' } }, { playerId: 'asc' }]);
      assert.equal(query.take, 1);
      return owners;
    } },
    player: { findUnique: async ({where}) => ({ id: where.id, name: 'Bea Parrón', number: 18, club: {id:'club', name:'Futsi'} }) },
  };
}
test('popularity returns a safe empty state without squads', async () => {
  assert.deepEqual(await getPlayerPopularity(fixture(0, [])), { player: null, ownerCount: 0, totalUsers: 0, percentage: 0 });
});
test('popularity rounds 8 of 23 owners to 35 percent and returns player details', async () => {
  const result = await getPlayerPopularity(fixture(23, [{playerId:'a', _count:{playerId:8}}]));
  assert.equal(result.percentage, 35);
  assert.equal(result.ownerCount, 8);
  assert.equal(result.player.number, 18);
  assert.equal(result.player.id, 'a');
});
test('popularity recomputes after ownership changes', async () => {
  const before = await getPlayerPopularity(fixture(2, [{playerId:'a', _count:{playerId:1}}]));
  const after = await getPlayerPopularity(fixture(2, [{playerId:'a', _count:{playerId:2}}]));
  assert.equal(before.percentage, 50);
  assert.equal(after.percentage, 100);
});
