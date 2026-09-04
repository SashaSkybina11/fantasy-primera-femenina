import { useQuery } from "@tanstack/react-query";
import { useLocale } from "../contexts/LocaleContext";
import { api } from "../services/api";

export function RulesPage() {
  const { t } = useLocale();
  const scoring = useQuery({
    queryKey: ["scoring-rules"],
    queryFn: api.scoringRules,
  });
  const rule = (key: string, label: Parameters<typeof t>[0]) => (
    <li>
      <span>{t(label)}:</span>
      <strong>
        {(scoring.data?.[key] ?? 0) > 0 ? "+" : ""}
        {scoring.data?.[key] ?? 0} {t("rules.pointsUnit")}
      </strong>
    </li>
  );
  return (
    <div className="page rules-page">
      <header className="page-heading">
        <p className="eyebrow">⚽ FANTASY FUTSAL FEMENINO 🇪🇸</p>
        <h1>{t("rules.title")}</h1>
        <p className="muted">{t("rules.intro")}</p>
      </header>
      <div className="rules-grid">
        <article>
          <h2>👤 {t("rules.howTitle")}</h2>
          <p>{t("rules.howBody")}</p>
        </article>
        <article>
          <h2>👥 {t("rules.squadTitle")}</h2>
          <p>{t("rules.squadBody")}</p>
        </article>
        <article className="rules-points">
          <h2>🏆 {t("rules.pointsTitle")}</h2>
          <p>{t("rules.pointsBody")}</p>
          <p>{t("rules.allPlayers")}</p>
          <ul>
            {rule("started", "rules.started")}
            {rule("win", "rules.win")}
            {rule("draw", "rules.draw")}
            {rule("fieldGoal", "rules.fieldGoal")}
            {rule("goalkeeperGoal", "rules.goalkeeperGoal")}
            {rule("goalkeeperCleanSheet", "rules.cleanSheet")}
            {rule("hatTrickBonus", "rules.hatTrick")}
            {rule("yellowCard", "rules.yellowCard")}
            {rule("redCard", "rules.redCard")}
          </ul>
        </article>
        <article>
          <h2>© {t("rules.captainTitle")}</h2>
          <p>{t("rules.captainBody")}</p>
        </article>
        <article>
          <h2>🔄 {t("rules.marketTitle")}</h2>
          <p>{t("rules.marketBody")}</p>
          <p>{t("rules.marketRestrictions")}</p>
        </article>
        <article>
          <h2>📊 {t("rules.ratingTitle")}</h2>
          <p>{t("rules.ratingBody")}</p>
        </article>
        <article>
          <h2>🤝 {t("rules.leaguesTitle")}</h2>
          <p>{t("rules.leaguesBody")}</p>
        </article>
      </div>
    </div>
  );
}
