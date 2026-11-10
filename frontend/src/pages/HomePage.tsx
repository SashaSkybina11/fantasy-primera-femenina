import { GoArrowRight } from "react-icons/go";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { BudgetDisplay } from "../components/BudgetDisplay";
import { useLocale } from "../contexts/LocaleContext";
import { api } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { ShareTeamButton } from "../components/ShareTeamButton";
import { ClubLogo } from "../components/ClubLogo";

export function HomePage() {
  const { t } = useLocale();
  const { user, setUser } = useAuth();
  const team = useQuery({ queryKey: ["team"], queryFn: api.team });
  const clubs = useQuery({ queryKey: ["clubs"], queryFn: api.clubs });
  const league = useQuery({ queryKey: ["league"], queryFn: api.league, refetchInterval: 30000 });
  const supporters = useQuery({ queryKey: ["supporters"], queryFn: api.supporters, refetchInterval: 60000 });
  const gameweek = useQuery({
    queryKey: ["current-gameweek"],
    queryFn: api.currentGameweek,
    refetchInterval: 15000,
  });
  const favoriteClub = useMutation({
    mutationFn: api.setFavoriteClub,
    onSuccess: (profile) => setUser(profile),
  });
  const totalSupport = supporters.data?.reduce((total, club) => total + club.count, 0) ?? 0;
  const maxSupport = Math.max(...(supporters.data?.map(club => club.count) ?? []), 1);

  return (
    <div className="page home-page">
      <section className="home-hero">
        <div>
          <p className="eyebrow">{t("home.eyebrow")}</p>
          <h1>{t("brand.title")}</h1>
          <p>{t("home.description")}</p>
        </div>
      </section>
      {gameweek.data && (
        <section
          className={`market-status market-status--${gameweek.data.marketIsOpen ? "open" : "closed"}`}
        >
          <div>
            <p className="eyebrow">{t("gameweek.label", { number: gameweek.data.number })}</p>
            <h2>
              {gameweek.data.marketIsOpen === true
                ? t("purchase.marketOpen")
                : t("purchase.marketClosed")}
            </h2>
          </div>
          <p className="market-status__schedule">
            {t("purchase.weeklySchedule")}
            <small>{t("purchase.timezoneLabel")}: Europe/Madrid</small>
          </p>
          <Link className="button market-status__team-link" to="/my-team">
            {t("nav.myTeam")} <GoArrowRight className="ui-arrow" aria-hidden="true" />
          </Link>
        </section>
      )}
      {team.data && (
        <section className="home-team-summary">
          <div>
            <p className="eyebrow">{t("home.yourTeam")}</p>
            <h2>{team.data.name}</h2>
          </div>
          <BudgetDisplay
            budget={team.data.budget}
            count={team.data.players.length}
          />
          <ShareTeamButton team={team.data} />
        </section>
      )}
      <section className="home-support-card">
        <div>
          <p className="eyebrow">{t("home.favoriteEyebrow")}</p>
          <h2>{t("home.favoriteTitle")}</h2>
          <p>{t("home.favoriteDescription")}</p>
        </div>
        <label>
          <span>{t("home.favoriteLabel")}</span>
          <select
            value={user?.favoriteClub?.id ?? ""}
            disabled={clubs.isLoading || favoriteClub.isPending}
            onChange={(event) =>
              favoriteClub.mutate(event.target.value || null)
            }
          >
            <option value="">{t("home.favoritePlaceholder")}</option>
            {clubs.data?.map((club) => (
              <option value={club.id} key={club.id}>
                {club.name}
              </option>
            ))}
          </select>
        </label>
      </section>
      <Link className="home-participants-card" to="/league"><span>{t("home.allParticipants")}</span><strong>{league.data?._count.members ?? "—"}</strong><GoArrowRight className="ui-arrow" aria-hidden="true" /></Link>
      <section className="supporters-card"><div className="supporters-card__head"><div><p className="eyebrow">{t("league.supportersEyebrow")}</p><h2>{t("league.supportersTitle")}</h2></div><span>{t("league.supportersCount", { count: totalSupport })}</span></div>{supporters.data?.length ? <div className="supporters-list">{supporters.data.map(club => <div className="supporter-row" key={club.id}><ClubLogo club={{ ...club, coach: null, president: null }} /><div><div><strong>{club.name}</strong><span>{club.count}</span></div><i><b style={{ width: `${(club.count / maxSupport) * 100}%` }} /></i></div></div>)}</div> : supporters.isLoading ? <p className="supporters-empty">…</p> : <p className="supporters-empty">{t("league.supportersEmpty")}</p>}</section>
    </div>
  );
}
