import { Loader } from "../components/Loader";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { LeagueMemberCard } from "../components/LeagueMemberCard";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../services/api";
import { useLocale } from "../contexts/LocaleContext";
import { ClubLogo } from "../components/ClubLogo";

export function LeaguePage() {
  const { user } = useAuth();
  const { t } = useLocale();
  const league = useQuery({ queryKey: ["league"], queryFn: api.league });
  const members = useInfiniteQuery({
    queryKey: ["members"],
    queryFn: ({ pageParam = 0 }) => api.members(pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) => lastPage.hasMore ? pages.reduce((count, page) => count + page.members.length, 0) : undefined,
  });
  const supporters = useQuery({ queryKey: ["supporters"], queryFn: api.supporters, refetchInterval: 60000 });
  if (league.isLoading || members.isLoading) return <div className="state-card"><Loader label={t("loading.league")} /></div>;
  if (league.isError || members.isError || !league.data || !members.data) return <div className="state-card state-card--error">{t("error.generic")}</div>;
  const memberCount = league.data._count.members;
  const allMembers = members.data.pages.flatMap(page => page.members);
  const totalSupport = supporters.data?.reduce((total, club) => total + club.count, 0) ?? 0;
  const maxSupport = Math.max(...(supporters.data?.map(club => club.count) ?? []), 1);
  return <div className="page league-page"><header className="league-hero"><p className="eyebrow">{t("competition.title")}</p><h1>{t("league.allParticipants")}</h1><span>{t(memberCount === 1 ? "league.member" : "league.members", { count: memberCount })}</span></header><section className="supporters-card"><div className="supporters-card__head"><div><p className="eyebrow">{t("league.supportersEyebrow")}</p><h2>{t("league.supportersTitle")}</h2></div><span>{t("league.supportersCount", { count: totalSupport })}</span></div>{supporters.data?.length ? <div className="supporters-list">{supporters.data.map(club => <div className="supporter-row" key={club.id}><ClubLogo club={{ ...club, coach: null, president: null }} /><div><div><strong>{club.name}</strong><span>{club.count}</span></div><i><b style={{ width: `${(club.count / maxSupport) * 100}%` }} /></i></div></div>)}</div> : supporters.isLoading ? <p className="supporters-empty">…</p> : <p className="supporters-empty">{t("league.supportersEmpty")}</p>}</section><section className="members-list">{allMembers.map((member, index) => <div className="member-row" key={member.id}><span>{String(index + 1).padStart(2, "0")}</span><LeagueMemberCard member={member} isCurrentUser={member.id === user?.id} /></div>)}</section>{members.hasNextPage && <div className="catalog-load-more league-load-more"><button className="button button--secondary" disabled={members.isFetchingNextPage} onClick={() => void members.fetchNextPage()}>{members.isFetchingNextPage ? t("league.loadingMore") : t("league.loadMore", { count: Math.min(20, memberCount - allMembers.length) })}</button></div>}</div>;
}
