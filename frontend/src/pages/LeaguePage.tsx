import { useQuery } from "@tanstack/react-query";
import { LeagueMemberCard } from "../components/LeagueMemberCard";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../services/api";
import { useLocale } from "../contexts/LocaleContext";
import { ClubLogo } from "../components/ClubLogo";

export function LeaguePage() {
  const { user } = useAuth();
  const { t } = useLocale();
  const league = useQuery({ queryKey: ["league"], queryFn: api.league });
  const members = useQuery({ queryKey: ["members"], queryFn: api.members });
  const supporters = useQuery({ queryKey: ["supporters"], queryFn: api.supporters });
  if (league.isLoading || members.isLoading) return <div className="state-card">{t("loading.league")}</div>;
  if (league.isError || members.isError || !league.data || !members.data) return <div className="state-card state-card--error">{t("error.generic")}</div>;
  const memberCount = league.data._count.members;
  const maxSupport = Math.max(...(supporters.data?.map((club) => club.count) ?? []), 1);
  const totalSupport = supporters.data?.reduce((total, club) => total + club.count, 0) ?? 0;
  return <div className="page league-page"><header className="league-hero"><p className="eyebrow">{t("league.private")}</p><h1>{league.data.name}</h1><span>{t(memberCount === 1 ? "league.member" : "league.members", { count: memberCount })}</span></header><section className="supporters-card"><div className="supporters-card__head"><div><p className="eyebrow">{t("league.supportersEyebrow")}</p><h2>{t("league.supportersTitle")}</h2></div><span>{t("league.supportersCount", { count: totalSupport })}</span></div>{supporters.data?.length ? <div className="supporters-list">{supporters.data.map((club) => <div className="supporter-row" key={club.id}><ClubLogo club={{ ...club, coach: null, president: null }} /><div><div><strong>{club.name}</strong><span>{club.count}</span></div><i><b style={{ width: `${(club.count / maxSupport) * 100}%` }} /></i></div></div>)}</div> : <p className="supporters-empty">{t("league.supportersEmpty")}</p>}</section><section className="members-list">{members.data.map((member, index) => <div className="member-row" key={member.id}><span>{String(index + 1).padStart(2, "0")}</span><LeagueMemberCard member={member} isCurrentUser={member.id === user?.id} /></div>)}</section></div>;
}
