import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ClubLogo } from "../components/ClubLogo";
import type { Player, PlayerRole } from "../types";
import { playerFactsLabel, roleLabel } from "../services/api";
import { api } from "../services/api";
import { useLocale } from "../contexts/LocaleContext";

const roleOrder: PlayerRole[] = ["PORTERA", "CIERRE", "ALA", "PIVOT"];

export function ClubPage() {
  const { locale, t } = useLocale();
  const { clubId = "" } = useParams();
  const club = useQuery({ queryKey: ["club", clubId], queryFn: () => api.club(clubId) });
  const players = useQuery({ queryKey: ["clubPlayers", clubId], queryFn: () => api.clubPlayers(clubId), enabled: Boolean(clubId) });
  if (club.isLoading || players.isLoading) return <div className="state-card">{t("loading.club")}</div>;
  if (club.isError || players.isError || !club.data) return <div className="state-card state-card--error">{t("error.clubNotFound")}</div>;
  const roster = players.data ?? [];
  const groupedRoster = roleOrder
    .map((role) => ({
      role,
      players: roster.filter((player) => player.role === role),
    }))
    .filter((group) => group.players.length > 0);

  return <div className="page page--narrow"><Link className="back-link" to="/teams">← {t("clubs.back")}</Link><header className="club-heading"><ClubLogo club={club.data} large /><div><p className="eyebrow">Primera División Femenina</p><h1>{club.data.name}</h1></div></header><section className="club-meta-grid"><article className="club-meta-card"><span>{t("club.coach")}</span><strong>{club.data.coach ?? "-"}</strong></article><article className="club-meta-card"><span>{t("club.president")}</span><strong>{club.data.president ?? "-"}</strong></article></section><section className="roster-card"><h2>{t("clubs.roster")}</h2>{roster.length === 0 ? <div className="empty-roster">{t("clubs.emptyRoster")}</div> : groupedRoster.map((group) => <div className="roster-group" key={group.role}><div className="roster-group__head"><h3>{roleLabel(group.role, locale)}</h3><span>{group.players.length}</span></div><div className="roster-list">{group.players.map((player: Player) => <div className="roster-row" key={player.id}><span>#{player.displayNumber ?? player.number}</span><div className="roster-row__main"><strong>{player.name}</strong><small>{playerFactsLabel(player, locale)}</small></div></div>)}</div></div>)}</section></div>;
}
