import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../services/api";
import { useLocale } from "../contexts/LocaleContext";
import { useAuth } from "../contexts/AuthContext";
import { ClubLogo } from "../components/ClubLogo";
import type { MatchRecord, MatchRow } from "../types/matches";

export function MatchHeading({ match }: { match: MatchRecord }) {
  const home = match.teams.find(t => t.side === "home")!;
  const away = match.teams.find(t => t.side === "away")!;
  const score = match.published ?? match.reportedResult;
  return <div className="match-score"><div><ClubLogo club={home.club} /><strong>{home.club.name}</strong></div><b>{score ? `${score.homeScore} : ${score.awayScore}` : "— : —"}</b><div><ClubLogo club={away.club} /><strong>{away.club.name}</strong></div></div>;
}
export function ResultsPage() {
  const { t, locale } = useLocale(); const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const weeks = useQuery({ queryKey: ["match-weeks"], queryFn: api.matchWeeks });
  const week = params.get("week") ?? weeks.data?.find(w => new Date(w.endsAt) >= new Date())?.id ?? weeks.data?.at(-1)?.id ?? "";
  const matches = useQuery({ queryKey: ["matches", week], queryFn: () => api.matches(week), enabled: !!week });
  const index = weeks.data?.findIndex(w => w.id === week) ?? -1;
  return <div className="page page--narrow"><header className="page-heading"><p className="eyebrow">{t("competition.title")}</p><h1>{t("matches.title")}</h1><p>{t("matches.intro")}</p>{user?.role === "ADMIN" && <Link to={`/admin/matches?week=${week}`}>{t("matches.admin")} →</Link>}</header>
    <div className="match-week-picker"><button className="button button--secondary" aria-label={t("matches.back")} disabled={index <= 0} onClick={() => setParams({ week: weeks.data![index - 1].id })}>←</button><select aria-label={t("adminStats.selectGameweek")} value={week} onChange={e => setParams({ week: e.target.value })}>{weeks.data?.map(w => <option key={w.id} value={w.id}>{t("gameweek.label", { number: w.number })}</option>)}</select><button className="button button--secondary" aria-label={t("adminStats.selectGameweek")} disabled={index < 0 || index >= (weeks.data?.length ?? 0) - 1} onClick={() => setParams({ week: weeks.data![index + 1].id })}>→</button></div>
    {(weeks.isPending || (!!week && matches.isPending)) && <p role="status">{t("matches.loading")}</p>}
    {(weeks.isError || matches.isError) && <p role="alert">{t("matches.error")} <button onClick={() => { void weeks.refetch(); if (week) void matches.refetch(); }}>{t("matches.retry")}</button></p>}
    {matches.data?.length === 0 && <p className="state-card">{t("matches.empty")}</p>}
    <div className="match-list">{matches.data?.map(match => {
      const scoreOnly = !!match.reportedResult && !match.published;
      const content = <><small>{match.kickoffAt ? new Date(match.kickoffAt).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Madrid" }) : match.reportedResult?.date ? new Date(match.reportedResult.date + "T12:00:00").toLocaleDateString(locale, { dateStyle: "medium" }) : t("matches.unscheduled")}</small><MatchHeading match={match} />{!scoreOnly && <span className="match-card-footer">{match.published ? t("matches.published") : t("matches.pending")}<span>{t("matches.report")} →</span></span>}</>;
      return scoreOnly ? <article className="match-card" key={match.id}>{content}</article> : <Link className="match-card" to={`/results/${match.id}`} key={match.id}>{content}</Link>;
    })}</div>
  </div>;
}
export function pointsBreakdown(row: MatchRow, rules: Record<string, number>) {
  return { started: row.started ? rules.started : 0, result: row.result === "WIN" ? rules.win : row.result === "DRAW" ? rules.draw : 0, goals: row.goals * (row.position === "GOALKEEPER" ? rules.goalkeeperGoal : rules.fieldGoal), hatTrick: row.goals >= 3 ? rules.hatTrickBonus : 0, cleanSheet: row.position === "GOALKEEPER" && row.goalsConceded === 0 ? rules.goalkeeperCleanSheet : 0, yellow: row.yellowCards * rules.yellowCard, red: row.redCards * rules.redCard, adjustment: row.adjustmentPoints ?? 0 };
}
export function MatchReportPage() {
  const { id = "" } = useParams(); const { t, locale } = useLocale(); const { user } = useAuth();
  const query = useQuery({ queryKey: ["match", id], queryFn: () => api.match(id) });
  const rules = useQuery({ queryKey: ["scoring-rules"], queryFn: api.scoringRules });
  if (query.isPending) return <div className="page" role="status">{t("matches.loading")}</div>;
  if (!query.data) return <div className="page" role="alert">{t("matches.error")} <button onClick={() => void query.refetch()}>{t("matches.retry")}</button></div>;
  const match = query.data;
  return <div className="page match-report"><Link to={`/results?week=${match.gameweekId}`}>← {t("matches.back")}</Link><header className="page-heading"><p className="eyebrow">{t("gameweek.label", { number: match.gameweek.number })}</p><h1>{t("matches.report")}</h1>{match.kickoffAt && <p>{new Date(match.kickoffAt).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })}</p>}</header><section className="match-card"><MatchHeading match={match} /></section>
    {user?.role === "ADMIN" && <Link className="button button--secondary" to={`/admin/matches/${id}`}>{t("matches.edit")}</Link>}
    {!match.published ? <p className="state-card">{t(match.reportedResult ? "matches.scoreOnly" : "matches.pending")}</p> : <div className="match-teams">{match.teams.map(team => <section className="admin-card" key={team.clubId}><h2 className="match-team-title"><ClubLogo club={team.club} />{team.club.name}</h2>{[true, false].map(started => <div key={String(started)}><h3 className="match-group-title">{t(started ? "matches.starters" : "matches.others")}</h3>{match.published!.players.filter(p => p.clubId === team.clubId && p.started === started && (started || p.goals || p.yellowCards || p.redCards || p.goalsConceded !== null)).map(row => <div className="protocol-player" key={row.playerId}><div><strong>#{row.number} · {row.name}</strong><div className="protocol-events">{row.goals > 0 && <span title={t("adminStats.goals")}>⚽ {row.goals}</span>}{row.yellowCards > 0 && <span title={t("adminStats.yellowCards")}>🟨 {row.yellowCards}</span>}{row.redCards > 0 && <span title={t("adminStats.redCards")}>🟥 {row.redCards}</span>}{row.goalsConceded !== null && <span>{t("adminStats.goalsConceded")}: {row.goalsConceded}</span>}</div></div><details><summary>{row.totalPoints} {t("common.pointsShort")}</summary><dl aria-label={t("matches.breakdown")}>{rules.data && Object.entries(pointsBreakdown(row, rules.data)).filter(([, value]) => value !== 0).map(([key, value]) => <div key={key}><dt>{t(({ started: "adminStats.started", result: "matches.result", goals: "adminStats.goals", hatTrick: "matches.hatTrick", cleanSheet: "matches.cleanSheet", yellow: "adminStats.yellowCards", red: "adminStats.redCards", adjustment: "matches.adjustment" } as const)[key as keyof ReturnType<typeof pointsBreakdown>])}</dt><dd>{value > 0 ? "+" : ""}{value}</dd></div>)}</dl></details></div>)}</div>)}<p>{t("matches.ownGoals")}: {team.side === "home" ? match.published!.homeOwnGoals : match.published!.awayOwnGoals}</p></section>)}</div>}
  </div>;
}
