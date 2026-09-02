import { useQuery } from "@tanstack/react-query";
import { LeagueMemberCard } from "../components/LeagueMemberCard";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../services/api";
import { useLocale } from "../contexts/LocaleContext";

export function LeaguePage() {
  const { user } = useAuth();
  const { t } = useLocale();
  const league = useQuery({ queryKey: ["league"], queryFn: api.league });
  const members = useQuery({ queryKey: ["members"], queryFn: api.members });
  if (league.isLoading || members.isLoading) return <div className="state-card">{t("loading.league")}</div>;
  if (league.isError || members.isError || !league.data || !members.data) return <div className="state-card state-card--error">{t("error.generic")}</div>;
  const memberCount = league.data._count.members;
  return <div className="page page--narrow"><header className="league-hero"><p className="eyebrow">{t("league.private")}</p><h1>{league.data.name}</h1><span>{t(memberCount === 1 ? "league.member" : "league.members", { count: memberCount })}</span></header><section className="members-list">{members.data.map((member, index) => <div className="member-row" key={member.id}><span>{String(index + 1).padStart(2, "0")}</span><LeagueMemberCard member={member} isCurrentUser={member.id === user?.id} /></div>)}</section></div>;
}
