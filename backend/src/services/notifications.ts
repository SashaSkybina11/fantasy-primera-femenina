import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { marketIsOpen } from "./market-schedule.js";

export type NotificationLocale = "es" | "uk" | "en" | "pt";
export type NotificationType = "MARKET_OPEN" | "MARKET_CLOSING" | "INCOMPLETE_TEAM" | "CAPTAIN_MISSING" | "GAMEWEEK_STARTING" | "GAMEWEEK_RESULTS" | "INVITATION_RECEIVED" | "GENERAL_ANNOUNCEMENT";
export type NotificationContent = { title: string; message: string; action: string; url: string };
export type NotificationContents = Record<NotificationLocale, NotificationContent>;
export type NotificationAudience = "ALL" | "LEAGUE" | "USERS" | "INCOMPLETE_TEAM" | "CAPTAIN_MISSING";
type Db = Prisma.TransactionClient | PrismaClient;

export const defaultNotificationTemplates: Record<NotificationType, NotificationContents> = {
  MARKET_OPEN: {
    es: { title: "¡El mercado está abierto!", message: "Ya puedes fichar jugadoras y preparar tu equipo para la próxima jornada.", action: "Ir al mercado", url: "/purchase-players" }, uk: { title: "Ринок відкрито!", message: "Ти вже можеш придбати гравчинь і підготувати команду до наступного туру.", action: "Перейти до ринку", url: "/purchase-players" }, en: { title: "The market is open!", message: "You can now sign players and prepare your team for the next gameweek.", action: "Go to market", url: "/purchase-players" }, pt: { title: "O mercado está aberto!", message: "Já podes contratar jogadoras e preparar a tua equipa para a próxima jornada.", action: "Ir para o mercado", url: "/purchase-players" },
  },
  MARKET_CLOSING: {
    es: { title: "¡El mercado está a punto de cerrar!", message: "Quedan {hours} horas para que cierre el mercado. Revisa tu equipo, completa los cambios necesarios y asegúrate de tener tu alineación preparada antes del cierre.", action: "Ir al mercado", url: "/purchase-players" }, uk: { title: "Ринок скоро закриється!", message: "До закриття ринку залишилося {hours} год. Перевір свою команду, внеси необхідні зміни та підготуй склад до закриття ринку.", action: "Перейти до ринку", url: "/purchase-players" }, en: { title: "The market is closing soon!", message: "The market closes in {hours} hours. Review your team, make any necessary transfers, and make sure your lineup is ready before the market closes.", action: "Go to market", url: "/purchase-players" }, pt: { title: "O mercado vai fechar em breve!", message: "Faltam {hours} horas para o fecho do mercado. Revê a tua equipa, faz as alterações necessárias e prepara o teu alinhamento antes do fecho.", action: "Ir para o mercado", url: "/purchase-players" },
  },
  INCOMPLETE_TEAM: {
    es: { title: "¡Tu equipo necesita más jugadoras!", message: "Tu plantilla no cumple los requisitos para participar en la liga. Entra en el mercado, ficha a las jugadoras que te faltan y prepara tu equipo para competir.", action: "Completar equipo", url: "/purchase-players" }, uk: { title: "У твоїй команді не вистачає гравчинь!", message: "Твоя команда не відповідає вимогам для участі в лізі. Перейди на ринок, придбай гравчинь, яких бракує, та підготуй команду до змагання.", action: "Доповнити команду", url: "/purchase-players" }, en: { title: "Your team needs more players!", message: "Your squad doesn't meet the requirements to participate in the league. Head to the market, sign the missing players, and get your team ready to compete.", action: "Complete team", url: "/purchase-players" }, pt: { title: "A tua equipa precisa de mais jogadoras!", message: "A tua equipa não cumpre os requisitos para participar na liga. Vai ao mercado, contrata as jogadoras em falta e prepara a tua equipa para competir.", action: "Completar equipa", url: "/purchase-players" },
  },
  CAPTAIN_MISSING: {
    es: { title: "¡Elige a la capitana de tu equipo!", message: "Todavía no has elegido a tu capitana. Selecciona una jugadora antes de la próxima jornada para aprovechar al máximo los puntos de tu equipo.", action: "Elegir capitana", url: "/my-team" }, uk: { title: "Обери капітанку своєї команди!", message: "Ти ще не призначила капітанку. Обери гравчиню до початку наступного туру, щоб отримати максимум очок для своєї команди.", action: "Обрати капітанку", url: "/my-team" }, en: { title: "Choose your team captain!", message: "You haven't selected a captain yet. Choose a player before the next gameweek to make the most of your team's points.", action: "Choose captain", url: "/my-team" }, pt: { title: "Escolhe a capitã da tua equipa!", message: "Ainda não escolheste a tua capitã. Seleciona uma jogadora antes da próxima jornada para aproveitares ao máximo os pontos da tua equipa.", action: "Escolher capitã", url: "/my-team" },
  },
  GAMEWEEK_STARTING: {
    es: { title: "¡Se acerca una nueva jornada!", message: "La jornada {gameweek} comienza pronto. Revisa tu alineación y comprueba tu capitana.", action: "Revisar equipo", url: "/my-team" }, uk: { title: "Скоро розпочнеться новий тур!", message: "Тур {gameweek} незабаром почнеться. Перевір стартовий склад і капітанку.", action: "Перевірити команду", url: "/my-team" }, en: { title: "A new gameweek is coming!", message: "Gameweek {gameweek} is about to begin. Review your lineup and check your captain.", action: "Review team", url: "/my-team" }, pt: { title: "Está a chegar uma nova jornada!", message: "A jornada {gameweek} está prestes a começar. Revê o teu alinhamento e confirma a tua capitã.", action: "Rever equipa", url: "/my-team" },
  },
  GAMEWEEK_RESULTS: {
    es: { title: "¡Ya están disponibles los resultados!", message: "Los resultados de la jornada {gameweek} ya están disponibles. Tu equipo ha conseguido {points} puntos.", action: "Ver resultados", url: "/leaderboard" }, uk: { title: "Результати туру вже доступні!", message: "Результати туру {gameweek} опубліковано. Твоя команда набрала {points} очок.", action: "Переглянути результати", url: "/leaderboard" }, en: { title: "Gameweek results are here!", message: "The results for gameweek {gameweek} are available. Your team scored {points} points.", action: "View results", url: "/leaderboard" }, pt: { title: "Já estão disponíveis os resultados!", message: "Os resultados da jornada {gameweek} já estão disponíveis. A tua equipa conquistou {points} pontos.", action: "Ver resultados", url: "/leaderboard" },
  },
  INVITATION_RECEIVED: {
    es: { title: "Te han invitado a una liga", message: "{managerName} te invita a unirte a «{leagueName}». Código de invitación: {inviteCode}.", action: "Ver ligas", url: "/friend-leagues" }, uk: { title: "Тебе запросили до ліги", message: "{managerName} запрошує тебе до ліги «{leagueName}». Код запрошення: {inviteCode}.", action: "Переглянути ліги", url: "/friend-leagues" }, en: { title: "You have a league invitation", message: "{managerName} invited you to join “{leagueName}”. Invite code: {inviteCode}.", action: "View leagues", url: "/friend-leagues" }, pt: { title: "Recebeste um convite para uma liga", message: "{managerName} convidou-te para participar em «{leagueName}». Código do convite: {inviteCode}.", action: "Ver ligas", url: "/friend-leagues" },
  },
  GENERAL_ANNOUNCEMENT: {
    es: { title: "Anuncio de la administración", message: "Tienes un nuevo mensaje de la administración.", action: "Ver anuncio", url: "/notifications" }, uk: { title: "Оголошення адміністрації", message: "Ти отримала нове повідомлення від адміністрації.", action: "Переглянути", url: "/notifications" }, en: { title: "Announcement from the administration", message: "You have a new message from the administration.", action: "View announcement", url: "/notifications" }, pt: { title: "Comunicado da administração", message: "Tens uma nova mensagem da administração.", action: "Ver comunicado", url: "/notifications" },
  },
};

export function notificationTemplate(type: NotificationType, locale: NotificationLocale, variables: Record<string, string> = {}): NotificationContent {
  const content = defaultNotificationTemplates[type]?.[locale] ?? defaultNotificationTemplates[type]?.en;
  if (!content) return { title: "", message: "", action: "", url: "" };
  return interpolateNotificationContent(content, variables);
}

export function interpolateNotificationContent(content: NotificationContent, variables: Record<string, string> = {}): NotificationContent {
  const interpolate = (value: string) => value.replace(/\{([a-zA-Z]+)\}/g, (match, key: string) => variables[key] ?? match);
  return { title: interpolate(content.title), message: interpolate(content.message), action: interpolate(content.action), url: content.url };
}

export async function getNotificationContents(type: NotificationType, tx: Db = prisma): Promise<NotificationContents> {
  const saved = await tx.notificationTemplate.findUnique({ where: { type }, select: { contents: true } });
  return (saved?.contents as NotificationContents | undefined) ?? defaultNotificationTemplates[type];
}

export function normalizeNotificationLocale(value?: string | null): NotificationLocale {
  const language = value?.split(",")[0]?.trim().toLowerCase();
  if (language === "es" || language === "uk" || language === "en") return language;
  if (language?.startsWith("pt")) return "pt";
  return "en";
}

export function hasCompleteRoster(players: Array<{ position: string }>) {
  return players.length === 10 && players.filter(player => player.position === "GOALKEEPER").length === 2 && players.filter(player => player.position === "FIELD_PLAYER").length === 8;
}

export function hasCaptain(players: Array<{ status: string; isCaptain: boolean }>) {
  return players.some(player => player.status === "STARTER" && player.isCaptain);
}

export function matchesNotificationAudience(user: { team: { players: Array<{ position: string; status: string; isCaptain: boolean }> } | null }, audience: NotificationAudience) {
  if (audience === "INCOMPLETE_TEAM") return !user.team || !hasCompleteRoster(user.team.players);
  if (audience === "CAPTAIN_MISSING") return !user.team || !hasCaptain(user.team.players);
  return true;
}

export async function createNotification(tx: Db, input: { type: NotificationType; audience: NotificationAudience; userIds: string[]; variables?: Record<string, string>; recipientVariables?: Record<string, Record<string, string>>; contents?: NotificationContents; createdById?: string; eventKey?: string | null }) {
  const eventKey = input.eventKey ?? null;
  const data = { type: input.type, audience: input.audience, eventKey, createdById: input.createdById, payload: { variables: input.variables ?? {}, contents: input.contents ?? null } };
  const notification = eventKey ? await tx.notification.upsert({ where: { eventKey }, create: data, update: {} }) : await tx.notification.create({ data });
  if (input.userIds.length) await tx.notificationRecipient.createMany({ data: [...new Set(input.userIds)].map(userId => ({ notificationId: notification.id, userId, eventKey, variables: input.recipientVariables?.[userId] ?? undefined })), skipDuplicates: true });
  return notification;
}

export async function sendEventNotification(type: NotificationType, eventKey: string, userIds: string[], variables: Record<string, string> = {}, tx: Db = prisma) {
  if (!userIds.length) return null;
  const existing = await tx.notification.findUnique({ where: { eventKey }, select: { id: true } });
  if (existing) {
    await tx.notificationRecipient.createMany({ data: [...new Set(userIds)].map(userId => ({ notificationId: existing.id, userId, eventKey })), skipDuplicates: true });
    return existing;
  }
  return createNotification(tx, { type, audience: "USERS", eventKey, userIds, variables, contents: await getNotificationContents(type, tx) });
}

async function activeUserIds(tx: Db) {
  const users = await tx.user.findMany({ where: { role: "USER", status: "ACTIVE" }, select: { id: true } });
  return users.map(user => user.id);
}

async function checkedSegment(tx: Db, segment: "INCOMPLETE_TEAM" | "CAPTAIN_MISSING") {
  const users = await tx.user.findMany({ where: { role: "USER", status: "ACTIVE" }, include: { fantasyTeam: { include: { players: { include: { player: { select: { position: true } } } } } } } });
  return users.filter(user => matchesNotificationAudience({ team: user.fantasyTeam ? { players: user.fantasyTeam.players.map(entry => ({ position: entry.player.position, status: entry.status, isCaptain: entry.isCaptain })) } : null }, segment)).map(user => user.id);
}

export async function previewNotificationAudience(audience: NotificationAudience, leagueId?: string, requestedUserIds: string[] = [], tx: Db = prisma) {
  if (audience === "ALL") return activeUserIds(tx);
  if (audience === "LEAGUE") {
    if (!leagueId) return [];
    const members = await tx.privateLeagueMember.findMany({ where: { leagueId, user: { role: "USER", status: "ACTIVE" } }, select: { userId: true } });
    return members.map(member => member.userId);
  }
  if (audience === "USERS") {
    if (!requestedUserIds.length) return [];
    const users = await tx.user.findMany({ where: { id: { in: [...new Set(requestedUserIds)] }, role: "USER", status: "ACTIVE" }, select: { id: true } });
    return users.map(user => user.id);
  }
  return checkedSegment(tx, audience);
}

export async function runNotificationJobs(now = new Date(), tx: Db = prisma) {
  const report = { created: 0, recipients: 0 };
  const supported = await tx.notificationTemplate.findMany();
  const templates = new Map(supported.map(row => [row.type, row.contents]));
  for (const [type, contents] of Object.entries(defaultNotificationTemplates)) {
    if (!templates.has(type)) await tx.notificationTemplate.create({ data: { type, contents } });
  }
  const weeks = await tx.gameweek.findMany({ where: { status: { not: "COMPLETED" } }, orderBy: { number: "asc" } });
  const users = await activeUserIds(tx);
  const create = async (type: NotificationType, key: string, recipients: string[], variables: Record<string, string> = {}) => {
    if (!recipients.length || await tx.notification.findUnique({ where: { eventKey: key }, select: { id: true } })) return;
    const freshRecipients = type === "INCOMPLETE_TEAM" || type === "CAPTAIN_MISSING"
      ? await checkedSegment(tx, type)
      : recipients;
    if (!freshRecipients.length) return;
    await sendEventNotification(type, key, freshRecipients, variables, tx);
    report.created += 1; report.recipients += freshRecipients.length;
  };
  for (const week of weeks) {
    const untilDeadline = week.deadlineAt.getTime() - now.getTime();
    if (marketIsOpen(week, now)) await create("MARKET_OPEN", `MARKET_OPEN:${week.id}`, users, { gameweek: String(week.number) });
    if (marketIsOpen(week, now)) for (const hours of [24, 3]) {
      const remaining = untilDeadline / 3_600_000;
      if (remaining > hours - 1 && remaining <= hours) await create("MARKET_CLOSING", `MARKET_CLOSING:${week.id}:${hours}`, users, { hours: String(hours), gameweek: String(week.number) });
    }
    const untilStart = week.startsAt.getTime() - now.getTime();
    if (untilStart > 0 && untilStart <= 24 * 3_600_000) await create("GAMEWEEK_STARTING", `GAMEWEEK_STARTING:${week.id}`, users, { gameweek: String(week.number) });
  }
  const current = weeks.find(week => week.marketOpenAt <= now && now < week.deadlineAt && marketIsOpen(week, now));
  if (current) {
    const incomplete = await checkedSegment(tx, "INCOMPLETE_TEAM");
    const missingCaptain = await checkedSegment(tx, "CAPTAIN_MISSING");
    const incompleteKey = `INCOMPLETE_TEAM:${current.id}`;
    const captainKey = `CAPTAIN_MISSING:${current.id}`;
    // Re-evaluate dynamic segments each run and only add newly eligible recipients.
    await sendDynamicEventNotification("INCOMPLETE_TEAM", incompleteKey, incomplete, { gameweek: String(current.number) }, tx, report);
    await sendDynamicEventNotification("CAPTAIN_MISSING", captainKey, missingCaptain, { gameweek: String(current.number) }, tx, report);
  }
  return report;
}

async function sendDynamicEventNotification(type: "INCOMPLETE_TEAM" | "CAPTAIN_MISSING", key: string, recipients: string[], variables: Record<string, string>, tx: Db, report: { created: number; recipients: number }) {
  if (!recipients.length) return;
  const current = await tx.notification.findUnique({ where: { eventKey: key }, select: { id: true } });
  const notification = current ?? await tx.notification.create({ data: { type, audience: type, eventKey: key, payload: { variables, contents: await getNotificationContents(type, tx) } } });
  const alreadySent = await tx.notificationRecipient.findMany({ where: { notificationId: notification.id, userId: { in: recipients } }, select: { userId: true } });
  const sentIds = new Set(alreadySent.map(row => row.userId));
  const pending = recipients.filter(userId => !sentIds.has(userId));
  if (!pending.length) return;
  await tx.notificationRecipient.createMany({ data: pending.map(userId => ({ notificationId: notification.id, userId, eventKey: `${key}:${userId}` })), skipDuplicates: true });
  if (!current) report.created += 1;
  report.recipients += pending.length;
}

export async function notifyGameweekResults(tx: Db, gameweekId: string) {
  const week = await tx.gameweek.findUnique({ where: { id: gameweekId }, select: { id: true, number: true, status: true } });
  if (!week || week.status !== "COMPLETED") return null;
  const results = await tx.userGameweekPoints.findMany({ where: { gameweekId, isFinal: true, user: { role: "USER", status: "ACTIVE" } }, select: { userId: true, totalPoints: true } });
  const existing = await tx.notification.findUnique({ where: { eventKey: `GAMEWEEK_RESULTS:${week.id}` }, select: { id: true } });
  if (existing) return existing;
  const notification = await createNotification(tx, { type: "GAMEWEEK_RESULTS", audience: "USERS", eventKey: `GAMEWEEK_RESULTS:${week.id}`, userIds: results.map(row => row.userId), variables: { gameweek: String(week.number) }, recipientVariables: Object.fromEntries(results.map(row => [row.userId, { points: String(row.totalPoints) }])), contents: await getNotificationContents("GAMEWEEK_RESULTS", tx) });
  await Promise.all(results.map(row => tx.notificationRecipient.update({ where: { notificationId_userId: { notificationId: notification.id, userId: row.userId } }, data: { eventKey: `GAMEWEEK_RESULTS:${week.id}:${row.userId}` } })));
  return notification;
}
