import { useLocale } from "../contexts/LocaleContext";

const rfefCalendarUrl = "https://resultados.rfef.es/pnfg/NPcd/NFG_VisCalendario_Vis?cod_primaria=1000120&codtemporada=22&codcompeticion=33836179&codgrupo=33836180&CodJornada=1";
const rfefResultsUrl = "https://resultados.rfef.es/pnfg/NPcd/NFG_CmpJornada?cod_primaria=1000120&CodTemporada=22&CodGrupo=33836180&CodCompeticion=33836179&CodJornada=1";

export function CalendarPage() {
  const { t } = useLocale();
  const cards = [
    {
      title: t("calendar.title"),
      description: t("calendar.description"),
      action: t("calendar.open"),
      href: rfefCalendarUrl,
    },
    {
      title: t("calendar.resultsTitle"),
      description: t("calendar.resultsDescription"),
      action: t("calendar.openResults"),
      href: rfefResultsUrl,
    },
  ];

  return <div className="page page--narrow"><div className="calendar-grid">{cards.map((card) => <section className="calendar-card" key={card.href}><p className="eyebrow">Primera División Fútbol Sala Femenino</p><h1>{card.title}</h1><p>{card.description}</p><a className="button" href={card.href} target="_blank" rel="noreferrer">{card.action}&nbsp; ↗</a></section>)}</div></div>;
}
