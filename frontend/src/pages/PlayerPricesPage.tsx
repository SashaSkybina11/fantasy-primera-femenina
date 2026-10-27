import { GoArrowRight } from "react-icons/go";
import { ClubLogo } from "../components/ClubLogo";
import { Loader } from "../components/Loader";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale } from "../contexts/LocaleContext";
import { api, formatEuro } from "../services/api";

export function PlayerPricesPage() {
  const { t, locale } = useLocale();
  const [search, setSearch] = useState("");
  const [clubId, setClubId] = useState("");
  const [sort, setSort] = useState<"asc" | "desc">("asc");
  const [visibleCount, setVisibleCount] = useState(10);
  const prices = useQuery({ queryKey: ["player-prices"], queryFn: api.playerPrices });
  const clubs = Array.from(new Map(prices.data?.flatMap(player => player.club ? [[player.club.id, player.club] as const] : [])).values()).sort((a, b) => a.name.localeCompare(b.name));
  const money = (value: number) => formatEuro(value, locale);
  const delta = (value: number) => value === 0 ? "—" : <span className="price-trend" aria-label={`${value > 0 ? "+" : "−"}${money(Math.abs(value))}`}><GoArrowRight className={`ui-arrow ${value > 0 ? "ui-arrow--up" : "ui-arrow--down"}`} aria-hidden="true" />{money(Math.abs(value))}</span>;
  const deltaClass = (value: number) => value > 0 ? "price-delta price-delta--up" : value < 0 ? "price-delta price-delta--down" : "price-delta";
  return <div className="page">
    <header className="page-heading"><h1>{t("prices.title")}</h1></header>
    <div className="catalog-filters"><input value={search} onChange={event => { setSearch(event.target.value); setVisibleCount(10); }} placeholder={t("adminStats.searchPlaceholder")} aria-label={t("adminStats.searchPlaceholder")} />
    <label className="catalog-sort"><span>{t("player.priceSort")}</span><select value={sort} onChange={event => { setSort(event.target.value as "asc" | "desc"); setVisibleCount(10); }}><option value="asc">{t("player.priceAscending")}</option><option value="desc">{t("player.priceDescending")}</option></select></label>
    <select value={clubId} onChange={event => { setClubId(event.target.value); setVisibleCount(10); }} aria-label={t("player.club")}><option value="">{t("player.allClubs")}</option>{clubs.map(club => <option key={club.id} value={club.id}>{club.name}</option>)}</select></div>
    {prices.isPending && <p><Loader label={t("loading.players")} /></p>}
    {prices.isError && <p role="alert">{t("error.generic")}</p>}
    {(() => { const filtered = (prices.data ?? []).filter(player => (!clubId || player.club?.id === clubId) && `${player.name} ${player.club?.name}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => sort === "asc" ? a.price - b.price || a.name.localeCompare(b.name) : b.price - a.price || a.name.localeCompare(b.name)); return <><div className="price-preview-grid">{filtered.slice(0, visibleCount).map(player => <article className="admin-card player-price-card" key={player.id}>
      <div className="player-price-heading"><h2>{player.name}</h2>{player.club && <ClubLogo club={player.club} />}</div>
      <strong>{money(player.price)}</strong> <span className={deltaClass(player.priceChanges[0]?.priceDelta ?? 0)}>{delta(player.priceChanges[0]?.priceDelta ?? 0)}</span>
      <details><summary>{t("prices.history")}</summary>
        {!player.priceChanges.length && <p>{t("prices.empty")}</p>}
        {player.priceChanges.map(row => <section key={row.id}>
          <h3>{t("gameweek.label", { number: row.gameweek.number })}</h3>
          <dl><dt>{t("prices.before")}</dt><dd>{money(row.priceBefore)}</dd><dt>{t("prices.delta")}</dt><dd className={deltaClass(row.priceDelta)}>{delta(row.priceDelta)}</dd><dt>{t("prices.new")}</dt><dd>{money(row.priceAfter)}</dd></dl>
        </section>)}
      </details>
    </article>)}</div>{filtered.length > visibleCount && <div className="catalog-load-more"><button className="button button--secondary" onClick={() => setVisibleCount(count => count + 20)}>{t("catalog.showMore", { count: Math.min(20, filtered.length - visibleCount) })}</button></div>}</>; })()}
  </div>;
}
