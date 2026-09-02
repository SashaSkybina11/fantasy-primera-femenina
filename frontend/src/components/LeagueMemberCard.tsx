import { Link } from "react-router-dom";
import type { LeagueMember } from "../types";
import { Avatar } from "./Avatar";
import { useLocale } from "../contexts/LocaleContext";

export function LeagueMemberCard({ member, isCurrentUser }: { member: LeagueMember; isCurrentUser: boolean }) {
  const { t } = useLocale();
  return <Link className="league-member-card" to={`/league/member/${member.id}`}><Avatar name={member.name} src={member.avatarUrl} /><div><h3>{member.name}{isCurrentUser && <small>{t("league.you")}</small>}</h3><p>{member.fantasyTeam?.name ?? t("league.teamNotCreated")}</p></div><span>{member.fantasyTeam?._count.players ?? 0}/10</span></Link>;
}
