import test from "node:test";
import assert from "node:assert/strict";
import { ensureValidLineup } from "../dist/services/team.js";
const squad = () => ({ budget: 1000, players: Array.from({ length: 10 }, (_, i) => ({ status: i < 5 ? "STARTER" : "BENCH", isCaptain: i === 0, player: { position: i === 0 || i === 5 ? "GOALKEEPER" : "FIELD_PLAYER" } })) });
test("valid lineup requires 2 goalkeepers across starters and bench", () => {
  ensureValidLineup(squad());
  const missing = squad(); missing.players[5].player.position = "FIELD_PLAYER";
  assert.throws(() => ensureValidLineup(missing), error => error.message === "SQUAD_POSITION_LIMIT");
  const extra = squad(); extra.players[9].player.position = "GOALKEEPER";
  assert.throws(() => ensureValidLineup(extra), error => error.message === "SQUAD_POSITION_LIMIT");
});
