import { GoArrowRight } from "react-icons/go";
import { Loader } from "../components/Loader";
import { useState } from "react";
import { PublicLineupModal } from "../components/PublicLineupModal";
import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";
import { useLocale } from "../contexts/LocaleContext";
import { useAuth } from "../contexts/AuthContext";
import { FaTrophy } from "react-icons/fa";

export function LeaderboardPage() {
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);
  const { t } = useLocale();
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const leaderboard = useQuery({
    queryKey: ["overall-leaderboard"],
    queryFn: api.overallLeaderboard,
  });
  const history = useQuery({
    queryKey: ["gameweek-history"],
    queryFn: api.gameweekHistory,
  });
  const selectedHistory = useQuery({
    queryKey: ["admin-user-gameweek-history", selected?.id],
    queryFn: () => api.adminUserGameweekHistory(selected!.id),
    enabled: isAdmin && Boolean(selected?.id),
  });
  const visibleHistory = isAdmin ? selectedHistory.data : history.data;
  return (
    <div className="page">
      {selected && !isAdmin && <PublicLineupModal userId={selected.id} name={selected.name} onClose={() => setSelected(null)} />}
      <header className="page-heading">
        <p className="eyebrow">{t("leaderboard.eyebrow")}</p>
        <h1>{t("leaderboard.title")}</h1>
        <p className="muted">{t("leaderboard.description")}</p>
      </header>
      <div className="admin-stats-grid">
        <section className="admin-card">
          <div className="admin-card__head">
            <h2>{t("leaderboard.overall")}</h2>
            <span>{leaderboard.data?.length ?? 0}</span>
          </div>
          {leaderboard.isPending && <p className="state-card"><Loader label={t("admin.loading")} /></p>}
          {leaderboard.isError && <p className="state-card state-card--error">{t("error.generic")}</p>}
          {leaderboard.data?.length === 0 && <p className="state-card">{t("lineup.rankingEmpty")}</p>}
          {leaderboard.data?.map((row) => (
            <button type="button" className={`leaderboard-row leaderboard-row--interactive leaderboard-row--overall${row.id === user?.id || row.userId === user?.id ? " leaderboard-row--self" : ""}`} key={row.id ?? row.userId} onClick={() => row.id && setSelected({ id: row.id, name: row.name ?? "" })} aria-label={isAdmin ? row.name ?? "" : t("lineup.view", { name: row.name ?? "" })}>
              <b className="leaderboard-position">{(row.rank == null || row.rank > 3) && row.rank}{row.rank != null && row.rank <= 3 && <FaTrophy className="leaderboard-trophy" style={{ color: ["#EAB308", "#9CA3AF", "#B87333"][row.rank - 1] }} aria-label={t("leaderboard.place", { place: row.rank })} />}{row.rankChange != null && <span className={`rank-change ${row.rankChange > 0 ? "price-delta--up" : row.rankChange < 0 ? "price-delta--down" : ""}`} aria-label={t(row.rankChange > 0 ? "leaderboard.movedUp" : row.rankChange < 0 ? "leaderboard.movedDown" : "leaderboard.unchanged", { count: Math.abs(row.rankChange) })}>{row.rankChange === 0 ? "—" : <><GoArrowRight className={`ui-arrow ${row.rankChange > 0 ? "ui-arrow--up" : "ui-arrow--down"}`} aria-hidden="true" />{Math.abs(row.rankChange)}</>}</span>}</b>
              <strong>{row.name}</strong>
              <em>{row.totalPoints} {t("common.pointsShort")} <i aria-hidden="true"><GoArrowRight className="ui-arrow" aria-hidden="true" /></i></em>
            </button>
          ))}
        </section>
        <section className="admin-card">
          <div className="admin-card__head">
            <h2>{t("leaderboard.myGameweeks")}{isAdmin && selected ? ` · ${selected.name}` : ""}</h2>
          </div>
          {isAdmin && !selected && <p className="muted">{t("leaderboard.selectParticipant")}</p>}
          {isAdmin && selectedHistory.isPending && <p className="state-card"><Loader label={t("admin.loading")} /></p>}
          {isAdmin && selectedHistory.isError && <p className="state-card state-card--error">{t("error.generic")}</p>}
          {visibleHistory?.map((row) => (
            <details className="history-row" key={row.id} open={isAdmin && Boolean(selected)}>
              <summary>
                <strong>{t("gameweek.label", { number: row.gameweek.number })}</strong>
                <b>{row.totalPoints} {t("common.pointsShort")}</b>
              </summary>
              {row.breakdown?.map((entry) => (
                <div key={entry.playerId}>
                  <span>
                    {entry.name}
                    {entry.isCaptain ? " 👑" : ""}
                  </span>
                  <b>{entry.points} {t("common.pointsShort")}</b>
                </div>
              ))}
            </details>
          ))}
        </section>
      </div>
    </div>
  );
}
