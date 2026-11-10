import type { Club, Gameweek, Player } from "./index";
export type MatchRow = { playerId: string; started: boolean; goals: number; yellowCards: number; redCards: number; goalsConceded: number | null; name?: string; number?: number; clubId?: string; position?: string; totalPoints?: number; calculatedPoints?: number; adjustmentPoints?: number; result?: string };
export type MatchProtocol = { homeScore: number | null; awayScore: number | null; homeOwnGoals: number; awayOwnGoals: number; players: MatchRow[] };
export type MatchRecord = { id: string; gameweekId: string; gameweek: Gameweek; kickoffAt: string | null; publishedAt: string | null; reportedResult?: { homeScore: number; awayScore: number; date: string } | null; published: MatchProtocol | null; draft?: MatchProtocol | null; version: number; teams: Array<{ side: string; clubId: string; club: Club }> };
export type MatchEditorData = { match: MatchRecord; protocol: MatchProtocol; previousStarters: Record<string, string[]>; roster: Array<Player & { gameweekStats: Array<{ adjustmentPoints: number }> }> };
export type PostponedSnapshotData = {
  match: { id: string; gameweekId: string; gameweekNumber: number; kickoffAt: string | null; marketIsOpen: boolean; publishedAt: string | null; teams: Array<{ clubId: string; club: string }> };
  snapshot: null | { id: string | null; frozenAt: string | null; frozenBy: string | null; settled: boolean; participantCount: number; participants: Array<{ userId: string; name: string; totalPoints: number; settled: boolean; players: Array<{ playerId: string; name: string; number: number; clubId: string; club: string; isCaptain: boolean; points: number | null }> }> };
};
