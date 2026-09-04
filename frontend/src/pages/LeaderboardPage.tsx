import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";

export function LeaderboardPage() {
  const leaderboard = useQuery({ queryKey: ["overall-leaderboard"], queryFn: api.overallLeaderboard });
  const history = useQuery({ queryKey: ["gameweek-history"], queryFn: api.gameweekHistory });
  return <div className="page"><header className="page-heading"><p className="eyebrow">Fantasy</p><h1>Рейтинг сезона</h1><p className="muted">Общий результат и история ваших недельных туров.</p></header><div className="admin-stats-grid"><section className="admin-card"><div className="admin-card__head"><h2>Общий рейтинг</h2><span>{leaderboard.data?.length ?? 0}</span></div>{leaderboard.data?.map((row) => <div className="leaderboard-row" key={row.id}><b>{row.rank}</b><strong>{row.name}</strong><span>{row.lastGameweekPoints} pts</span><em>{row.totalPoints} pts</em></div>)}</section><section className="admin-card"><div className="admin-card__head"><h2>Мои туры</h2></div>{history.data?.map((row) => <details className="history-row" key={row.id}><summary><strong>{row.gameweek.name}</strong><b>{row.totalPoints} pts</b></summary>{row.breakdown?.map((entry) => <div key={entry.playerId}><span>{entry.name}{entry.isCaptain ? " 👑" : ""}</span><b>{entry.points} pts</b></div>)}</details>)}</section></div></div>;
}
