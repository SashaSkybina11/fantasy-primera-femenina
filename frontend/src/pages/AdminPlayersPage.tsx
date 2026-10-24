import { useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { GoArrowRight } from "react-icons/go";
import { useAuth } from "../contexts/AuthContext";
import { useLocale } from "../contexts/LocaleContext";
import type { Player } from "../types";
import { api, formatEuro, roleLabel } from "../services/api";

type EditablePlayer = Omit<Player, "id" | "displayNumber" | "goals" | "initialPrice" | "club">;
const blankPlayer: EditablePlayer = { name: "", number: 1, position: "FIELD_PLAYER", role: "ALA", price: 3000, age: null, nationality: null, photoUrl: null, clubId: "" };

export function AdminPlayersPage() {
  const { user } = useAuth();
  const { t, locale } = useLocale();
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [clubFilter, setClubFilter] = useState("");
  const [drafts, setDrafts] = useState<Record<string, EditablePlayer>>({});
  const [newPlayer, setNewPlayer] = useState<EditablePlayer>(blankPlayer);
  const query = useQuery({ queryKey: ["admin-players"], queryFn: api.adminPlayers, enabled: user?.role === "ADMIN" });
  const save = useMutation({
    mutationFn: ({ id, value }: { id: string; value: EditablePlayer }) => api.updateAdminPlayer(id, value),
    onSuccess: async (updated) => {
      setDrafts(current => { const next = { ...current }; delete next[updated.id]; return next; });
      await client.invalidateQueries();
      toast.success(t("adminPlayers.saved"));
    },
    onError: error => toast.error(error.message),
  });
  const create = useMutation({
    mutationFn: api.createAdminPlayer,
    onSuccess: async (created) => {
      setNewPlayer(current => ({ ...current, name: "", number: current.number + 1 }));
      await client.invalidateQueries();
      toast.success(t("adminPlayers.created", { name: created.name }));
    },
    onError: error => toast.error(error.message),
  });
  const clubs = query.data?.clubs ?? [];
  const filtered = useMemo(() => (query.data?.players ?? []).filter(player =>
    (!clubFilter || player.clubId === clubFilter)
    && `${player.name} ${player.number} ${player.club?.name ?? ""}`.toLocaleLowerCase().includes(search.toLocaleLowerCase().trim())
  ), [query.data?.players, clubFilter, search]);
  if (user?.role !== "ADMIN") return <Navigate to="/" replace />;

  const edit = (player: Player) => drafts[player.id] ?? ({
    name: player.name, number: player.number, position: player.position, role: player.role,
    price: player.price, age: player.age, nationality: player.nationality, photoUrl: player.photoUrl, clubId: player.clubId,
  });
  const setField = <K extends keyof EditablePlayer>(player: Player, key: K, value: EditablePlayer[K]) => {
    setDrafts(current => ({ ...current, [player.id]: { ...edit(player), [key]: value } }));
  };
  const setNewField = <K extends keyof EditablePlayer>(key: K, value: EditablePlayer[K]) => setNewPlayer(current => ({ ...current, [key]: value }));
  const field = (label: string, control: React.ReactNode) => <label className="admin-player-field"><span>{label}</span>{control}</label>;

  return <div className="page admin-page admin-players-page">
    <header className="page-heading">
      <p className="eyebrow">{t("nav.admin")}</p><h1>{t("adminPlayers.title")}</h1>
      <p className="muted">{t("adminPlayers.description")}</p>
      <Link to="/admin">{t("admin.title")} <GoArrowRight className="ui-arrow" aria-hidden="true" /></Link>
    </header>
    <details className="admin-player-create">
      <summary><span><strong>＋ {t("adminPlayers.add")}</strong><small>{t("adminPlayers.addHelp")}</small></span></summary>
      <div className="admin-player-fields admin-player-create__fields">
        {field(t("adminPlayers.name"), <input required maxLength={100} value={newPlayer.name} onChange={event => setNewField("name", event.target.value)} placeholder={t("adminPlayers.namePlaceholder")} />)}
        {field(t("prices.number"), <input required type="number" min="0" max="999" value={newPlayer.number} onChange={event => setNewField("number", Number(event.target.value))} />)}
        {field(t("adminPlayers.club"), <select required value={newPlayer.clubId} onChange={event => setNewField("clubId", event.target.value)}><option value="">{t("adminPlayers.chooseClub")}</option>{clubs.map(club => <option value={club.id} key={club.id}>{club.name}</option>)}</select>)}
        {field(t("adminPlayers.position"), <select value={newPlayer.position} onChange={event => setNewField("position", event.target.value as Player["position"])}><option value="FIELD_PLAYER">{t("prices.field")}</option><option value="GOALKEEPER">{t("prices.goalkeeper")}</option></select>)}
        {field(t("adminPlayers.role"), <select value={newPlayer.role} onChange={event => setNewField("role", event.target.value as Player["role"])}>{(["PORTERA", "CIERRE", "ALA", "PIVOT"] as const).map(role => <option key={role} value={role}>{roleLabel(role, locale)}</option>)}</select>)}
        {field(t("adminPlayers.age"), <input type="number" min="0" max="120" value={newPlayer.age ?? ""} onChange={event => setNewField("age", event.target.value === "" ? null : Number(event.target.value))} />)}
        {field(t("adminPlayers.nationality"), <input maxLength={80} value={newPlayer.nationality ?? ""} onChange={event => setNewField("nationality", event.target.value || null)} />)}
        {field(t("prices.current"), <input required type="number" min="1" step="10000" value={newPlayer.price} onChange={event => setNewField("price", Number(event.target.value))} />)}
        {field(t("adminPlayers.photo"), <input maxLength={1000} value={newPlayer.photoUrl ?? ""} onChange={event => setNewField("photoUrl", event.target.value || null)} />)}
      </div>
      <footer className="admin-player-editor__footer"><span>{t("adminPlayers.requiredHelp")}</span><button className="button" disabled={create.isPending || !newPlayer.name.trim() || !newPlayer.clubId || newPlayer.price <= 0} onClick={() => create.mutate(newPlayer)}>{create.isPending ? t("team.checking") : t("adminPlayers.create")}</button></footer>
    </details>
    <section className="admin-toolbar admin-players-toolbar">
      <input value={search} onChange={event => setSearch(event.target.value)} placeholder={t("adminPlayers.search")} aria-label={t("adminPlayers.search")} />
      <select value={clubFilter} onChange={event => setClubFilter(event.target.value)} aria-label={t("adminStats.allClubs")}>
        <option value="">{t("adminStats.allClubs")}</option>{clubs.map(club => <option value={club.id} key={club.id}>{club.name}</option>)}
      </select>
      <strong className="admin-players-count">{filtered.length} / {query.data?.players.length ?? 0}</strong>
    </section>
    {query.isPending && <p role="status">{t("loading.team")}</p>}
    {query.isError && <p className="state-card state-card--error" role="alert">{t("error.generic")} <button onClick={() => void query.refetch()}>{t("matches.retry")}</button></p>}
    <div className="admin-player-grid">{filtered.map(player => {
      const value = edit(player);
      const changed = Boolean(drafts[player.id]);
      const busy = save.isPending && save.variables?.id === player.id;
      return <article className={`admin-player-editor ${changed ? "is-dirty" : ""}`} key={player.id}>
        <header className="admin-player-editor__head"><div><strong>{player.name}</strong><span>{player.club?.name} · #{player.number}</span></div>{changed && <span className="admin-player-unsaved">{t("adminPlayers.unsaved")}</span>}</header>
        <div className="admin-player-fields">
          {field(t("adminPlayers.name"), <input value={value.name} onChange={event => setField(player, "name", event.target.value)} maxLength={100} />)}
          {field(t("prices.number"), <input type="number" min="0" max="999" value={value.number} onChange={event => setField(player, "number", Number(event.target.value))} />)}
          {field(t("adminPlayers.club"), <select value={value.clubId} onChange={event => setField(player, "clubId", event.target.value)}>{clubs.map(club => <option value={club.id} key={club.id}>{club.name}</option>)}</select>)}
          {field(t("adminPlayers.position"), <select value={value.position} onChange={event => setField(player, "position", event.target.value as Player["position"])}><option value="FIELD_PLAYER">{t("prices.field")}</option><option value="GOALKEEPER">{t("prices.goalkeeper")}</option></select>)}
          {field(t("adminPlayers.role"), <select value={value.role} onChange={event => setField(player, "role", event.target.value as Player["role"])}>{(["PORTERA", "CIERRE", "ALA", "PIVOT"] as const).map(role => <option key={role} value={role}>{roleLabel(role, locale)}</option>)}</select>)}
          {field(t("adminPlayers.age"), <input type="number" min="0" max="120" value={value.age ?? ""} onChange={event => setField(player, "age", event.target.value === "" ? null : Number(event.target.value))} />)}
          {field(t("adminPlayers.nationality"), <input value={value.nationality ?? ""} maxLength={80} onChange={event => setField(player, "nationality", event.target.value || null)} />)}
          {field(t("prices.current"), <input type="number" min="1" step="10000" value={value.price} onChange={event => setField(player, "price", Number(event.target.value))} />)}
          {field(t("adminPlayers.photo"), <input value={value.photoUrl ?? ""} maxLength={1000} onChange={event => setField(player, "photoUrl", event.target.value || null)} />)}
        </div>
        <footer className="admin-player-editor__footer"><span>{formatEuro(value.price, locale)}</span><button className="button" disabled={!changed || busy || !value.name.trim() || value.price <= 0} onClick={() => save.mutate({ id: player.id, value })}>{busy ? t("team.checking") : t("adminPlayers.save")}</button></footer>
      </article>;
    })}</div>
    {!query.isPending && filtered.length === 0 && <p className="state-card">{t("adminPlayers.empty")}</p>}
  </div>;
}
