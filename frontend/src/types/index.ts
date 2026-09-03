export type Position = "GOALKEEPER" | "FIELD_PLAYER";
export type PlayerRole = "PORTERA" | "CIERRE" | "ALA" | "PIVOT";
export type SquadStatus = "STARTER" | "BENCH";

export type Club = {
  id: string;
  name: string;
  logoUrl: string | null;
  coach: string | null;
  president: string | null;
};

export type Player = {
  id: string;
  clubId: string;
  name: string;
  number: number;
  displayNumber?: string;
  position: Position;
  role: PlayerRole;
  price: number;
  age: number | null;
  nationality: string | null;
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
  favoriteClub: Pick<Club, "id" | "name" | "logoUrl"> | null;
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

export type ClubSupport = Pick<Club, "id" | "name" | "logoUrl"> & { count: number };

export type MemberDetail = Pick<User, "id" | "name" | "avatarUrl"> & { fantasyTeam: FantasyTeam };
