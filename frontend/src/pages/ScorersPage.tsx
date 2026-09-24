import { useQuery } from "@tanstack/react-query";
import { FaRankingStar } from "react-icons/fa6";
import { ClubLogo } from "../components/ClubLogo";
import { Loader } from "../components/Loader";
import { useLocale } from "../contexts/LocaleContext";
import { api } from "../services/api";

export function ScorersPage() {
  const { t } = useLocale();
  const scorers = useQuery({ queryKey: ["scorers"], queryFn: api.scorers, refetchInterval: 30000 });
  return <div className="page page--narrow">
    <header className="page-heading"><h1><FaRankingStar aria-hidden="true" /> {t("scorers.title")}</h1></header>
    {scorers.isPending && <Loader label={t("loading.players")} />}
    {scorers.isError && <p role="alert">{t("error.generic")} <button className="button" onClick={() => void scorers.refetch()}>{t("matches.retry")}</button></p>}
    {scorers.data && <div className="scorers-table-wrap"><table className="scorers-table"><thead><tr><th scope="col">{t("scorers.player")}</th><th scope="col">{t("scorers.team")}</th><th scope="col">{t("adminStats.goals")}</th></tr></thead>
      <tbody>{scorers.data.map(row => <tr key={row.id}><td>{row.name}</td><td><div className="scorer-club"><ClubLogo club={row.club} /><span>{row.club.name}</span></div></td><td><strong>{row.goals}</strong></td></tr>)}</tbody>
    </table>{!scorers.data.length && <p className="state-card">{t("scorers.empty")}</p>}</div>}
  </div>;
}
