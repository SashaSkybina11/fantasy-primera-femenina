import { ClubLogo } from "../components/ClubLogo";
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
  const deltaClass = (value: number) => value > 0 ? "price-delta price-delta--up" : value < 0 ? "price-delta price-delta--down" : "price-delta";
  return <div className="page">
    <header className="page-heading"><h1>{t("prices.title")}</h1></header>
    <input value={search} onChange={event => setSearch(event.target.value)} placeholder={t("adminStats.searchPlaceholder")} aria-label={t("adminStats.searchPlaceholder")} />
    {prices.isPending && <p><Loader label={t("loading.players")} /></p>}
    {prices.isError && <p role="alert">{t("error.generic")}</p>}
    <div className="price-preview-grid">{prices.data?.filter(player => `${player.name} ${player.club?.name}`.toLowerCase().includes(search.toLowerCase())).map(player => <article className="admin-card player-price-card" key={player.id}>
      <div className="player-price-heading"><h2>{player.name}</h2>{player.club && <ClubLogo club={player.club} />}</div>
      <strong>{money(player.price)}</strong> <span className={deltaClass(player.priceChanges[0]?.priceDelta ?? 0)}>{delta(player.priceChanges[0]?.priceDelta ?? 0)}</span>
      <details><summary>{t("prices.history")}</summary>
        {!player.priceChanges.length && <p>{t("prices.empty")}</p>}
        {player.priceChanges.map(row => <section key={row.id}>
          <h3>{t("gameweek.label", { number: row.gameweek.number })}</h3>
          <dl><dt>{t("prices.before")}</dt><dd>{money(row.priceBefore)}</dd><dt>{t("prices.delta")}</dt><dd className={deltaClass(row.priceDelta)}>{delta(row.priceDelta)}</dd><dt>{t("prices.new")}</dt><dd>{money(row.priceAfter)}</dd></dl>
        </section>)}
      </details>
    </article>)}</div>
  </div>;
}
