import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { IoMdNotificationsOutline } from "react-icons/io";
import { Loader } from "../components/Loader";
import { api } from "../services/api";
import { useLocale } from "../contexts/LocaleContext";

export function NotificationsPage() {
  const { t, locale } = useLocale();
  const client = useQueryClient();
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");
  const notifications = useQuery({ queryKey: ["notifications", filter], queryFn: () => api.notifications(filter) });
  const markRead = useMutation({ mutationFn: api.markNotificationRead, onSuccess: () => { void client.invalidateQueries({ queryKey: ["notifications"] }); void client.invalidateQueries({ queryKey: ["notification-unread-count"] }); } });
  return <div className="page page--narrow notifications-page">
    <header className="page-heading"><p className="eyebrow">{t("notifications.eyebrow")}</p><h1><IoMdNotificationsOutline aria-hidden="true" /> {t("notifications.title")}</h1><p className="muted">{t("notifications.unreadCount", { count: notifications.data?.unreadCount ?? 0 })}</p></header>
    <div className="notification-filters" role="group" aria-label={t("notifications.filterLabel")}>
      {(["all", "unread", "read"] as const).map(value => <button key={value} type="button" className={`button ${filter === value ? "" : "button--secondary"}`} aria-pressed={filter === value} onClick={() => setFilter(value)}>{t(`notifications.filter.${value}`)}</button>)}
    </div>
    {notifications.isPending && <div className="state-card"><Loader label={t("loading.app")} /></div>}
    {notifications.isError && <div className="state-card state-card--error">{t("error.generic")} <button className="button button--secondary" onClick={() => void notifications.refetch()}>{t("friends.retry")}</button></div>}
    {notifications.data?.items.length === 0 && <p className="state-card">{t("notifications.empty")}</p>}
    <div className="notification-list">{notifications.data?.items.map(item => <details className={`notification-card${item.isRead ? " is-read" : " is-unread"}`} key={item.id} onToggle={event => { if (event.currentTarget.open && !item.isRead) markRead.mutate(item.id); }}>
      <summary><div className="notification-card__meta"><time dateTime={item.createdAt}>{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.createdAt))}</time><span>{t(item.isRead ? "notifications.read" : "notifications.unreadStatus")}</span></div><h2>{item.title}</h2></summary>
      <p>{item.message}</p>{item.action && item.url && <Link className="button button--secondary" to={item.url}>{item.action}</Link>}
    </details>)}</div>
  </div>;
}
