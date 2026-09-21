import test from "node:test";
import assert from "node:assert/strict";
import { overallStandings } from "../dist/services/leaderboard.js";

const user = (id, scores) => ({ id, name: id, avatarUrl: null, fantasyTeam: null, gameweekPoints: scores.map(([number, totalPoints]) => ({ gameweek: { number }, totalPoints })) });
test("movement compares cumulative rankings, not round scores", () => {
  const rows = overallStandings([user("a", [[1, 100], [2, 0]]), user("b", [[1, 20], [2, 50]]), user("c", [[1, 90], [2, 20]])], [2, 1]);
  assert.deepEqual(rows.map(({ id, rankChange }) => [id, rankChange]), [["c", 1], ["a", -1], ["b", 0]]);
});
test("new participants have no movement; missed rounds use global boundaries", () => {
  const rows = overallStandings([user("a", [[1, 100]]), user("b", [[1, 90], [2, 20]]), user("new", [[2, 150]])], [2, 1]);
  assert.deepEqual(rows.map(({ id, rankChange }) => [id, rankChange]), [["new", null], ["b", 0], ["a", -2]]);
});
test("first round has no previous rank and ties use a stable order", () => {
  const users = [user("b", [[1, 0], [2, 0]]), user("a", [[1, 0], [2, 0]])];
  assert.deepEqual(overallStandings(users, [2, 1]).map(row => [row.id, row.rankChange]), [["a", 0], ["b", 0]]);
  assert.ok(overallStandings([user("a", [[1, 10]])], [1]).every(row => row.rankChange === null));
  assert.deepEqual(overallStandings([], []), []);
});
test("a new unscored squad cannot alter movement after a completed round", () => {
  const newcomer = { ...user("new", []), fantasyTeam: { players: Array.from({ length: 10 }, (_, index) => ({ player: { position: index < 2 ? "GOALKEEPER" : "FIELD_PLAYER" } })) } };
  const rows = overallStandings([newcomer, user("a", [[1, -10], [2, 1]])], [2, 1]);
  assert.equal(rows.find(row => row.id === "a").rankChange, 0);
  assert.equal(rows.find(row => row.id === "new").rankChange, null);
});
