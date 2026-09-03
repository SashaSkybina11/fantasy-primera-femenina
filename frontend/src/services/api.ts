import type { AdminUser, Club, ClubSupport, FantasyTeam, League, LeagueMember, MemberDetail, Player, PlayerRole, Profile, SquadStatus, User } from "../types";
import { getStoredLocale, type Locale } from "../contexts/LocaleContext";

// In production the Vercel function is served by the same origin. The localhost
// fallback is intentionally development-only, so a deployed client never calls a
// visitor's own computer.
const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:4000/api" : "/api");
const SERVER_URL = API_URL.startsWith("/") ? "" : API_URL.replace(/\/api\/?$/, "");
const tokenKey = "fantasy-futsal-token";
export const authRequiredEvent = "fantasy-futsal-auth-required";

const apiMessages: Record<string, { es: string; uk: string }> = {
  "Fantasy-команда не найдена": { es: "No se encontró el equipo fantasy", uk: "Fantasy-команду не знайдено" },
  "Состав уже заполнен": { es: "La plantilla ya está completa", uk: "Склад уже заповнено" },
  "Игрок уже выбран": { es: "La jugadora ya está elegida", uk: "Гравчиню вже обрано" },
  "Игрок не найден": { es: "No se encontró a la jugadora", uk: "Гравчиню не знайдено" },
  "Недостаточно бюджета для этого игрока": { es: "No hay presupuesto suficiente para esta jugadora", uk: "Недостатньо бюджету для цієї гравчині" },
  "Максимум 2 игрока из одной команды": { es: "Máximo 2 jugadoras del mismo club", uk: "Максимум 2 гравчині з одного клубу" },
  "Этот игрок не состоит в вашей команде": { es: "Esta jugadora no está en tu equipo", uk: "Ця гравчиня не у вашій команді" },
  "В основном составе уже 5 игроков": { es: "Ya hay 5 jugadoras en el quinteto titular", uk: "В основному складі вже 5 гравчинь" },
  "В составе есть повторяющиеся игроки": { es: "La plantilla contiene jugadoras repetidas", uk: "У складі є повторювані гравчині" },
  "Можно сохранять только игроков из своей команды": { es: "Solo puedes guardar jugadoras de tu equipo", uk: "Можна зберігати лише гравчинь зі своєї команди" },
  "Капитан должен быть в основном составе": { es: "La capitana debe estar en el quinteto titular", uk: "Капітанка має бути в основному складі" },
  "Бюджет не может быть отрицательным": { es: "El presupuesto no puede ser negativo", uk: "Бюджет не може бути від’ємним" },
  "Нужно выбрать ровно 10 игроков": { es: "Debes elegir exactamente 10 jugadoras", uk: "Потрібно обрати рівно 10 гравчинь" },
  "В основном составе должно быть ровно 5 игроков": { es: "El quinteto titular debe tener exactamente 5 jugadoras", uk: "В основному складі має бути рівно 5 гравчинь" },
  "На скамейке должно быть ровно 5 игроков": { es: "Las suplentes deben ser exactamente 5", uk: "У запасі має бути рівно 5 гравчинь" },
  "В основном составе должен быть ровно один вратарь": { es: "El quinteto titular debe tener exactamente una portera", uk: "В основному складі має бути рівно одна воротарка" },
  "В основном составе должны быть четыре полевых игрока": { es: "El quinteto titular debe tener cuatro jugadoras de campo", uk: "В основному складі мають бути чотири польові гравчині" },
  "Выберите одного капитана из основного состава": { es: "Elige una capitana del quinteto titular", uk: "Оберіть одну капітанку з основного складу" },
  "Не удалось завершить операцию с составом": { es: "No se pudo completar la operación de plantilla", uk: "Не вдалося завершити операцію зі складом" },
  "Лига не найдена": { es: "No se encontró la liga", uk: "Лігу не знайдено" },
  "Участник не найден в этой лиге": { es: "No se encontró a la participante en esta liga", uk: "Учасницю не знайдено в цій лізі" },
  "Команда не найдена": { es: "No se encontró el club", uk: "Клуб не знайдено" },
  "Профиль не найден": { es: "No se encontró el perfil", uk: "Профіль не знайдено" },
  "Нет изменений для сохранения": { es: "No hay cambios para guardar", uk: "Немає змін для збереження" },
  "Требуется авторизация": { es: "Debes iniciar sesión", uk: "Потрібно увійти в акаунт" },
  "Сессия истекла. Войдите снова.": { es: "La sesión ha caducado. Inicia sesión de nuevo.", uk: "Сесія завершилася. Увійдіть знову." },
  "Неверный email или пароль": { es: "El correo o la contraseña no son correctos", uk: "Неправильна електронна пошта або пароль" },
  "Пользователь с таким email уже зарегистрирован": { es: "Ya existe una cuenta con este correo", uk: "Акаунт із цією електронною поштою вже існує" },
  "Такая запись уже существует": { es: "Este registro ya existe", uk: "Такий запис уже існує" },
  "Внутренняя ошибка сервера": { es: "Error interno del servidor", uk: "Внутрішня помилка сервера" },
  "Некорректные данные": { es: "Datos no válidos", uk: "Некоректні дані" },
  "Введите имя": { es: "Introduce un nombre", uk: "Введіть ім’я" },
  "Введите название команды": { es: "Introduce un nombre para el equipo", uk: "Введіть назву команди" },
  "Invalid cuid": { es: "Datos no válidos", uk: "Некоректні дані" },
  "Для загрузки аватаров в production настройте BLOB_READ_WRITE_TOKEN": { es: "Configura BLOB_READ_WRITE_TOKEN para subir avatares", uk: "Налаштуйте BLOB_READ_WRITE_TOKEN для завантаження аватарів" },
};

function localizedApiMessage(message: string | undefined) {
  const locale = getStoredLocale();
  if (!message) return locale === "uk" ? "Щось пішло не так. Спробуйте ще раз." : "Algo salió mal. Inténtalo de nuevo.";
  return apiMessages[message]?.[locale] ?? message;
}

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
  if (!response.ok) throw new Error(localizedApiMessage(data.message));
  return data as T;
}

export const api = {
  register: (payload: { email: string; password: string; name: string }) => request<{ token: string; user: User }>("/auth/register", { method: "POST", body: JSON.stringify(payload) }),
  login: (payload: { email: string; password: string }) => request<{ token: string; user: User }>("/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  me: () => request<{ user: User }>("/auth/me"),
  profile: () => request<Profile>("/profile"),
  updateProfile: (form: FormData) => request<Profile>("/profile", { method: "PATCH", body: form }),
  updatePassword: (payload: { currentPassword: string; newPassword: string }) => request<void>("/profile/password", { method: "PATCH", body: JSON.stringify(payload) }),
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
  adminUsers: () => request<AdminUser[]>("/admin/users"),
  deleteAdminUser: (id: string) => request<void>(`/admin/users/${id}`, { method: "DELETE" }),
};
