import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useLocale } from "../contexts/LocaleContext";
import { api, type AdminFriendLeague } from "../services/api";
import { Modal } from "../components/Modal";

export function AdminFriendLeaguesPage() {
  const { user } = useAuth();
  const { locale, t } = useLocale();
  const client = useQueryClient();
  const [selected, setSelected] = useState<AdminFriendLeague | null>(null);
  const leagues = useQuery({ queryKey: ["admin-friend-leagues"], queryFn: api.adminFriendLeagues, enabled: user?.role === "ADMIN" });
  const remove = useMutation({ mutationFn: api.deleteAdminFriendLeague, onSuccess: async () => { setSelected(null); await client.invalidateQueries(); } });
  if (user?.role !== "ADMIN") return <Navigate to="/" replace />;
  return <div className="page admin-leagues-page"><header className="page-heading"><p className="eyebrow">{t("admin.eyebrow")}</p><h1>{t("adminLeagues.title")}</h1></header>
    {leagues.isPending ? <p className="state-card">{t("admin.loading")}</p> : leagues.isError ? <p className="state-card state-card--error">{t("error.generic")} <button className="button" onClick={() => void leagues.refetch()}>{t("friends.retry")}</button></p> : !leagues.data.length ? <p className="state-card">{t("adminLeagues.empty")}</p> : <div className="admin-league-grid">{leagues.data.map((league) => <article className="admin-card admin-league-card" key={league.id}>
      <h2>{league.name}</h2><dl><div><dt>{t("adminLeagues.owner")}</dt><dd>{league.owner.name}</dd></div><div><dt>{t("adminLeagues.members")}</dt><dd>{league._count.members}</dd></div><div><dt>{t("adminLeagues.created")}</dt><dd>{new Intl.DateTimeFormat(locale === "uk" ? "uk-UA" : "es-ES").format(new Date(league.createdAt))}</dd></div><div><dt>{t("adminLeagues.code")}</dt><dd>{league.inviteCode}</dd></div></dl>
      <button className="button" onClick={() => { remove.reset(); setSelected(league); }}>{t("admin.delete")}</button>
    </article>)}</div>}
    {selected && <Modal title={selected.name} onClose={() => { if (!remove.isPending) setSelected(null); }}><p>{t("adminLeagues.confirm")}</p>{remove.isError && <p className="state-card state-card--error" role="alert">{remove.error.message}</p>}<div className="modal-actions"><button className="button button--secondary" disabled={remove.isPending} onClick={() => setSelected(null)}>{t("adminLeagues.cancel")}</button><button className="button" disabled={remove.isPending} onClick={() => remove.mutate(selected.id)}>{remove.isPending ? t("auth.wait") : t("admin.delete")}</button></div></Modal>}
  </div>;
}
