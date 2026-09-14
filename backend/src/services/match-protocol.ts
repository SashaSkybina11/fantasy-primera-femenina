import { z } from "zod";
import { ApiError } from "../utils/http.js";

export const protocolSchema = z.object({
  homeScore: z.number().int().min(0).max(99).nullable(),
  awayScore: z.number().int().min(0).max(99).nullable(),
  homeOwnGoals: z.number().int().min(0).max(99).default(0),
  awayOwnGoals: z.number().int().min(0).max(99).default(0),
  players: z.array(z.object({
    playerId: z.string().cuid(), started: z.boolean(), goals: z.number().int().min(0).max(99),
    yellowCards: z.number().int().min(0).max(2), redCards: z.number().int().min(0).max(1),
    goalsConceded: z.number().int().min(0).max(99).nullable(),
  })).max(100),
});
export type Protocol = z.infer<typeof protocolSchema>;
export function validateProtocol(input: Protocol, roster: Array<{ id: string; clubId: string; position: string }>, homeId: string, awayId: string, publish: boolean) {
  const ids = new Set(input.players.map(p => p.playerId));
  if (ids.size !== input.players.length || ids.size !== roster.length || roster.some(p => !ids.has(p.id))) throw new ApiError(400, "MATCH_ROSTER");
  for (const clubId of [homeId, awayId]) {
    const team = input.players.filter(row => roster.some(p => p.id === row.playerId && p.clubId === clubId));
    const starters = team.filter(p => p.started);
    const keepers = starters.filter(row => roster.find(p => p.id === row.playerId)?.position === "GOALKEEPER");
    if (starters.length > 5 || keepers.length > 1 || (publish && (starters.length !== 5 || keepers.length !== 1))) throw new ApiError(400, "MATCH_STARTERS");
    if (publish) {
      const score = clubId === homeId ? input.homeScore : input.awayScore;
      const ownGoals = clubId === homeId ? input.awayOwnGoals : input.homeOwnGoals;
      if (score === null || team.reduce((sum, p) => sum + p.goals, 0) + ownGoals !== score) throw new ApiError(400, "MATCH_SCORE");
    }
  }
  if (input.players.some(row => row.goalsConceded !== null && roster.find(p => p.id === row.playerId)?.position !== "GOALKEEPER")) throw new ApiError(400, "INVALID_GOALKEEPER_STATS");
}
