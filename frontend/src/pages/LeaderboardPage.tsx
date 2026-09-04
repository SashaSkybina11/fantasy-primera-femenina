import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";
import { useLocale } from "../contexts/LocaleContext";

export function LeaderboardPage() {
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
          {leaderboard.data?.map((row) => (
            <div className="leaderboard-row" key={row.id}>
              <b>{row.rank}</b>
              <strong>{row.name}</strong>
              <span>{row.lastGameweekPoints} {t("common.pointsShort")}</span>
              <em>{row.totalPoints} {t("common.pointsShort")}</em>
            </div>
          ))}
        </section>
        <section className="admin-card">
          <div className="admin-card__head">
            <h2>{t("leaderboard.myGameweeks")}</h2>
          </div>
          {history.data?.map((row) => (
            <details className="history-row" key={row.id}>
              <summary>
                <strong>{row.gameweek.name}</strong>
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
