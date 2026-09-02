import { formatEuro } from "../services/api";
import { useLocale } from "../contexts/LocaleContext";

export function BudgetDisplay({ budget, count }: { budget: number; count: number }) {
  const { locale, t } = useLocale();
  return (
    <section className="budget-card" aria-label={t("budget.status")}>
      <div><span>{t("budget.remaining")}</span><strong>{formatEuro(budget, locale)}</strong></div>
      <div className="budget-card__divider" />
      <div><span>{t("budget.squad")}</span><strong>{count} <small>/ 10</small></strong></div>
      <p>{10 - count > 0 ? t("budget.freeSlots", { count: 10 - count }) : t("budget.full")}</p>
    </section>
  );
}
