import { useQuery } from "@tanstack/react-query";
import { FaFaceGrinStars, FaRegNewspaper } from "react-icons/fa6";
import { Loader } from "../components/Loader";
import { api } from "../services/api";
import { useLocale } from "../contexts/LocaleContext";

const sourceUrl = "https://rfef.es/es/noticias/futbol-sala/primera-femenina-futsal?baseFilters=79393";

export function IdealFivePage() {
  const { t } = useLocale();
  const gameweek = useQuery({ queryKey: ["current-gameweek"], queryFn: api.currentGameweek });
  const heading = gameweek.data ? t("idealFive.heading", { number: gameweek.data.number }) : t("idealFive.title");
  return <div className="page ideal-five-page">
    <header className="page-heading">
      <p className="eyebrow"><FaFaceGrinStars aria-hidden="true" /> {t("idealFive.title")}</p>
      <h1>{heading}</h1>
      <a className="ideal-five-source" href={sourceUrl} target="_blank" rel="noreferrer"><FaRegNewspaper aria-hidden="true" /> {t("idealFive.source")}</a>
    </header>
    {gameweek.isPending && <Loader label={t("loading.app")} />}
    {gameweek.isError && <p className="state-card" role="alert">{t("error.generic")}</p>}
    <section className="ideal-five-field" aria-label={heading}>
      <div className="ideal-five-slot ideal-five-slot--goalkeeper">
        <span className="ideal-five-slot__portrait" aria-hidden="true">—</span>
        <strong>{t("idealFive.goalkeeper")}</strong>
      </div>
      <div className="ideal-five-field__players">
        {[0, 1, 2, 3].map((slot) => <article className="ideal-five-slot" key={slot}>
          <span className="ideal-five-slot__portrait" aria-hidden="true">—</span>
          <strong>{t("idealFive.fieldPlayer")}</strong>
        </article>)}
      </div>
    </section>
    {gameweek.data && <p className="ideal-five-empty">{t("idealFive.empty")}</p>}
  </div>;
}
