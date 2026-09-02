import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { Avatar } from "../components/Avatar";
import { SquadSection } from "../components/SquadSection";
import { api } from "../services/api";
import { useLocale } from "../contexts/LocaleContext";

export function MemberTeamPage() {
  const { t } = useLocale();
  const { userId = "" } = useParams();
  const [compare, setCompare] = useState(false);
  const member = useQuery({ queryKey: ["member", userId], queryFn: () => api.member(userId) });
  const ownTeam = useQuery({ queryKey: ["team"], queryFn: api.team });
  if (member.isLoading || ownTeam.isLoading) return <div className="state-card">{t("loading.team")}</div>;
  if (member.isError || ownTeam.isError || !member.data || !ownTeam.data) return <div className="state-card state-card--error">{t("error.memberNotFound")}</div>;
  const players = member.data.fantasyTeam.players;
  const starterPlayers = players.filter((entry) => entry.status === "STARTER");
  const benchPlayers = players.filter((entry) => entry.status === "BENCH");
  const ownIds = new Set(ownTeam.data.players.map((entry) => entry.playerId));
  const otherIds = new Set(players.map((entry) => entry.playerId));
  const common = ownTeam.data.players.filter((entry) => otherIds.has(entry.playerId));
  const onlyOwn = ownTeam.data.players.filter((entry) => !otherIds.has(entry.playerId));
  const onlyOther = players.filter((entry) => !ownIds.has(entry.playerId));
  const comparisonGroup = (title: string, names: string[]) => <div className="comparison-group"><h3>{title}</h3>{names.length ? <ul>{names.map((name, index) => <li key={`${name}-${index}`}>{name}</li>)}</ul> : <p>{t("member.noPlayers")}</p>}</div>;
  return <div className="page"><Link className="back-link" to="/league">← {t("member.back")}</Link><header className="member-heading"><Avatar name={member.data.name} src={member.data.avatarUrl} size="lg" /><div><p className="eyebrow">{t("team.eyebrow")}</p><h1>{member.data.fantasyTeam.name}</h1><p>{member.data.name}</p></div><button className="button button--secondary" onClick={() => setCompare(!compare)}>{compare ? t("member.hideComparison") : t("member.compare")}</button></header>{compare && <section className="comparison-card"><h2>{t("member.comparison")}</h2><div>{comparisonGroup(t("member.common"), common.map((entry) => entry.player.name))}{comparisonGroup(t("member.onlyMine"), onlyOwn.map((entry) => entry.player.name))}{comparisonGroup(t("member.onlyTheirs", { name: member.data.name }), onlyOther.map((entry) => entry.player.name))}</div></section>}<div className="team-grid"><SquadSection title={t("team.starters")} subtitle={t("member.memberSquad")} status="STARTER" players={starterPlayers} readOnly /><SquadSection title={t("team.bench")} subtitle={t("member.memberSquad")} status="BENCH" players={benchPlayers} readOnly /></div></div>;
}
