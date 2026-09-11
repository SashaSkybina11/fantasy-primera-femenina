import { Loader } from "../components/Loader";
import { useState } from "react";
import { PublicLineupModal } from "../components/PublicLineupModal";
import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";
import { useLocale } from "../contexts/LocaleContext";

export function LeaderboardPage() {
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);
  const { t } = useLocale();
  const leaderboard = useQuery({
    queryKey: ["overall-leaderboard"],
    queryFn: api.overallLeaderboard,
  });
  const history = useQuery({
    queryKey: ["gameweek-history"],
    queryFn: api.gameweekHistory,
  });
  return (
    <div className="page">
      {selected && <PublicLineupModal userId={selected.id} name={selected.name} onClose={() => setSelected(null)} />}
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
            <button type="button" className="leaderboard-row leaderboard-row--interactive" key={row.id} onClick={() => row.id && setSelected({ id: row.id, name: row.name ?? "" })} aria-label={t("lineup.view", { name: row.name ?? "" })}>
              <b>{row.rank}</b>
              <strong>{row.name}</strong>
              <span>{row.lastGameweekPoints} {t("common.pointsShort")}</span>
              <em>{row.totalPoints} {t("common.pointsShort")} <i aria-hidden="true">›</i></em>
            </button>
          ))}
        </section>
        <section className="admin-card">
          <div className="admin-card__head">
            <h2>{t("leaderboard.myGameweeks")}</h2>
          </div>
          {history.data?.map((row) => (
            <details className="history-row" key={row.id}>
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
