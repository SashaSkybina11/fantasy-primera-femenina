import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { GiBuyCard } from "react-icons/gi";
import { TbPlayFootball } from "react-icons/tb";
import { IoCalendarOutline } from "react-icons/io5";
import { BudgetDisplay } from "../components/BudgetDisplay";
import { useLocale } from "../contexts/LocaleContext";
import { api } from "../services/api";
import { useAuth } from "../contexts/AuthContext";

export function HomePage() {
  const { t } = useLocale();
  const { user, setUser } = useAuth();
  const team = useQuery({ queryKey: ["team"], queryFn: api.team });
  const clubs = useQuery({ queryKey: ["clubs"], queryFn: api.clubs });
  const gameweek = useQuery({ queryKey: ["current-gameweek"], queryFn: api.currentGameweek });
  const favoriteClub = useMutation({
    mutationFn: api.setFavoriteClub,
    onSuccess: (profile) => setUser(profile),
  });

  return <div className="page home-page">
    <section className="home-hero">
      <div><p className="eyebrow">{t("home.eyebrow")}</p><h1>Fantasy Primera División Fútbol Sala Femenino</h1><p>{t("home.description")}</p></div>
    </section>
    {gameweek.data && <section className={`market-status market-status--${gameweek.data.status.toLowerCase()}`}><div><p className="eyebrow">{gameweek.data.name}</p><h2>{gameweek.data.status === "OPEN" ? "Рынок открыт" : gameweek.data.status === "COMPLETED" ? "Тур завершён" : "Состав зафиксирован"}</h2></div><p>{gameweek.data.status === "OPEN" ? "Изменения доступны до" : "Следующая контрольная дата"}: <strong>{new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Madrid", dateStyle: "full", timeStyle: "short" }).format(new Date(gameweek.data.status === "OPEN" ? gameweek.data.deadlineAt : gameweek.data.endsAt))}</strong> <small>Europe/Madrid</small></p></section>}
    <section className="home-actions" aria-label={t("home.actions")}>
      <Link className="home-action" to="/my-team"><span><TbPlayFootball aria-hidden="true" /></span><div><h2>{t("nav.myTeam")}</h2><p>{t("home.myTeam")}</p></div></Link>
      <Link className="home-action" to="/purchase-players"><span><GiBuyCard aria-hidden="true" /></span><div><h2>{t("nav.purchase")}</h2><p>{t("home.purchase")}</p></div></Link>
      <Link className="home-action" to="/calendar"><span><IoCalendarOutline aria-hidden="true" /></span><div><h2>{t("nav.calendar")}</h2><p>{t("home.calendar")}</p></div></Link>
    </section>
    {team.data && <section className="home-team-summary"><div><p className="eyebrow">{t("home.yourTeam")}</p><h2>{team.data.name}</h2></div><BudgetDisplay budget={team.data.budget} count={team.data.players.length} /></section>}
    <section className="home-support-card"><div><p className="eyebrow">{t("home.favoriteEyebrow")}</p><h2>{t("home.favoriteTitle")}</h2><p>{t("home.favoriteDescription")}</p></div><label><span>{t("home.favoriteLabel")}</span><select value={user?.favoriteClub?.id ?? ""} disabled={clubs.isLoading || favoriteClub.isPending} onChange={(event) => favoriteClub.mutate(event.target.value || null)}><option value="">{t("home.favoritePlaceholder")}</option>{clubs.data?.map((club) => <option value={club.id} key={club.id}>{club.name}</option>)}</select></label></section>
    <section className="home-concept"><div className="home-concept__intro"><p className="eyebrow">{t("home.conceptEyebrow")}</p><h2>{t("home.conceptTitle")}</h2><p>{t("home.conceptDescription")}</p><p className="home-concept__source">{t("home.conceptSource")} <a href="https://rfef.es/es/competiciones/primera-futbol-sala-iberdrola" target="_blank" rel="noreferrer">RFEF</a></p></div><div className="concept-grid"><article><span>01</span><h3>{t("home.conceptFantasyTitle")}</h3><p>{t("home.conceptFantasyDescription")}</p></article><article><span>02</span><h3>{t("home.conceptClubTitle")}</h3><p>{t("home.conceptClubDescription")}</p></article><article><span>03</span><h3>{t("home.conceptLeagueTitle")}</h3><p>{t("home.conceptLeagueDescription")}</p></article><article><span>04</span><h3>{t("home.conceptCalendarTitle")}</h3><p>{t("home.conceptCalendarDescription")}</p></article><article><span>05</span><h3>{t("home.conceptPointsTitle")}</h3><p>{t("home.conceptPointsDescription")}</p></article><article><span>06</span><h3>{t("home.conceptRatingTitle")}</h3><p>{t("home.conceptRatingDescription")}</p></article></div></section>
  </div>;
}
