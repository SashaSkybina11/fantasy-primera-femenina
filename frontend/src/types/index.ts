export type Position = "GOALKEEPER" | "FIELD_PLAYER";
export type SquadStatus = "STARTER" | "BENCH";

export type Club = {
  id: string;
  name: string;
  logoUrl: string | null;
};

export type Player = {
  id: string;
  clubId: string;
  name: string;
  number: number;
  position: Position;
  price: number;
  photoUrl: string | null;
  club?: Club;
};

export type SquadEntry = {
  id: string;
  playerId: string;
  status: SquadStatus;
  isCaptain: boolean;
  player: Player & { club: Club };
};

export type FantasyTeam = {
  id: string;
  name: string;
  budget: number;
  user?: { id: string; name: string; avatarUrl: string | null };
  players: SquadEntry[];
};

export type User = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
};

export type Profile = User & { fantasyTeam: Pick<FantasyTeam, "id" | "name" | "budget"> };

export type League = {
  id: string;
  name: string;
  inviteCode: string | null;
  _count: { members: number };
};

export type LeagueMember = Pick<User, "id" | "name" | "avatarUrl"> & {
  fantasyTeam: { id: string; name: string; _count: { players: number } } | null;
};

export type MemberDetail = Pick<User, "id" | "name" | "avatarUrl"> & { fantasyTeam: FantasyTeam };

