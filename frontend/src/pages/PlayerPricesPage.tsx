import { Loader } from "../components/Loader";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale } from "../contexts/LocaleContext";
import { api, formatEuro } from "../services/api";

export function PlayerPricesPage() {
  const { t, locale } = useLocale();
  const [search, setSearch] = useState("");
  const prices = useQuery({ queryKey: ["player-prices"], queryFn: api.playerPrices });
  const money = (value: number) => formatEuro(value, locale);
  const delta = (value: number) => value === 0 ? "—" : `${value > 0 ? "↑" : "↓"} ${money(Math.abs(value))}`;
  return <div className="page">
    <header className="page-heading"><h1>{t("prices.title")}</h1></header>
    <input value={search} onChange={event => setSearch(event.target.value)} placeholder={t("adminStats.searchPlaceholder")} aria-label={t("adminStats.searchPlaceholder")} />
    {prices.isPending && <p><Loader label={t("loading.players")} /></p>}
    {prices.isError && <p role="alert">{t("error.generic")}</p>}
    <div className="price-preview-grid">{prices.data?.filter(player => `${player.name} ${player.club?.name}`.toLowerCase().includes(search.toLowerCase())).map(player => <article className="admin-card" key={player.id}>
      <h2>{player.name}</h2><p>{player.club?.name}</p>
      <strong>{money(player.price)}</strong> <span>{delta(player.priceChanges[0]?.priceDelta ?? 0)}</span>
      <details><summary>{t("prices.history")}</summary>
        {!player.priceChanges.length && <p>{t("prices.empty")}</p>}
        {player.priceChanges.map(row => <section key={row.id}>
          <h3>{t("gameweek.label", { number: row.gameweek.number })}</h3>
          <dl><dt>{t("prices.before")}</dt><dd>{money(row.priceBefore)}</dd><dt>{t("prices.delta")}</dt><dd>{delta(row.priceDelta)}</dd><dt>{t("prices.new")}</dt><dd>{money(row.priceAfter)}</dd></dl>
        </section>)}
      </details>
    </article>)}</div>
  </div>;
}
