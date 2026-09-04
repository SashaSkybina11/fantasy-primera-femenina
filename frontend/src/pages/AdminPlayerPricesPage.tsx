import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Navigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../contexts/AuthContext";
import { useLocale } from "../contexts/LocaleContext";
import { api, type PricePreview } from "../services/api";

export function AdminPlayerPricesPage() {
  const { user } = useAuth();
  const { t, locale } = useLocale();
  const client = useQueryClient();
  const [gameweekId, setGameweekId] = useState("");
  const [search, setSearch] = useState("");
  const [club, setClub] = useState("");
  const [bonus, setBonus] = useState<string | null>(null);
  const [preview, setPreview] = useState<PricePreview | null>(null);
  const enabled = user?.role === "ADMIN";
  const weeks = useQuery({ queryKey: ["admin-gameweeks"], queryFn: api.adminGameweeks, enabled });
  const settings = useQuery({ queryKey: ["price-settings"], queryFn: api.priceSettings, enabled });
  const players = useQuery({ queryKey: ["admin-player-points"], queryFn: () => api.adminPlayerPoints(), enabled });
  const saveSettings = useMutation({
    mutationFn: () => api.savePriceSettings(bonus === "" ? null : Number(bonus ?? settings.data?.teamWin)),
    onSuccess: () => { setPreview(null); setBonus(null); void client.invalidateQueries({ queryKey: ["price-settings"] }); toast.success(t("prices.saveSettings")); },
    onError: error => toast.error(error.message),
  });
  const calculate = useMutation({ mutationFn: api.previewPrices, onSuccess: setPreview, onError: error => toast.error(error.message) });
  const apply = useMutation({
    mutationFn: (value: PricePreview) => api.applyPrices(value.gameweekId, value.revision),
    onSuccess: () => { setPreview(null); void client.invalidateQueries(); toast.success(t("prices.applied")); },
    onError: error => { setPreview(null); toast.error(error.message); },
  });
  if (!enabled) return <Navigate to="/" replace />;
  const money = (value: number) => new Intl.NumberFormat(locale === "uk" ? "uk-UA" : "es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
  const delta = (value: number) => `${value > 0 ? "+" : ""}${money(value)}`;
  const matches = (row: { name: string; number: number; clubId: string }) => (!club || row.clubId === club) && `${row.name} ${row.number}`.toLocaleLowerCase().includes(search.toLocaleLowerCase());
  const current = weeks.data?.find(row => row.id === gameweekId);
  const busy = calculate.isPending || apply.isPending || saveSettings.isPending;
  const components = [
    ["goalsDelta", "adminStats.goals"], ["startedDelta", "adminStats.started"],
    ["teamResultDelta", "adminStats.win"], ["yellowCardsDelta", "adminStats.yellowCards"],
    ["redCardsDelta", "adminStats.redCards"], ["goalkeeperDelta", "prices.goalkeeperDelta"],
  ] as const;
  return <div className="page admin-prices">
    <header className="page-heading"><p className="eyebrow">{t("nav.admin")}</p><h1>{t("prices.title")}</h1><Link to="/admin/player-points">{t("adminStats.title")} →</Link></header>
    <section className="admin-card price-settings">
      <label>{t("prices.teamWin")}<input type="number" min="0" max="100000" value={bonus ?? settings.data?.teamWin ?? ""} onChange={e => { setBonus(e.target.value); setPreview(null); }} /></label>
      <p className="muted">{t("prices.settingsHint")}</p>
      <button className="button button--secondary" disabled={busy || bonus === null} onClick={() => saveSettings.mutate()}>{t("prices.saveSettings")}</button>
    </section>
    <section className="admin-toolbar">
      <select aria-label={t("adminStats.selectGameweek")} value={gameweekId} disabled={busy} onChange={e => { setGameweekId(e.target.value); setPreview(null); }}><option value="">{t("adminStats.selectGameweek")}</option>{weeks.data?.map(row => <option key={row.id} value={row.id}>{row.name} · {t(`gameweek.${row.status}`)}</option>)}</select>
      <input aria-label={t("adminStats.searchPlaceholder")} placeholder={t("adminStats.searchPlaceholder")} value={search} onChange={e => setSearch(e.target.value)} />
      <select aria-label={t("adminStats.allClubs")} value={club} onChange={e => setClub(e.target.value)}><option value="">{t("adminStats.allClubs")}</option>{Array.from(new Map(players.data?.map(row => [row.clubId, row.club?.name]) ?? [])).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
      <button className="button" disabled={!gameweekId || busy || bonus !== null} onClick={() => { setPreview(null); calculate.mutate(gameweekId); }}>{t("prices.calculate")}</button>
    </section>
    {(players.isError || weeks.isError || settings.isError) && <p role="alert">{t("error.generic")}</p>}
    <div className="price-table-scroll"><table className="price-table"><thead><tr>{(["prices.number", "adminStats.players", "adminStats.allClubs", "prices.position", "prices.current", "prices.lastDelta", "prices.new"] as const).map(key => <th key={key}>{t(key)}</th>)}</tr></thead><tbody>
      {players.data?.filter(matches).map(row => { const calculated = preview?.rows.find(item => item.playerId === row.id); return <tr key={row.id}><td>№{row.number}</td><td>{row.name}</td><td>{row.club?.name}</td><td>{t(row.position === "GOALKEEPER" ? "prices.goalkeeper" : "prices.field")}</td><td>{money(row.price)}</td><td>{delta(row.lastPriceDelta)}</td><td>{calculated ? money(calculated.newCurrentPrice) : "—"}</td></tr>; })}
    </tbody></table></div>
    {preview && <>
      {current?.status !== "COMPLETED" && <p>{t("prices.completeFirst")}</p>}
      <button className="button" disabled={busy || current?.status !== "COMPLETED"} onClick={() => apply.mutate(preview)}>{t("prices.apply")}</button>
      <div className="price-preview-grid">{preview.rows.filter(matches).map(row => <article className="admin-card" key={row.playerId}>
        <h2>№{row.number} — {row.name}</h2><p>{row.club}</p>
        {row.applied && <p className="muted">{t("prices.recorded")}</p>}{row.missingStats && <p className="muted">{t("prices.missingStats")}</p>}
        <dl><dt>{t("prices.before")}</dt><dd>{money(row.priceBefore)}</dd></dl>
        {components.map(([key, label]) => <dl key={key}><dt>{t(label)}</dt><dd>{delta(row[key])}</dd></dl>)}
        <dl><dt>{t("prices.delta")}</dt><dd>{delta(row.priceDelta)}</dd><dt>{t("prices.new")}</dt><dd><strong>{money(row.priceAfter)}</strong></dd></dl>
      </article>)}</div>
    </>}
  </div>;
}
