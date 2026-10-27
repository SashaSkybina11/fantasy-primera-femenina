import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../contexts/AuthContext";
import { useLocale } from "../contexts/LocaleContext";
import type { TranslationKey } from "../contexts/LocaleContext";
import { api, type NotificationAudience, type NotificationContent, type NotificationLocaleKey } from "../services/api";
import { Loader } from "../components/Loader";

const localeKeys: NotificationLocaleKey[] = ["es", "uk", "en", "pt"];
const notificationTypes = ["MARKET_OPEN", "MARKET_CLOSING", "INCOMPLETE_TEAM", "CAPTAIN_MISSING", "GAMEWEEK_STARTING", "GAMEWEEK_RESULTS", "INVITATION_RECEIVED", "GENERAL_ANNOUNCEMENT"];
const emptyContent: NotificationContent = { title: "", message: "", action: "", url: "" };

export function AdminNotificationsPage() {
  const { user } = useAuth();
  const { t, locale } = useLocale();
  const client = useQueryClient();
  const targets = useQuery({ queryKey: ["notification-targets"], queryFn: api.notificationTargets });
  const templates = useQuery({ queryKey: ["notification-templates"], queryFn: api.notificationTemplates });
  const history = useQuery({ queryKey: ["admin-notification-history"], queryFn: api.adminNotificationHistory });
  const [type, setType] = useState("MARKET_CLOSING");
  const [audience, setAudience] = useState<NotificationAudience>("ALL");
  const [leagueId, setLeagueId] = useState("");
  const [userIds, setUserIds] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [hours, setHours] = useState("24");
  const [previewLocale, setPreviewLocale] = useState<NotificationLocaleKey | null>(null);
  const [contents, setContents] = useState<Record<NotificationLocaleKey, NotificationContent>>({ es: { ...emptyContent }, uk: { ...emptyContent }, en: { ...emptyContent }, pt: { ...emptyContent } });
  const template = templates.data?.find(item => item.type === type);
  useEffect(() => { if (template) setContents(template.contents); }, [template]);
  const audienceInput = useMemo(() => ({ audience, ...(audience === "LEAGUE" && leagueId ? { leagueId } : {}), ...(audience === "USERS" ? { userIds } : {}) }), [audience, leagueId, userIds]);
  const validAudience = audience !== "LEAGUE" || Boolean(leagueId);
  const audiencePreview = useQuery({ queryKey: ["notification-audience-preview", audienceInput], queryFn: () => api.previewNotificationAudience(audienceInput), enabled: validAudience && (audience !== "USERS" || userIds.length > 0) });
  const send = useMutation({ mutationFn: api.sendNotification, onSuccess: async () => { toast.success(t("notifications.sent")); await client.invalidateQueries({ queryKey: ["admin-notification-history"] }); }, onError: error => toast.error(error.message) });
  const saveTemplate = useMutation({ mutationFn: () => api.updateNotificationTemplate(type, contents), onSuccess: async () => { toast.success(t("notifications.templateSaved")); await client.invalidateQueries({ queryKey: ["notification-templates"] }); }, onError: error => toast.error(error.message) });
  if (user?.role !== "ADMIN") return <Navigate to="/" replace />;
  const language = locale === "pt-BR" ? "pt" : locale;
  const defaultPreviewLocale = (localeKeys as readonly string[]).includes(language) ? language as NotificationLocaleKey : "en";
  const activePreviewLocale = previewLocale ?? defaultPreviewLocale;
  const selectedContent = contents[activePreviewLocale];
  const previewMessage = selectedContent.message.split("{hours}").join(hours);
  const visibleUsers = targets.data?.users.filter(player => `${player.name} ${player.email}`.toLocaleLowerCase().includes(userSearch.toLocaleLowerCase().trim())) ?? [];
  const sendNotification = () => {
    const count = audiencePreview.data?.count ?? 0;
    if (!count || !window.confirm(t("notifications.confirmSend", { count }))) return;
    send.mutate({ type, audience, ...(audience === "LEAGUE" ? { leagueId } : {}), ...(audience === "USERS" ? { userIds } : {}), ...(type === "MARKET_CLOSING" ? { hours } : {}), contents });
  };
  const updateContent = (languageKey: NotificationLocaleKey, field: keyof NotificationContent, value: string) => setContents(current => ({ ...current, [languageKey]: { ...current[languageKey], [field]: value } }));
  return <div className="page page--narrow admin-notifications-page">
    <header className="page-heading"><p className="eyebrow">{t("admin.eyebrow")}</p><h1>{t("notifications.adminTitle")}</h1><p className="muted">{t("notifications.adminHelp")}</p></header>
    <section className="admin-card notification-composer">
      <label>{t("notifications.template")}<select value={type} onChange={event => setType(event.target.value)}>{notificationTypes.map(value => <option key={value} value={value}>{t(`notifications.type.${value}` as TranslationKey)}</option>)}</select></label>
      <label>{t("notifications.audience")}<select value={audience} onChange={event => setAudience(event.target.value as NotificationAudience)}><option value="ALL">{t("notifications.allPlayers")}</option><option value="LEAGUE">{t("notifications.league")}</option><option value="USERS">{t("notifications.selectedPlayers")}</option><option value="INCOMPLETE_TEAM">{t("notifications.audience.incomplete")}</option><option value="CAPTAIN_MISSING">{t("notifications.audience.noCaptain")}</option></select></label>
      {audience === "LEAGUE" && <label>{t("notifications.league")}<select value={leagueId} onChange={event => setLeagueId(event.target.value)}><option value="">{t("notifications.chooseLeague")}</option>{targets.data?.leagues.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
      {audience === "USERS" && <div className="notification-user-picker"><strong>{t("notifications.selectedPlayers")}</strong><input value={userSearch} onChange={event => setUserSearch(event.target.value)} placeholder={t("admin.searchPlaceholder")} /><div>{visibleUsers.map(player => <label key={player.id}><input type="checkbox" checked={userIds.includes(player.id)} onChange={event => setUserIds(current => event.target.checked ? [...current, player.id] : current.filter(id => id !== player.id))} /><span>{player.name}<small>{player.email}</small></span></label>)}</div></div>}
      {type === "MARKET_CLOSING" && <label>{t("notifications.hours")}<input type="number" min="1" max="999" value={hours} onChange={event => setHours(event.target.value)} /></label>}
      <div className="notification-recipient-count" role="status">{audiencePreview.isPending ? t("loading.app") : audiencePreview.isError ? t("error.generic") : t("notifications.previewCount", { count: audiencePreview.data?.count ?? 0 })}</div>
      <section className="notification-template-editor"><h2>{t("notifications.template")}</h2>{localeKeys.map(languageKey => <details key={languageKey}><summary>{t(`notifications.language.${languageKey}`)}</summary><div className="notification-template-fields">
        <label>{t("notifications.field.title")}<input maxLength={160} value={contents[languageKey].title} onChange={event => updateContent(languageKey, "title", event.target.value)} /></label>
        <label>{t("notifications.field.message")}<textarea maxLength={4000} rows={4} value={contents[languageKey].message} onChange={event => updateContent(languageKey, "message", event.target.value)} /></label>
        <label>{t("notifications.field.action")}<input maxLength={80} value={contents[languageKey].action} onChange={event => updateContent(languageKey, "action", event.target.value)} /></label>
        <label>{t("notifications.field.url")}<input value={contents[languageKey].url} onChange={event => updateContent(languageKey, "url", event.target.value)} /></label>
      </div></details>)}</section>
      <aside className="notification-preview"><label>{t("notifications.preview")}<select value={activePreviewLocale} onChange={event => setPreviewLocale(event.target.value as NotificationLocaleKey)}>{localeKeys.map(key => <option key={key} value={key}>{t(`notifications.language.${key}`)}</option>)}</select></label><h2>{selectedContent.title}</h2><p>{previewMessage}</p>{selectedContent.action && <strong>{selectedContent.action}</strong>}</aside>
      <button className="button button--secondary" disabled={saveTemplate.isPending || !contents.es.title || !contents.uk.title || !contents.en.title || !contents.pt.title} onClick={() => saveTemplate.mutate()}>{t("notifications.saveTemplate")}</button>
      <button className="button" disabled={send.isPending || saveTemplate.isPending || targets.isPending || audiencePreview.isPending || !audiencePreview.data?.count || localeKeys.some(key => !contents[key].title || !contents[key].message) || (audience === "LEAGUE" && !leagueId) || (audience === "USERS" && !userIds.length)} onClick={sendNotification}>{send.isPending ? t("auth.wait") : t("notifications.send")}</button>
    </section>
    <section className="notification-history"><header className="admin-card__head"><h2>{t("notifications.history")}</h2></header>{history.isPending && <Loader label={t("loading.app")} />}{history.isError && <p className="state-card state-card--error">{t("error.generic")}</p>}{history.data?.length === 0 && <p className="state-card">{t("notifications.historyEmpty")}</p>}{history.data?.map(item => <article className="notification-history-row" key={item.id}><div><strong>{t(`notifications.type.${item.type}` as TranslationKey)}</strong><time>{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.sentAt))}</time><small>{item.createdBy?.name ?? t("notifications.system")}</small></div><span>{t("notifications.recipients")}: {item.recipientCount}</span><span>{t("notifications.readCount")}: {item.readCount}</span></article>)}</section>
  </div>;
}
