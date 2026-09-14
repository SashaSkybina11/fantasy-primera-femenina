import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../contexts/AuthContext";
import { useLocale } from "../contexts/LocaleContext";
import { api } from "../services/api";
import { ClubLogo } from "../components/ClubLogo";
import { MatchHeading, pointsBreakdown } from "./ResultsPage";
import type { MatchEditorData, MatchProtocol, MatchRow } from "../types/matches";

export function AdminMatchesPage() {
  const { user } = useAuth(); const { t } = useLocale(); const navigate = useNavigate();
  const [params, setParams] = useSearchParams(); const [homeId, setHome] = useState(""); const [awayId, setAway] = useState(""); const [kickoff, setKickoff] = useState("");
  const enabled = user?.role === "ADMIN";
  const weeks = useQuery({ queryKey: ["match-weeks"], queryFn: api.matchWeeks, enabled });
  const clubs = useQuery({ queryKey: ["clubs"], queryFn: api.clubs, enabled });
  const week = params.get("week") ?? weeks.data?.find(w => new Date(w.endsAt) >= new Date())?.id ?? weeks.data?.at(-1)?.id ?? "";
  const matches = useQuery({ queryKey: ["matches", week], queryFn: () => api.matches(week), enabled: enabled && !!week });
  const create = useMutation({ mutationFn: () => api.createMatch({ gameweekId: week, homeId, awayId, kickoffAt: kickoff ? new Date(kickoff).toISOString() : null }), onSuccess: m => navigate(`/admin/matches/${m.id}`), onError: e => toast.error(e.message) });
  if (!enabled) return <Navigate to="/" replace />;
  const used = new Set(matches.data?.flatMap(m => m.teams.map(team => team.clubId)));
  return <div className="page page--narrow"><header className="page-heading"><p className="eyebrow">{t("nav.admin")}</p><h1>{t("matches.admin")}</h1><p>{t("matches.editorHelp")}</p><Link to="/admin/player-points">{t("matches.legacy")} →</Link><Link to={`/results?week=${week}`}>{t("matches.title")} →</Link></header>
    <select aria-label={t("adminStats.selectGameweek")} value={week} onChange={e => { setParams({ week: e.target.value }); setHome(""); setAway(""); }}>{weeks.data?.map(w => <option key={w.id} value={w.id}>{t("gameweek.label", { number: w.number })} · {t(`gameweek.${w.status}`)}</option>)}</select>
    {(weeks.isPending || clubs.isPending || matches.isPending) && <p role="status">{t("matches.loading")}</p>}
    {(weeks.isError || clubs.isError || matches.isError) && <p role="alert">{t("matches.error")} <button onClick={() => { void weeks.refetch(); void clubs.refetch(); if (week) void matches.refetch(); }}>{t("matches.retry")}</button></p>}
    <form className="admin-card match-create" onSubmit={e => { e.preventDefault(); create.mutate(); }}><h2>{t("matches.create")}</h2><div className="match-create-fields">{(["home", "away"] as const).map(side => <label key={side}>{t(`matches.${side}`)}<select required value={side === "home" ? homeId : awayId} onChange={e => side === "home" ? setHome(e.target.value) : setAway(e.target.value)}><option value="">—</option>{clubs.data?.filter(c => !used.has(c.id) && c.id !== (side === "home" ? awayId : homeId)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>)}<label>{t("matches.kickoff")}<input type="datetime-local" value={kickoff} onChange={e => setKickoff(e.target.value)} /></label></div><button className="button" disabled={!week || !homeId || !awayId || create.isPending || matches.isPending || matches.isError || clubs.isError || weeks.isError || weeks.data?.find(w => w.id === week)?.status === "COMPLETED"}>{t("matches.create")}</button></form>
    {matches.data?.length === 0 && <p className="state-card">{t("matches.empty")}</p>}<div className="match-list">{matches.data?.map(m => <Link className="match-card" key={m.id} to={`/admin/matches/${m.id}`}><MatchHeading match={m} /><span className="match-card-footer">{t(m.published ? "matches.published" : "matches.draft")}<span>{t("matches.edit")} →</span></span></Link>)}</div>
  </div>;
}
export function AdminMatchEditorPage() {
  const { id = "" } = useParams(); const { user } = useAuth(); const { t } = useLocale();
  const query = useQuery({ queryKey: ["match-editor", id], queryFn: () => api.matchEditor(id), enabled: user?.role === "ADMIN", refetchOnWindowFocus: false });
  if (user?.role !== "ADMIN") return <Navigate to="/" replace />;
  if (query.isPending) return <div className="page" role="status">{t("matches.loading")}</div>;
  if (!query.data) return <div className="page" role="alert">{t("matches.error")} <button onClick={() => void query.refetch()}>{t("matches.retry")}</button></div>;
  return <MatchEditor key={`${id}-${query.data.match.version}`} data={query.data} />;
}
function localDate(value: string | null) { if (!value) return ""; const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
function MatchEditor({ data }: { data: MatchEditorData }) {
  const { t } = useLocale(); const client = useQueryClient(); const navigate = useNavigate();
  const [protocol, setProtocol] = useState<MatchProtocol>(data.protocol); const [kickoff, setKickoff] = useState(localDate(data.match.kickoffAt)); const [dirty, setDirty] = useState(false);
  const rules = useQuery({ queryKey: ["scoring-rules"], queryFn: api.scoringRules });
  const locked = data.match.gameweek.status === "COMPLETED";
  useEffect(() => { const guard = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } }; window.addEventListener("beforeunload", guard); return () => window.removeEventListener("beforeunload", guard); }, [dirty]);
  useEffect(() => { const guard = (e: MouseEvent) => { if (dirty && (e.target as Element).closest("a[href]") && !window.confirm(t("matches.leave"))) { e.preventDefault(); e.stopPropagation(); } }; document.addEventListener("click", guard, true); return () => document.removeEventListener("click", guard, true); }, [dirty, t]);
  const save = useMutation({ mutationFn: (publish: boolean) => api.saveMatch(data.match.id, { protocol, publish, version: data.match.version, kickoffAt: kickoff ? new Date(kickoff).toISOString() : null }), onSuccess: (_m, publish) => { setDirty(false); toast.success(t(publish ? "matches.done" : "matches.saved")); void client.invalidateQueries(); }, onError: e => toast.error(e.message) });
  const remove = useMutation({ mutationFn: () => api.deleteMatch(data.match.id), onSuccess: () => { setDirty(false); void client.invalidateQueries(); navigate(`/admin/matches?week=${data.match.gameweekId}`); }, onError: e => toast.error(e.message) });
  const update = (playerId: string, patch: Partial<MatchRow>) => { setDirty(true); setProtocol(old => ({ ...old, players: old.players.map(p => p.playerId === playerId ? { ...p, ...patch } : p) })); };
  const numberField = (key: "homeScore" | "awayScore" | "homeOwnGoals" | "awayOwnGoals", value: string) => { setDirty(true); setProtocol(old => ({ ...old, [key]: value === "" && key.endsWith("Score") ? null : Math.max(0, Math.min(99, Math.trunc(Number(value)))) })); };
  return <div className="page match-editor"><Link to={`/admin/matches?week=${data.match.gameweekId}`}>← {t("matches.admin")}</Link><header className="page-heading"><p className="eyebrow">{t("gameweek.label", { number: data.match.gameweek.number })}</p><h1>{t("matches.report")}</h1><p>{t("matches.editorHelp")}</p><Link to={`/results/${data.match.id}`}>{t("matches.report")} →</Link></header>{locked && <p className="state-card">{t("matches.locked")}</p>}
    <fieldset disabled={locked || save.isPending || remove.isPending} className="match-fieldset"><div className="admin-card match-score-inputs">{data.match.teams.map(team => <label key={team.clubId}><span className="match-team-title"><ClubLogo club={team.club} />{team.club.name}</span><input aria-label={team.club.name} type="number" min="0" max="99" value={protocol[team.side === "home" ? "homeScore" : "awayScore"] ?? ""} onChange={e => numberField(team.side === "home" ? "homeScore" : "awayScore", e.target.value)} /></label>)}<label>{t("matches.kickoff")}<input type="datetime-local" value={kickoff} onChange={e => { setKickoff(e.target.value); setDirty(true); }} /></label></div>
    <div className="match-teams">{data.match.teams.map(team => {
      const roster = data.roster.filter(p => p.clubId === team.clubId); const starters = protocol.players.filter(p => p.started && roster.some(r => r.id === p.playerId)); const keepers = starters.filter(p => roster.find(r => r.id === p.playerId)?.position === "GOALKEEPER").length;
      return <section className="admin-card" key={team.clubId}><h2 className="match-team-title"><ClubLogo club={team.club} />{team.club.name}</h2><p className={starters.length === 5 && keepers === 1 ? "match-valid" : "muted"}>{t("matches.count", { count: starters.length, keepers })}</p><button type="button" className="button button--secondary" disabled={!data.previousStarters[team.clubId]?.length} title={!data.previousStarters[team.clubId]?.length ? t("matches.noPrevious") : t("matches.previous")} onClick={() => { setDirty(true); setProtocol(old => ({ ...old, players: old.players.map(p => roster.some(r => r.id === p.playerId) ? { ...p, started: data.previousStarters[team.clubId].includes(p.playerId) } : p) })); }}>{t("matches.previous")}</button>
        <div className="match-roster">{roster.map(player => {
          const row = protocol.players.find(p => p.playerId === player.id); if (!row) return null;
          const own = protocol[team.side === "home" ? "homeScore" : "awayScore"]; const other = protocol[team.side === "home" ? "awayScore" : "homeScore"];
          const points = rules.data && own !== null && other !== null ? Object.values(pointsBreakdown({ ...row, position: player.position, adjustmentPoints: player.gameweekStats[0]?.adjustmentPoints ?? 0, result: own === other ? "DRAW" : own > other ? "WIN" : "LOSS" }, rules.data)).reduce((a, b) => a + b, 0) : null;
          return <div className={`match-edit-player ${row.started ? "is-starter" : ""}`} key={player.id}><div className="match-player-top"><label><input type="checkbox" checked={row.started} disabled={!row.started && (starters.length >= 5 || (player.position === "GOALKEEPER" && keepers >= 1))} onChange={e => update(player.id, { started: e.target.checked })} /><span><strong>#{player.number} · {player.name}</strong><small>{t("adminStats.started")}{player.position === "GOALKEEPER" ? " · 🧤" : ""}</small></span></label><span title={t("matches.points")}>{points ?? "—"} {t("common.pointsShort")}</span></div><div className="match-counters">{(["goals", "yellowCards", "redCards"] as const).map(key => <label key={key}><span>{t(`adminStats.${key}`)}</span><span className="match-stepper"><button type="button" aria-label={`${t(`adminStats.${key}`)} − ${player.name}`} disabled={row[key] <= 0} onClick={() => update(player.id, { [key]: row[key] - 1 })}>−</button><input aria-label={`${t(`adminStats.${key}`)} · ${player.name}`} type="number" min="0" max={key === "goals" ? 99 : key === "yellowCards" ? 2 : 1} value={row[key]} onChange={e => update(player.id, { [key]: Math.max(0, Math.min(key === "goals" ? 99 : key === "yellowCards" ? 2 : 1, Math.trunc(Number(e.target.value)))) })} /><button type="button" aria-label={`${t(`adminStats.${key}`)} + ${player.name}`} disabled={row[key] >= (key === "goals" ? 99 : key === "yellowCards" ? 2 : 1)} onClick={() => update(player.id, { [key]: row[key] + 1 })}>+</button></span></label>)}</div>{player.position === "GOALKEEPER" && <label className="match-conceded">{t("adminStats.goalsConceded")}<input type="number" min="0" max="99" value={row.goalsConceded ?? ""} onChange={e => update(player.id, { goalsConceded: e.target.value === "" ? null : Math.max(0, Math.min(99, Math.trunc(Number(e.target.value)))) })} /></label>}</div>;
        })}</div><label>{t("matches.ownGoals")}<input type="number" min="0" max="99" value={protocol[team.side === "home" ? "homeOwnGoals" : "awayOwnGoals"]} onChange={e => numberField(team.side === "home" ? "homeOwnGoals" : "awayOwnGoals", e.target.value)} /></label><p className="muted">{t("matches.ownHelp")}</p>
      </section>;
    })}</div><div className="match-save-bar">{!data.match.publishedAt && <button type="button" className="button button--secondary" onClick={() => { if (window.confirm(t("matches.removeConfirm"))) remove.mutate(); }}>{t("matches.remove")}</button>}<p>{dirty ? t("matches.dirty") : t("matches.scoreHelp")}</p><button type="button" className="button button--secondary" onClick={() => save.mutate(false)}>{t("matches.save")}</button><button type="button" className="button" onClick={() => save.mutate(true)}>{t("matches.publish")}</button></div></fieldset>
  </div>;
}
