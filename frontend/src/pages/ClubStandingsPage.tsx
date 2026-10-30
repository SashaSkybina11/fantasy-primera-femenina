import { useQuery } from "@tanstack/react-query";
import { FaRankingStar } from "react-icons/fa6";
import { ClubLogo } from "../components/ClubLogo";
import { Loader } from "../components/Loader";
import { useLocale } from "../contexts/LocaleContext";
import { api } from "../services/api";

export function ClubStandingsPage() {
  const { t } = useLocale();
  const standings = useQuery({ queryKey: ["club-standings"], queryFn: api.clubStandings, refetchInterval: 30000 });
  return <div className="page club-standings-page">
    <header className="page-heading"><p className="eyebrow">{t("competition.title")}</p><h1><FaRankingStar aria-hidden="true" /> {t("calendar.standingsTitle")}</h1></header>
    {standings.isPending && <p className="state-card"><Loader label={t("loading.players")} /></p>}
    {standings.isError && <p className="state-card state-card--error" role="alert">{t("error.generic")} <button className="button button--secondary" onClick={() => void standings.refetch()}>{t("matches.retry")}</button></p>}
    {standings.data && <>
      <div className="club-standings-table-wrap"><table className="club-standings-table"><thead><tr>
        <th scope="col">{t("standings.position")}</th><th scope="col">{t("standings.team")}</th><th scope="col" className="club-standings-points">{t("standings.points")}</th><th scope="col">{t("standings.played")}</th><th scope="col">{t("standings.wins")}</th><th scope="col">{t("standings.draws")}</th><th scope="col">{t("standings.losses")}</th><th scope="col">{t("standings.goalsFor")}</th><th scope="col">{t("standings.goalsAgainst")}</th>
      </tr></thead><tbody>{standings.data.map((club) => <tr key={club.id} className={club.rank <= 4 ? "is-playoff" : club.rank > standings.data!.length - 3 ? "is-relegation" : ""}>
        <td className="club-standings-rank"><span>{club.rank}</span></td><td><div className="club-standings-team"><ClubLogo club={club} /><span>{club.name}</span></div></td><td className="club-standings-points"><strong>{club.points}</strong></td><td>{club.played}</td><td>{club.wins}</td><td>{club.draws}</td><td>{club.losses}</td><td>{club.goalsFor}</td><td>{club.goalsAgainst}</td>
      </tr>)}</tbody></table>{!standings.data.length && <p className="state-card">{t("standings.empty")}</p>}</div>
      <div className="club-standings-legend"><div><span className="club-standings-legend__swatch is-playoff" /><p><strong>{t("standings.playoff")}</strong> {t("standings.playoffDescription")}</p></div><div><span className="club-standings-legend__swatch is-relegation" /><p><strong>{t("standings.relegation")}</strong> {t("standings.relegationDescription")}</p></div></div>
    </>}
  </div>;
}
