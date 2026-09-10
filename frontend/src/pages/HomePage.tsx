import { useMutation, useQuery } from "@tanstack/react-query";
import { BudgetDisplay } from "../components/BudgetDisplay";
import { useLocale } from "../contexts/LocaleContext";
import { api } from "../services/api";
import { useAuth } from "../contexts/AuthContext";

export function HomePage() {
  const { locale, t } = useLocale();
  const { user, setUser } = useAuth();
  const team = useQuery({ queryKey: ["team"], queryFn: api.team });
  const clubs = useQuery({ queryKey: ["clubs"], queryFn: api.clubs });
  const gameweek = useQuery({
    queryKey: ["current-gameweek"],
    queryFn: api.currentGameweek,
  });
  const favoriteClub = useMutation({
    mutationFn: api.setFavoriteClub,
    onSuccess: (profile) => setUser(profile),
  });

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
          className={`market-status market-status--${gameweek.data.status.toLowerCase()}`}
        >
          <div>
            <p className="eyebrow">{t("gameweek.label", { number: gameweek.data.number })}</p>
            <h2>
              {gameweek.data.status === "OPEN"
                ? t("home.marketOpen")
                : gameweek.data.status === "COMPLETED"
                  ? t("home.gameweekCompleted")
                  : t("home.squadLocked")}
            </h2>
          </div>
          <p>
            {gameweek.data.status === "OPEN"
              ? t("home.changesUntil")
              : t("home.nextControlDate")}
            :{" "}
            <strong>
              {new Intl.DateTimeFormat(locale === "uk" ? "uk-UA" : locale === "en" ? "en-GB" : "es-ES", {
                timeZone: "Europe/Madrid",
                dateStyle: "full",
                timeStyle: "short",
              }).format(
                new Date(
                  gameweek.data.status === "OPEN"
                    ? gameweek.data.deadlineAt
                    : gameweek.data.endsAt,
                ),
              )}
            </strong>{" "}
            <small>{t("purchase.timezoneLabel")}: Europe/Madrid</small>
          </p>
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
        </section>
      )}
    </div>
  );
}
