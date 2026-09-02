import { useQuery } from "@tanstack/react-query";
import { ClubCard } from "../components/ClubCard";
import { api } from "../services/api";
import { useLocale } from "../contexts/LocaleContext";

export function TeamsPage() {
  const { t } = useLocale();
  const clubs = useQuery({ queryKey: ["clubs"], queryFn: api.clubs });
  return <div className="page"><header className="page-heading"><p className="eyebrow">Primera División Femenina</p><h1>{t("clubs.title")}</h1><p className="muted">{t("clubs.description")}</p></header>{clubs.isLoading && <div className="state-card">{t("loading.teams")}</div>}{clubs.isError && <div className="state-card state-card--error">{t("error.generic")}</div>}{clubs.data && <div className="clubs-grid">{clubs.data.map((club) => <ClubCard key={club.id} club={club} />)}</div>}</div>;
}
