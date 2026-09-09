import type {
  AdminUser,
  Club,
  ClubSupport,
  FantasyTeam,
  Gameweek,
  LeaderboardRow,
  League,
  LeagueMember,
  MemberDetail,
  Player,
  PlayerRole,
  PrivateLeagueDetail,
  PrivateLeagueSummary,
  Profile,
  SquadStatus,
  TransferStatus,
  User,
} from "../types";
import { getStoredLocale, type Locale } from "../contexts/LocaleContext";

// In production the Vercel function is served by the same origin. The localhost
// fallback is intentionally development-only, so a deployed client never calls a
// visitor's own computer.
const API_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? "http://localhost:4000/api" : "/api");
const SERVER_URL = API_URL.startsWith("/")
  ? ""
  : API_URL.replace(/\/api\/?$/, "");
const tokenKey = "fantasy-futsal-token";
export const authRequiredEvent = "fantasy-futsal-auth-required";

const apiMessages: Record<string, Record<Locale, string>> = {
  "Пользователь не найден": {
    "es": "No se encontró al usuario.",
    "uk": "Користувача не знайдено.",
    "en": "User not found."
  },
  "Некорректный диапазон дат тура": {
    "es": "Las fechas de la jornada no son válidas.",
    "uk": "Некоректні дати туру.",
    "en": "The gameweek dates are invalid."
  },
  "Тур или игрок не найден": {
    "es": "No se encontró la jornada o la jugadora.",
    "uk": "Тур або гравчиню не знайдено.",
    "en": "Gameweek or player not found."
  },
  "Сначала повторно откройте завершённый тур": {
    "es": "Primero vuelve a abrir la jornada finalizada.",
    "uk": "Спочатку повторно відкрийте завершений тур.",
    "en": "Reopen the completed gameweek first."
  },
  "Укажите причину корректировки": {
    "es": "Indica el motivo del ajuste.",
    "uk": "Вкажіть причину коригування.",
    "en": "Enter the reason for the adjustment."
  },
  "Тур не найден": {
    "es": "No se encontró la jornada.",
    "uk": "Тур не знайдено.",
    "en": "Gameweek not found."
  },
  "Тур не завершён": {
    "es": "La jornada todavía no ha finalizado.",
    "uk": "Тур ще не завершено.",
    "en": "The gameweek has not finished yet."
  },
  "Тур или пользователь не найден": {
    "es": "No se encontró la jornada o el usuario.",
    "uk": "Тур або користувача не знайдено.",
    "en": "Gameweek or user not found."
  },
  "Нельзя удалить собственный аккаунт администратора": {
    "es": "No puedes eliminar tu propia cuenta de administración.",
    "uk": "Не можна видалити власний обліковий запис адміністратора.",
    "en": "You cannot delete your own administrator account."
  },
  "Не удалось создать код приглашения": {
    "es": "No se pudo crear el código de invitación.",
    "uk": "Не вдалося створити код запрошення.",
    "en": "Could not create an invitation code."
  },
  "Unsupported image format": {
    "es": "El formato de imagen no es compatible.",
    "uk": "Формат зображення не підтримується.",
    "en": "Unsupported image format."
  },
  "Текущий пароль указан неверно": {
    "es": "La contraseña actual es incorrecta.",
    "uk": "Поточний пароль неправильний.",
    "en": "The current password is incorrect."
  },
  "Клуб не найден": {
    "es": "No se encontró el club.",
    "uk": "Клуб не знайдено.",
    "en": "Club not found."
  },
  "Некорректный Instagram": {
    "es": "Comprueba el nombre de Instagram.",
    "uk": "Перевірте ім’я в Instagram.",
    "en": "Check your Instagram username."
  },
  "Введите WhatsApp в международном формате": {
    "es": "Introduce WhatsApp en formato internacional.",
    "uk": "Введіть WhatsApp у міжнародному форматі.",
    "en": "Enter your WhatsApp number in international format."
  },
  "Недействительный токен": {
    "es": "Vuelve a iniciar sesión.",
    "uk": "Увійдіть знову.",
    "en": "Please sign in again."
  },
  "GAMEWEEK_NOT_LOCKED": {
    "es": "Espera al cierre de la jornada.",
    "uk": "Дочекайтеся закриття туру.",
    "en": "Wait for the gameweek to lock."
  },
  "Недостаточно прав администратора": {
    "es": "No tienes permisos de administrador.",
    "uk": "Недостатньо прав адміністратора.",
    "en": "You do not have administrator permissions."
  },
  "LINEUP_NOT_FOUND": {
    "es": "No se pudo cargar la plantilla del usuario.",
    "uk": "Не вдалося завантажити склад користувача.",
    "en": "Could not load this user's squad."
  },
  "FRIEND_LEAGUE_NOT_FOUND": {
    "es": "No se encontró la liga.",
    "uk": "Лігу не знайдено.",
    "en": "League not found."
  },
  "SQUAD_POSITION_LIMIT": {
    "es": "La plantilla debe tener 2 porteras y 8 jugadoras de campo.",
    "uk": "У складі мають бути 2 воротарки та 8 польових гравчинь.",
    "en": "The squad must have 2 goalkeepers and 8 outfield players."
  },
  "INVALID_PLAYER_PRICE": {
    "es": "El precio no está disponible. Actualiza la página.",
    "uk": "Ціна недоступна. Оновіть сторінку.",
    "en": "The price is unavailable. Refresh the page."
  },
  "LINEUP_MARKET_CLOSED": {
    "es": "Los cambios de alineación solo están disponibles mientras el mercado está abierto.",
    "uk": "Зміни складу доступні лише під час відкритого трансферного вікна.",
    "en": "Lineup changes are only available while the transfer market is open."
  },
  "INVALID_GOALKEEPER_STATS": {
    "es": "Comprueba los goles recibidos y la portería a cero.",
    "uk": "Перевірте пропущені голи та сухий матч.",
    "en": "Check the goals conceded and clean sheet statistics."
  },
  "NEGATIVE_PLAYER_PRICE": {
    "es": "El precio resultante es negativo. Revisa las estadísticas.",
    "uk": "Отримана ціна від’ємна. Перевірте статистику.",
    "en": "The resulting price is negative. Check the statistics."
  },
  "PRICE_PREVIEW_STALE": {
    "es": "Los datos han cambiado. Vuelve a calcular los precios.",
    "uk": "Дані змінилися. Розрахуйте ціни ще раз.",
    "en": "The data has changed. Recalculate the prices."
  },
  "PRICE_GAMEWEEK_NOT_COMPLETED": {
    "es": "Finaliza la jornada antes de aplicar los precios.",
    "uk": "Завершіть тур перед застосуванням цін.",
    "en": "Complete the gameweek before applying prices."
  },
  "Fantasy-команда не найдена": {
    "es": "No se encontró el equipo fantasy",
    "uk": "Fantasy-команду не знайдено",
    "en": "Fantasy team not found"
  },
  "Состав уже заполнен": {
    "es": "La plantilla ya está completa",
    "uk": "Склад уже заповнено",
    "en": "The squad is already full"
  },
  "Игрок уже выбран": {
    "es": "La jugadora ya está elegida",
    "uk": "Гравчиню вже обрано",
    "en": "The player is already selected"
  },
  "Игрок не найден": {
    "es": "No se encontró a la jugadora",
    "uk": "Гравчиню не знайдено",
    "en": "Player not found"
  },
  "Недостаточно бюджета для этого игрока": {
    "es": "No hay presupuesto suficiente para esta jugadora",
    "uk": "Недостатньо бюджету для цієї гравчині",
    "en": "Insufficient budget for this player"
  },
  "Максимум 2 игрока из одной команды": {
    "es": "Máximo 2 jugadoras del mismo club",
    "uk": "Максимум 2 гравчині з одного клубу",
    "en": "Maximum 2 players from the same club"
  },
  "Этот игрок не состоит в вашей команде": {
    "es": "Esta jugadora no está en tu equipo",
    "uk": "Ця гравчиня не у вашій команді",
    "en": "This player is not in your team"
  },
  "В основном составе уже 5 игроков": {
    "es": "Ya hay 5 jugadoras en el quinteto titular",
    "uk": "В основному складі вже 5 гравчинь",
    "en": "There are already 5 players in the starting lineup"
  },
  "В составе есть повторяющиеся игроки": {
    "es": "La plantilla contiene jugadoras repetidas",
    "uk": "У складі є повторювані гравчині",
    "en": "The squad contains duplicate players"
  },
  "Можно сохранять только игроков из своей команды": {
    "es": "Solo puedes guardar jugadoras de tu equipo",
    "uk": "Можна зберігати лише гравчинь зі своєї команди",
    "en": "You can only save players from your own team"
  },
  "Капитан должен быть в основном составе": {
    "es": "La capitana debe estar en el quinteto titular",
    "uk": "Капітанка має бути в основному складі",
    "en": "The captain must be in the starting lineup"
  },
  "Бюджет не может быть отрицательным": {
    "es": "El presupuesto no puede ser negativo",
    "uk": "Бюджет не може бути від’ємним",
    "en": "The budget cannot be negative"
  },
  "Нужно выбрать ровно 10 игроков": {
    "es": "Debes elegir exactamente 10 jugadoras",
    "uk": "Потрібно обрати рівно 10 гравчинь",
    "en": "Choose exactly 10 players"
  },
  "В основном составе должно быть ровно 5 игроков": {
    "es": "El quinteto titular debe tener exactamente 5 jugadoras",
    "uk": "В основному складі має бути рівно 5 гравчинь",
    "en": "The starting lineup must have exactly 5 players"
  },
  "На скамейке должно быть ровно 5 игроков": {
    "es": "Las suplentes deben ser exactamente 5",
    "uk": "У запасі має бути рівно 5 гравчинь",
    "en": "The bench must have exactly 5 players"
  },
  "В основном составе должен быть ровно один вратарь": {
    "es": "El quinteto titular debe tener exactamente una portera",
    "uk": "В основному складі має бути рівно одна воротарка",
    "en": "The starting lineup must have exactly one goalkeeper"
  },
  "В основном составе должны быть четыре полевых игрока": {
    "es": "El quinteto titular debe tener cuatro jugadoras de campo",
    "uk": "В основному складі мають бути чотири польові гравчині",
    "en": "The starting lineup must have four outfield players"
  },
  "Выберите одного капитана из основного состава": {
    "es": "Elige una capitana del quinteto titular",
    "uk": "Оберіть одну капітанку з основного складу",
    "en": "Choose one captain from the starting lineup"
  },
  "Не удалось завершить операцию с составом": {
    "es": "No se pudo completar la operación de plantilla",
    "uk": "Не вдалося завершити операцію зі складом",
    "en": "Could not complete the squad operation"
  },
  "Лига не найдена": {
    "es": "No se encontró la liga",
    "uk": "Лігу не знайдено",
    "en": "League not found"
  },
  "Участник не найден в этой лиге": {
    "es": "No se encontró a la participante en esta liga",
    "uk": "Учасницю не знайдено в цій лізі",
    "en": "Member not found in this league"
  },
  "Команда не найдена": {
    "es": "No se encontró el club",
    "uk": "Клуб не знайдено",
    "en": "Club not found"
  },
  "Профиль не найден": {
    "es": "No se encontró el perfil",
    "uk": "Профіль не знайдено",
    "en": "Profile not found"
  },
  "Нет изменений для сохранения": {
    "es": "No hay cambios para guardar",
    "uk": "Немає змін для збереження",
    "en": "No changes to save"
  },
  "Требуется авторизация": {
    "es": "Debes iniciar sesión",
    "uk": "Потрібно увійти в акаунт",
    "en": "Please sign in"
  },
  "Сессия истекла. Войдите снова.": {
    "es": "La sesión ha caducado. Inicia sesión de nuevo.",
    "uk": "Сесія завершилася. Увійдіть знову.",
    "en": "Your session has expired. Please sign in again."
  },
  "Неверный email или пароль": {
    "es": "El correo o la contraseña no son correctos",
    "uk": "Неправильна електронна пошта або пароль",
    "en": "Incorrect email or password"
  },
  "Пользователь с таким email уже зарегистрирован": {
    "es": "Ya existe una cuenta con este correo",
    "uk": "Акаунт із цією електронною поштою вже існує",
    "en": "An account with this email already exists"
  },
  "Такая запись уже существует": {
    "es": "Este registro ya existe",
    "uk": "Такий запис уже існує",
    "en": "This record already exists"
  },
  "Внутренняя ошибка сервера": {
    "es": "Error interno del servidor",
    "uk": "Внутрішня помилка сервера",
    "en": "Internal server error"
  },
  "Некорректные данные": {
    "es": "Datos no válidos",
    "uk": "Некоректні дані",
    "en": "Invalid data"
  },
  "Введите имя": {
    "es": "Introduce un nombre",
    "uk": "Введіть ім’я",
    "en": "Enter a name"
  },
  "Введите название команды": {
    "es": "Introduce un nombre para el equipo",
    "uk": "Введіть назву команди",
    "en": "Enter a team name"
  },
  "Invalid cuid": {
    "es": "Datos no válidos",
    "uk": "Некоректні дані",
    "en": "Invalid data"
  },
  "Для загрузки аватаров в production настройте BLOB_READ_WRITE_TOKEN": {
    "es": "Configura BLOB_READ_WRITE_TOKEN para subir avatares",
    "uk": "Налаштуйте BLOB_READ_WRITE_TOKEN для завантаження аватарів",
    "en": "Configure BLOB_READ_WRITE_TOKEN to upload avatars"
  },
  "Лимит покупок этого тура исчерпан": {
    "es": "Has agotado las 2 compras de esta jornada",
    "uk": "Ліміт із 2 покупок цього туру вичерпано",
    "en": "You have used all 2 purchases for this gameweek"
  },
  "Лимит продаж этого тура исчерпан": {
    "es": "Has agotado las 2 ventas de esta jornada",
    "uk": "Ліміт із 2 продажів цього туру вичерпано",
    "en": "You have used all 2 sales for this gameweek"
  },
  "Лига с таким кодом не найдена": {
    "es": "No se ha encontrado ninguna liga con este código",
    "uk": "Лігу з таким кодом не знайдено",
    "en": "No league found with this code"
  },
  "Вы уже состоите в этой лиге": {
    "es": "Ya formas parte de esta liga",
    "uk": "Ви вже є учасником цієї ліги",
    "en": "You are already a member of this league"
  },
  "Лига не найдена или доступ запрещён": {
    "es": "No se encontró la liga o no tienes acceso",
    "uk": "Лігу не знайдено або у вас немає доступу",
    "en": "League not found or access denied"
  },
  "Владелец не может покинуть лигу": {
    "es": "La propietaria no puede abandonar la liga sin transferir la propiedad o eliminarla",
    "uk": "Власниця не може залишити лігу без передачі прав або видалення ліги",
    "en": "The owner cannot leave the league without transferring ownership or deleting it"
  },
  "Удалить лигу может только владелец": {
    "es": "Sólo la propietaria puede eliminar la liga",
    "uk": "Видалити лігу може лише власниця",
    "en": "Only the owner can delete the league"
  },
  "El tamaño de la imagen no debe superar los 10 MB": {
    "es": "El tamaño de la imagen no debe superar los 10 MB",
    "uk": "Розмір зображення не повинен перевищувати 10 МБ",
    "en": "The image must not exceed 10 MB"
  },
  "No se pudo procesar el archivo": {
    "es": "No se pudo procesar el archivo",
    "uk": "Не вдалося обробити файл",
    "en": "Could not process the file"
  },
  "Formato no compatible. Usa JPEG, PNG, WebP, AVIF, GIF, HEIC o HEIF": {
    "es": "Formato no compatible. Usa JPEG, PNG, WebP, AVIF, GIF, HEIC o HEIF",
    "uk": "Непідтримуваний формат. Використовуйте JPEG, PNG, WebP, AVIF, GIF, HEIC або HEIF",
    "en": "Unsupported format. Use JPEG, PNG, WebP, AVIF, GIF, HEIC or HEIF"
  }
};

// The API can return either a stable message key or an already localized message.
const apiMessageLookup = new Map<string, Record<Locale, string>>();
for (const [key, translations] of Object.entries(apiMessages)) {
  apiMessageLookup.set(key, translations);
  for (const value of Object.values(translations)) apiMessageLookup.set(value, translations);
}

function localizedApiMessage(message: string | undefined): string {
  const locale = getStoredLocale();
  if (!message)
    return locale === "uk"
      ? "Щось пішло не так. Спробуйте ще раз."
      : locale === "en" ? "Something went wrong. Please try again." : "Algo salió mal. Inténtalo de nuevo.";
  return apiMessageLookup.get(message)?.[locale] ?? localizedApiMessage(undefined);
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
  return new Intl.NumberFormat(locale === "uk" ? "uk-UA" : locale === "en" ? "en-GB" : "es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function roleLabel(
  role: PlayerRole,
  locale: Locale = getStoredLocale(),
) {
  if (locale === "en") return { PORTERA: "Goalkeeper", CIERRE: "Defender", ALA: "Winger", PIVOT: "Pivot" }[role];
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

export function nationalityLabel(
  code: string | null | undefined,
  locale: Locale = getStoredLocale(),
) {
  if (!code) return undefined;
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

export function playerFactsLabel(
  player: Pick<Player, "age" | "nationality">,
  locale: Locale = getStoredLocale(),
) {
  return [
    player.age
      ? locale === "uk"
        ? `${player.age} років`
        : locale === "en" ? `${player.age} years old` : `${player.age} años`
      : null,
    nationalityLabel(player.nationality, locale),
  ]
    .filter(Boolean)
    .join(" · ");
}

export function playerSummaryLabel(
  player: Pick<Player, "role" | "age" | "nationality">,
  locale: Locale = getStoredLocale(),
) {
  return [roleLabel(player.role, locale), playerFactsLabel(player, locale)]
    .filter(Boolean)
    .join(" · ");
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = authToken.get();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  headers.set("Accept-Language", getStoredLocale());
  if (init.body && !(init.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  const response = await fetch(`${API_URL}${path}`, { cache: "no-store", ...init, headers });
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && token) {
    authToken.clear();
    window.dispatchEvent(new Event(authRequiredEvent));
  }
  if (!response.ok) {
    const error = new Error();
    Object.defineProperty(error, "message", { get: () => localizedApiMessage(data.message) });
    throw error;
  }
  return data as T;
}

export type PublicLineup = { user: { id: string; name: string }; players: Array<import("../types").SquadEntry & { points: number }> };
export type AdminFriendLeague = { id: string; name: string; inviteCode: string; createdAt: string; owner: { id: string; name: string }; _count: { members: number } };
export const api = {
  playerPrices: () => request<Array<Player & { priceChanges: Array<{ id: string; gameweek: Gameweek; priceBefore: number; priceAfter: number; priceDelta: number }> }>>("/player-prices"),
  publicLineup: (id: string) => request<PublicLineup>("/users/" + id + "/lineup"),
  adminFriendLeagues: () => request<AdminFriendLeague[]>("/admin/friend-leagues"),
  deleteAdminFriendLeague: (id: string) => request<void>("/admin/friend-leagues/" + id, { method: "DELETE" }),
  gameConfig: () => request<{ initialBudget: number }>("/game-config"),
  register: (payload: { email: string; password: string; name: string }) =>
    request<{ token: string; user: User }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  login: (payload: { email: string; password: string }) =>
    request<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  me: () => request<{ user: User }>("/auth/me"),
  profile: () => request<Profile>("/profile"),
  updateProfile: (form: FormData) =>
    request<Profile>("/profile", { method: "PATCH", body: form }),
  updatePassword: (payload: { currentPassword: string; newPassword: string }) =>
    request<void>("/profile/password", {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  setFavoriteClub: (clubId: string | null) =>
    request<Profile>("/profile/favorite-club", {
      method: "PATCH",
      body: JSON.stringify({ clubId }),
    }),
  clubs: () => request<Club[]>("/clubs"),
  club: (id: string) => request<Club>(`/clubs/${id}`),
  clubPlayers: (id: string) => request<Player[]>(`/clubs/${id}/players`),
  players: (filters: { clubId?: string; role?: string; search?: string }) => {
    const params = new URLSearchParams(
      Object.entries(filters).filter(([, value]) => value) as [
        string,
        string,
      ][],
    );
    return request<Player[]>(`/players${params.size ? `?${params}` : ""}`);
  },
  team: () => request<FantasyTeam>("/my-team"),
  popularPlayer: () => request<{ player: { id: string; name: string; number: number; club: { id: string; name: string } } | null; ownerCount: number; totalUsers: number; percentage: number }>("/my-team/popular-player"),
  addPlayer: (playerId: string) =>
    request<FantasyTeam>("/my-team/players", {
      method: "POST",
      body: JSON.stringify({ playerId }),
    }),
  removePlayer: (playerId: string) =>
    request<FantasyTeam>(`/my-team/players/${playerId}`, { method: "DELETE" }),
  setStatus: (playerId: string, status: SquadStatus) =>
    request<FantasyTeam>(`/my-team/players/${playerId}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  saveLineup: (players: Array<{ playerId: string; status: SquadStatus }>) =>
    request<FantasyTeam>("/my-team/lineup", {
      method: "PATCH",
      body: JSON.stringify({ players }),
    }),
  setCaptain: (playerId: string | null) =>
    request<FantasyTeam>("/my-team/captain", {
      method: "PATCH",
      body: JSON.stringify({ playerId }),
    }),
  transferStatus: () => request<TransferStatus>("/my-team/transfers"),
  league: () => request<League>("/league"),
  members: () => request<LeagueMember[]>("/league/members"),
  supporters: () => request<ClubSupport[]>("/league/supporters"),
  member: (id: string) => request<MemberDetail>(`/league/members/${id}`),
  applyTeamResults: (gameweekId: string, results: Array<{ clubId: string; result: string }>) => request<{ ok: boolean }>(`/admin/gameweeks/${gameweekId}/team-results`, { method: "PUT", body: JSON.stringify({ results }) }),
  priceSettings: () => request<{ teamWin: number | null }>("/admin/price-settings"),
  savePriceSettings: (teamWin: number | null) => request<{ teamWin: number | null }>("/admin/price-settings", { method: "PUT", body: JSON.stringify({ teamWin }) }),
  previewPrices: (gameweekId: string) => request<PricePreview>(`/admin/gameweeks/${gameweekId}/player-prices`),
  applyPrices: (gameweekId: string, revision: string) => request<PricePreview>(`/admin/gameweeks/${gameweekId}/player-prices`, { method: "POST", body: JSON.stringify({ revision }) }),
  adminUsers: () => request<AdminUser[]>("/admin/users"),
  currentGameweek: () => request<Gameweek | null>("/gameweeks/current"),
  scoringRules: () =>
    request<Record<string, number>>("/gameweeks/scoring-rules"),
  overallLeaderboard: () => request<LeaderboardRow[]>("/gameweeks/leaderboard"),
  gameweekLeaderboard: (id: string) =>
    request<LeaderboardRow[]>(`/gameweeks/${id}/leaderboard`),
  gameweekHistory: () =>
    request<
      Array<{
        id: string;
        totalPoints: number;
        breakdown: Array<{
          playerId: string;
          name: string;
          isCaptain: boolean;
          basePoints: number;
          points: number;
        }>;
        gameweek: Gameweek;
      }>
    >("/gameweeks/history/me"),
  adminGameweeks: () =>
    request<
      Array<
        Gameweek & {
          winners: Array<{ id: string; points: number; user: AdminUser }>;
        }
      >
    >("/admin/gameweeks"),
  adminPlayerPoints: (gameweekId?: string) =>
    request<
      Array<
        Player & {
          lastPriceDelta: number;
          totalFantasyPoints: number;
          lastGameweekPoints: number;
          gameweekStats: Array<Record<string, unknown>>;
        }
      >
    >(`/admin/player-points${gameweekId ? `?gameweekId=${gameweekId}` : ""}`),
  savePlayerStats: (
    gameweekId: string,
    playerId: string,
    payload: Record<string, unknown>,
  ) =>
    request<unknown>(
      `/admin/gameweeks/${gameweekId}/players/${playerId}/stats`,
      { method: "PUT", body: JSON.stringify(payload) },
    ),
  completeGameweek: (id: string) =>
    request<Gameweek>(`/admin/gameweeks/${id}/complete`, { method: "POST" }),
  reopenGameweek: (id: string) =>
    request<Gameweek>(`/admin/gameweeks/${id}/reopen`, { method: "POST" }),
  privateLeagues: () => request<PrivateLeagueSummary[]>("/private-leagues/my"),
  privateLeague: (id: string) =>
    request<PrivateLeagueDetail>(`/private-leagues/${id}`),
  createPrivateLeague: (name: string) =>
    request<PrivateLeagueSummary>("/private-leagues", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  joinPrivateLeague: (code: string) =>
    request<PrivateLeagueSummary>("/private-leagues/join", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),
  leavePrivateLeague: (id: string) =>
    request<void>(`/private-leagues/${id}/leave`, { method: "POST" }),
  deletePrivateLeague: (id: string) =>
    request<void>(`/private-leagues/${id}`, { method: "DELETE" }),
  deleteAdminUser: (id: string) =>
    request<void>(`/admin/users/${id}`, { method: "DELETE" }),
};

export type PricePreview = {
  gameweekId: string; teamWin: number | null; revision: string;
  rows: Array<{
    playerId: string; number: number; name: string; clubId: string; club: string;
    position: "GOALKEEPER" | "FIELD_PLAYER"; currentPrice: number; lastDelta: number;
    priceBefore: number; priceDelta: number; priceAfter: number; newCurrentPrice: number;
    teamResultDelta: number; goalsDelta: number; startedDelta: number; yellowCardsDelta: number;
    redCardsDelta: number; goalkeeperDelta: number; applied: boolean; missingStats: boolean;
  }>;
};
