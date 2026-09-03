import type { Club, ClubSupport, FantasyTeam, League, LeagueMember, MemberDetail, Player, PlayerRole, Profile, SquadStatus, User } from "../types";
import { getStoredLocale, type Locale } from "../contexts/LocaleContext";

// In production the Vercel function is served by the same origin. The localhost
// fallback is intentionally development-only, so a deployed client never calls a
// visitor's own computer.
const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:4000/api" : "/api");
const SERVER_URL = API_URL.startsWith("/") ? "" : API_URL.replace(/\/api\/?$/, "");
const tokenKey = "fantasy-futsal-token";
export const authRequiredEvent = "fantasy-futsal-auth-required";

export const authToken = {
  get: () => localStorage.getItem(tokenKey),
  set: (token: string) => localStorage.setItem(tokenKey, token),
  clear: () => localStorage.removeItem(tokenKey),
};

export function imageUrl(path: string | null | undefined) {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  if (path.startsWith("/logo/")) return encodeURI(path);
  return encodeURI(`${SERVER_URL}${path}`);
}

export function formatEuro(value: number, locale: Locale = getStoredLocale()) {
  return new Intl.NumberFormat(locale === "uk" ? "uk-UA" : "es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}

export function roleLabel(role: PlayerRole, locale: Locale = getStoredLocale()) {
  if (locale === "uk") {
    return {
      PORTERA: "Воротарка",
      CIERRE: "Захисниця",
      ALA: "Фланг",
      PIVOT: "Стовп",
    }[role];
  }
  return {
    PORTERA: "Portera",
    CIERRE: "Cierre",
    ALA: "Ala",
    PIVOT: "Pívot",
  }[role];
}

export function nationalityLabel(code: string | null | undefined, locale: Locale = getStoredLocale()) {
  if (!code) return undefined;
  const labels = locale === "uk"
    ? {
        ES: "Іспанія",
        BR: "Бразилія",
        UY: "Уругвай",
        PT: "Португалія",
        AR: "Аргентина",
        IT: "Італія",
        FI: "Фінляндія",
        UA: "Україна",
      }
    : {
        ES: "España",
        BR: "Brasil",
        UY: "Uruguay",
        PT: "Portugal",
        AR: "Argentina",
        IT: "Italia",
        FI: "Finlandia",
        UA: "Ucrania",
      };
  return labels[code as keyof typeof labels] ?? code;
}

export function playerFactsLabel(player: Pick<Player, "age" | "nationality">, locale: Locale = getStoredLocale()) {
  return [
    player.age ? locale === "uk" ? `${player.age} років` : `${player.age} años` : null,
    nationalityLabel(player.nationality, locale),
  ].filter(Boolean).join(" · ");
}

export function playerSummaryLabel(player: Pick<Player, "role" | "age" | "nationality">, locale: Locale = getStoredLocale()) {
  return [roleLabel(player.role, locale), playerFactsLabel(player, locale)].filter(Boolean).join(" · ");
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = authToken.get();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  headers.set("Accept-Language", getStoredLocale());
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && token) {
    authToken.clear();
    window.dispatchEvent(new Event(authRequiredEvent));
  }
  if (!response.ok) throw new Error(data.message ?? "Что-то пошло не так. Попробуйте ещё раз.");
  return data as T;
}

export const api = {
  register: (payload: { email: string; password: string; name: string }) => request<{ token: string; user: User }>("/auth/register", { method: "POST", body: JSON.stringify(payload) }),
  login: (payload: { email: string; password: string }) => request<{ token: string; user: User }>("/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  me: () => request<{ user: User }>("/auth/me"),
  profile: () => request<Profile>("/profile"),
  updateProfile: (form: FormData) => request<Profile>("/profile", { method: "PATCH", body: form }),
  setFavoriteClub: (clubId: string | null) => request<Profile>("/profile/favorite-club", { method: "PATCH", body: JSON.stringify({ clubId }) }),
  clubs: () => request<Club[]>("/clubs"),
  club: (id: string) => request<Club>(`/clubs/${id}`),
  clubPlayers: (id: string) => request<Player[]>(`/clubs/${id}/players`),
  players: (filters: { clubId?: string; role?: string; search?: string }) => {
    const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value) as [string, string][]);
    return request<Player[]>(`/players${params.size ? `?${params}` : ""}`);
  },
  team: () => request<FantasyTeam>("/my-team"),
  addPlayer: (playerId: string) => request<FantasyTeam>("/my-team/players", { method: "POST", body: JSON.stringify({ playerId }) }),
  removePlayer: (playerId: string) => request<FantasyTeam>(`/my-team/players/${playerId}`, { method: "DELETE" }),
  setStatus: (playerId: string, status: SquadStatus) => request<FantasyTeam>(`/my-team/players/${playerId}`, { method: "PATCH", body: JSON.stringify({ status }) }),
  saveLineup: (players: Array<{ playerId: string; status: SquadStatus }>) => request<FantasyTeam>("/my-team/lineup", { method: "PATCH", body: JSON.stringify({ players }) }),
  setCaptain: (playerId: string) => request<FantasyTeam>("/my-team/captain", { method: "PATCH", body: JSON.stringify({ playerId }) }),
  league: () => request<League>("/league"),
  members: () => request<LeagueMember[]>("/league/members"),
  supporters: () => request<ClubSupport[]>("/league/supporters"),
  member: (id: string) => request<MemberDetail>(`/league/members/${id}`),
};
