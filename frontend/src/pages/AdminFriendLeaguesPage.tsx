import { Loader } from "../components/Loader";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useLocale } from "../contexts/LocaleContext";
import { api, type AdminFriendLeague } from "../services/api";
import { Modal } from "../components/Modal";
import { Avatar } from "../components/Avatar";
import { useEffect } from "react";

export function AdminFriendLeaguesPage() {
  const { user } = useAuth();
  const { locale, t } = useLocale();
  const client = useQueryClient();
  const [selected, setSelected] = useState<AdminFriendLeague | null>(null);
  const [editing, setEditing] = useState<AdminFriendLeague | null>(null);
  const [editName, setEditName] = useState("");
  const [editLogo, setEditLogo] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  useEffect(() => { const url = editLogo ? URL.createObjectURL(editLogo) : ""; setPreview(url); return () => { if (url) URL.revokeObjectURL(url); }; }, [editLogo]);
  const leagues = useQuery({ queryKey: ["admin-friend-leagues"], queryFn: api.adminFriendLeagues, enabled: user?.role === "ADMIN" });
  const remove = useMutation({ mutationFn: api.deleteAdminFriendLeague, onSuccess: async () => { setSelected(null); await client.invalidateQueries(); } });
  const update = useMutation({ mutationFn: () => api.updateAdminFriendLeague(editing!.id, editName, editLogo), onSuccess: async () => { setEditing(null); setEditLogo(null); await client.invalidateQueries(); } });
  if (user?.role !== "ADMIN") return <Navigate to="/" replace />;
  return <div className="page admin-leagues-page admin-page"><header className="page-heading"><p className="eyebrow">{t("admin.eyebrow")}</p><h1>{t("adminLeagues.title")}</h1></header>
    {leagues.isPending ? <p className="state-card"><Loader label={t("admin.loading")} /></p> : leagues.isError ? <p className="state-card state-card--error">{t("error.generic")} <button className="button" onClick={() => void leagues.refetch()}>{t("friends.retry")}</button></p> : !leagues.data.length ? <p className="state-card">{t("adminLeagues.empty")}</p> : <div className="admin-league-grid">{leagues.data.map((league) => <article className="admin-card admin-league-card" key={league.id}>
      <div className="admin-league-card__heading"><Avatar name={league.name} src={league.logoUrl} /><h2>{league.name}</h2></div><dl><div><dt>{t("adminLeagues.owner")}</dt><dd>{league.owner.name}</dd></div><div><dt>{t("adminLeagues.members")}</dt><dd>{league._count.members}</dd></div><div><dt>{t("adminLeagues.created")}</dt><dd>{new Intl.DateTimeFormat(locale === "uk" ? "uk-UA" : locale === "en" ? "en-GB" : locale === "pt" ? "pt-PT" : locale === "pt-BR" ? "pt-BR" : "es-ES").format(new Date(league.createdAt))}</dd></div><div><dt>{t("adminLeagues.code")}</dt><dd>{league.inviteCode}</dd></div></dl>
      <Link className="button button--secondary" to={`/league/${league.id}`}>{t("friends.members")}</Link>
      <button className="button button--secondary" onClick={() => { update.reset(); setEditName(league.name); setEditLogo(null); setEditing(league); }}>{t("adminLeagues.edit")}</button>
      <button className="button" onClick={() => { remove.reset(); setSelected(league); }}>{t("admin.delete")}</button>
    </article>)}</div>}
    {editing && <Modal title={t("adminLeagues.edit")} onClose={() => { if (!update.isPending) setEditing(null); }}><form onSubmit={(event) => { event.preventDefault(); update.mutate(); }}><label>{t("adminLeagues.name")}<input required minLength={3} maxLength={50} value={editName} onChange={(event) => setEditName(event.target.value)} /></label><label>{t("adminLeagues.avatar")}<Avatar name={editName || editing.name} src={preview || editing.logoUrl} /><input type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif,image/heic,image/heif" onChange={(event) => setEditLogo(event.target.files?.[0] ?? null)} /></label>{update.isError && <p className="state-card state-card--error" role="alert">{update.error.message}</p>}<div className="modal-actions"><button type="button" className="button button--secondary" disabled={update.isPending} onClick={() => setEditing(null)}>{t("adminLeagues.cancel")}</button><button className="button" disabled={update.isPending}>{update.isPending ? t("auth.wait") : t("adminLeagues.save")}</button></div></form></Modal>}
    {selected && <Modal title={selected.name} onClose={() => { if (!remove.isPending) setSelected(null); }}><p>{t("adminLeagues.confirm")}</p>{remove.isError && <p className="state-card state-card--error" role="alert">{remove.error.message}</p>}<div className="modal-actions"><button className="button button--secondary" disabled={remove.isPending} onClick={() => setSelected(null)}>{t("adminLeagues.cancel")}</button><button className="button" disabled={remove.isPending} onClick={() => remove.mutate(selected.id)}>{remove.isPending ? t("auth.wait") : t("admin.delete")}</button></div></Modal>}
  </div>;
}
