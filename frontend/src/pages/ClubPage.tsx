import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ClubLogo } from "../components/ClubLogo";
import { positionLabel } from "../services/api";
import { api } from "../services/api";
import { useLocale } from "../contexts/LocaleContext";

export function ClubPage() {
  const { locale, t } = useLocale();
  const { clubId = "" } = useParams();
  const club = useQuery({ queryKey: ["club", clubId], queryFn: () => api.club(clubId) });
  const players = useQuery({ queryKey: ["clubPlayers", clubId], queryFn: () => api.clubPlayers(clubId), enabled: Boolean(clubId) });
  if (club.isLoading || players.isLoading) return <div className="state-card">{t("loading.club")}</div>;
  if (club.isError || players.isError || !club.data) return <div className="state-card state-card--error">{t("error.clubNotFound")}</div>;
  const roster = players.data ?? [];
  return <div className="page page--narrow"><Link className="back-link" to="/teams">← {t("clubs.back")}</Link><header className="club-heading"><ClubLogo club={club.data} large /><div><p className="eyebrow">Primera División Femenina</p><h1>{club.data.name}</h1></div></header><section className="roster-card"><h2>{t("clubs.roster")}</h2>{roster.length === 0 ? <div className="empty-roster">{t("clubs.emptyRoster")}</div> : <div className="roster-list">{roster.map((player) => <div className="roster-row" key={player.id}><span>#{player.number}</span><strong>{player.name}</strong><small>{positionLabel(player.position, locale)}</small></div>)}</div>}</section></div>;
}
