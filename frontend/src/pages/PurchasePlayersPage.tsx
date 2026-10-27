import { Loader } from "../components/Loader";
import { ClubLogo } from "../components/ClubLogo";
import { Modal } from "../components/Modal";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { BudgetDisplay } from "../components/BudgetDisplay";
import { PlayerCard } from "../components/PlayerCard";
import {
  PlayerFilters,
  type PlayerFilterState,
} from "../components/PlayerFilters";
import { useLocale } from "../contexts/LocaleContext";
import { useAuth } from "../contexts/AuthContext";
import { api, formatEuro, nationalityLabel, roleLabel } from "../services/api";

const madridDateTime = (value: string) => {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
};

const madridDateTimeIso = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("Enter a valid date and time");
  const [, year, month, day, hour, minute] = match;
  const target = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
  let instant = target;
  for (let pass = 0; pass < 3; pass += 1) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(instant)).map(part => [part.type, part.value]));
    instant += target - Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
  }
  return new Date(instant).toISOString();
};

export function PurchasePlayersPage() {
  const { user } = useAuth();
  const { locale, t } = useLocale();
  const [filters, setFilters] = useState<PlayerFilterState>({
    clubId: "",
    role: "",
    search: "",
    nationality: "",
    priceSort: "",
  });
  const [squadOpen, setSquadOpen] = useState(false);
  const [visiblePlayerCount, setVisiblePlayerCount] = useState(8);
  const [marketOpenAt, setMarketOpenAt] = useState("");
  const [marketCloseAt, setMarketCloseAt] = useState("");
  const queryClient = useQueryClient();
  const team = useQuery({ queryKey: ["team"], queryFn: api.team });
  const popularity = useQuery({
    queryKey: ["popular-player"],
    queryFn: api.popularPlayer,
  });
  const clubs = useQuery({ queryKey: ["clubs"], queryFn: api.clubs });
  const players = useQuery({
    queryKey: ["players", {}],
    queryFn: () => api.players({}),
  });
  const gameweek = useQuery({
    queryKey: ["current-gameweek"],
    queryFn: api.currentGameweek,
    refetchInterval: 15000,
  });
  const transfers = useQuery({
    queryKey: ["transfer-status"],
    queryFn: api.transferStatus,
    refetchInterval: 15000,
  });
  const buy = useMutation({
    mutationFn: api.addPlayer,
    onSuccess: (updatedTeam) => {
      queryClient.setQueryData(["team"], updatedTeam);
      void queryClient.invalidateQueries({ queryKey: ["team"] });
      void queryClient.invalidateQueries({ queryKey: ["transfer-status"] });
      void queryClient.invalidateQueries({ queryKey: ["popular-player"] });
      toast.success(t("purchase.success"));
    },
    onError: (error) => toast.error(error.message),
  });

  const setMarket = useMutation({
    mutationFn: api.setMarket,
    onSuccess: (updated) => {
      queryClient.setQueryData(["current-gameweek"], updated);
      void queryClient.invalidateQueries({ queryKey: ["current-gameweek"] });
      void queryClient.invalidateQueries({ queryKey: ["transfer-status"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-gameweeks"] });
      toast.success(t("market.saved"));
    },
    onError: (error) => toast.error(error.message),
  });
  const updateSchedule = useMutation({
    mutationFn: () => api.updateMarketSchedule(gameweek.data!.id, { marketOpenAt: madridDateTimeIso(marketOpenAt), deadlineAt: madridDateTimeIso(marketCloseAt) }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["current-gameweek"], updated);
      void queryClient.invalidateQueries({ queryKey: ["current-gameweek"] });
      void queryClient.invalidateQueries({ queryKey: ["transfer-status"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-gameweeks"] });
      toast.success(t("market.scheduleSaved"));
    },
    onError: (error) => toast.error(error.message),
  });

  useEffect(() => {
    if (!gameweek.data) return;
    setMarketOpenAt(madridDateTime(gameweek.data.marketOpenAt));
    setMarketCloseAt(madridDateTime(gameweek.data.deadlineAt));
  }, [gameweek.data?.id, gameweek.data?.marketOpenAt, gameweek.data?.deadlineAt]);

  const nationalities = [...new Set((players.data ?? []).flatMap((player) => player.nationality ? [player.nationality.toUpperCase()] : []))]
    .sort((a, b) => (nationalityLabel(a, locale) ?? a).localeCompare(nationalityLabel(b, locale) ?? b, locale));
  const filteredPlayers = players.data?.filter((player) =>
    (!filters.clubId || player.clubId === filters.clubId) &&
    (!filters.role || player.role === filters.role) &&
    (!filters.nationality || player.nationality?.toUpperCase() === filters.nationality) &&
    (!filters.search || player.name.toLocaleLowerCase(locale).includes(filters.search.trim().toLocaleLowerCase(locale)))
  ).sort((a, b) => filters.priceSort === "asc" ? a.price - b.price : filters.priceSort === "desc" ? b.price - a.price : a.name.localeCompare(b.name));
  const popularClub = clubs.data?.find((club) => club.id === popularity.data?.player?.club.id);

  if (team.isLoading)
    return <div className="state-card"><Loader label={t("loading.team")} /></div>;
  if (team.isError || !team.data)
    return (
      <div className="state-card state-card--error">{t("error.generic")}</div>
    );
  const selected = new Set(team.data.players.map((entry) => entry.playerId));
  const clubCounts = team.data.players.reduce((counts, entry) => {
    counts.set(entry.player.clubId, (counts.get(entry.player.clubId) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
  const marketIsOpen = gameweek.data?.marketIsOpen === true;
  const canTrade = user?.role === "ADMIN" || marketIsOpen;
  const transferLimitReached = user?.role !== "ADMIN" && transfers.data?.initialSquad === false && transfers.data.bought >= transfers.data.limit;
  const dateFormatter = new Intl.DateTimeFormat(
    locale === "uk" ? "uk-UA" : locale === "en" ? "en-GB" : locale === "pt" ? "pt-PT" : locale === "pt-BR" ? "pt-BR" : "es-ES",
    { timeZone: "Europe/Madrid", dateStyle: "full", timeStyle: "short" },
  );

  return (
    <div className="page">
      <header className="team-heading">
        <div>
          <p className="eyebrow">{t("purchase.eyebrow")}</p>
          <h1>{t("purchase.title")}</h1>
          <p className="muted">{t("purchase.description")}</p>
        </div>
        <div className="purchase-heading-actions">
          <BudgetDisplay
            budget={team.data.budget}
            count={team.data.players.length}
          />
        </div>
      </header>
      <div className="view-team-action">
        <button
          className="button button--secondary view-team-button"
          onClick={() => setSquadOpen(true)}
        >
          {t("purchase.viewSquad")}
        </button>
      </div>
      {gameweek.isLoading && (
        <section className="purchase-deadline purchase-deadline--loading">
          <strong><Loader label={t("purchase.scheduleLoading")} /></strong>
        </section>
      )}
      {gameweek.isError && (
        <section className="purchase-deadline purchase-deadline--closed">
          <strong>{t("purchase.scheduleUnavailable")}</strong>
          <p>{t("purchase.weeklySchedule")}</p>
          <small>{t("purchase.timezoneLabel")}: Europe/Madrid</small>
        </section>
      )}
      {gameweek.data && (
        <section
          className={`purchase-deadline purchase-deadline--${marketIsOpen ? "open" : "closed"}`}
        >
          <div>
            <strong>
              {marketIsOpen
                ? t("purchase.marketOpen")
                : t("purchase.marketClosed")}
            </strong>
            <span>
              {t("purchase.gameweekLabel")}: {gameweek.data.number}
            </span>
          </div>
          <div className="purchase-deadline__schedule">
            <p>
              {t("purchase.deadlineRange", {
                from: dateFormatter.format(
                  new Date(gameweek.data.marketOpenAt),
                ),
                to: dateFormatter.format(new Date(gameweek.data.deadlineAt)),
              })}
            </p>
            <p>{t("purchase.weeklySchedule")}</p>
          </div>
          <small>{t("purchase.timezoneLabel")}: Europe/Madrid</small>
        </section>
      )}
      {user?.role === "ADMIN" && gameweek.data && <section className="market-controls" aria-label={t("market.manage")}>
        <h2>{t("market.manage")}</h2>
        <p>{t("market.help")}</p>
        <strong role="status">{t(gameweek.data.marketOverride == null ? "market.automatic" : gameweek.data.marketOverride ? "market.manualOpen" : "market.manualClosed")}</strong>
        <div className="market-controls__actions">
          {(["OPEN", "CLOSED", "AUTO"] as const).map(mode => <button key={mode} className="button button--secondary"
            aria-pressed={mode === "AUTO" ? gameweek.data!.marketOverride == null : gameweek.data!.marketOverride === (mode === "OPEN")}
            disabled={setMarket.isPending || (mode === "OPEN" && ["CALCULATING", "COMPLETED"].includes(gameweek.data!.status))}
            onClick={() => setMarket.mutate({ gameweekId: gameweek.data!.id, mode })}>
            {t(mode === "OPEN" ? "market.open" : mode === "CLOSED" ? "market.close" : "market.auto")}
          </button>)}
        </div>
        <form className="market-schedule-form" onSubmit={(event) => { event.preventDefault(); updateSchedule.mutate(); }}>
          <h3>{t("market.scheduleTitle")}</h3>
          <p>{t("market.scheduleHelp")}</p>
          <label>{t("market.opensAt")}<input type="datetime-local" value={marketOpenAt} onChange={event => setMarketOpenAt(event.target.value)} required /></label>
          <label>{t("market.closesAt")}<input type="datetime-local" value={marketCloseAt} onChange={event => setMarketCloseAt(event.target.value)} required /></label>
          <small>{t("purchase.timezoneLabel")}: Europe/Madrid</small>
          <button className="button" type="submit" disabled={updateSchedule.isPending || !marketOpenAt || !marketCloseAt || marketOpenAt >= marketCloseAt}>{updateSchedule.isPending ? t("market.savingSchedule") : t("market.saveSchedule")}</button>
        </form>
      </section>}
      <aside className="price-change-notice">
        {t("purchase.dynamicPriceNotice")}
      </aside>
      <section className="profile-card popular-player" aria-live="polite">
        <h2>{t("purchase.popularTitle")}</h2>

        {popularity.isPending ? (
          <p><Loader label={t("loading.players")} /></p>
        ) : popularity.isError ? (
          <p role="alert">
            {t("error.generic")}{" "}
            <button
              className="button button--secondary"
              onClick={() => void popularity.refetch()}
            >
              {t("friends.retry")}
            </button>
          </p>
        ) : popularity.data.player ? (
          <div className="popular-player__summary">
            <ClubLogo club={popularClub ?? { ...popularity.data.player.club, logoUrl: null, coach: null, president: null }} />
            <span className="jersey-number">#{popularity.data.player.number}</span>
            <h3>{popularity.data.player.name}</h3>
            <strong className="popular-player__percentage">{popularity.data.percentage}%</strong>
          </div>
        ) : (
          <p className="muted">{t("purchase.popularEmpty")}</p>
        )}
      </section>
      {transfers.data && (
        <section className="transfer-counter">
          <strong>{t("purchase.transfersTitle")}</strong>
          {transfers.data.initialSquad ? (
            <span>{t("purchase.initialSquad")}</span>
          ) : (
            <>
              <span>
                {t("purchase.sold")}:{" "}
                <b>
                  {transfers.data.sold} / {transfers.data.limit}
                </b>
              </span>
              <span>
                {t("purchase.bought")}:{" "}
                <b>
                  {transfers.data.bought} / {transfers.data.limit}
                </b>
              </span>
            </>
          )}
        </section>
      )}
      <section className="purchase-panel">
        <PlayerFilters
          clubs={clubs.data ?? []}
          nationalities={nationalities}
          value={filters}
          onChange={(next) => { setFilters(next); setVisiblePlayerCount(next.clubId ? Number.MAX_SAFE_INTEGER : 8); }}
        />
        {players.isLoading && (
          <div className="state-card"><Loader label={t("loading.players")} /></div>
        )}
        {players.isError && (
          <div className="state-card state-card--error">
            {t("error.generic")}
          </div>
        )}
        {filteredPlayers && (
          <div className="purchase-grid">
            {filteredPlayers.length === 0 ? (
              <div className="state-card">{t("player.notFound")}</div>
            ) : (
              filteredPlayers.slice(0, visiblePlayerCount).map((player) => {
                const alreadySelected = selected.has(player.id);
                const clubLimitReached =
                  (clubCounts.get(player.clubId) ?? 0) >= 2;
                const squadFull = team.data.players.length >= 10;
                const noBudget = team.data.budget < player.price;
                const positionFull =
                  team.data.players.filter(
                    (entry) => entry.player.position === player.position,
                  ).length >= (player.position === "GOALKEEPER" ? 2 : 8);
                const notice = alreadySelected ? t("player.alreadySelected")
                  : !canTrade ? t(gameweek.isError ? "purchase.scheduleUnavailable" : gameweek.isPending ? "purchase.scheduleLoading" : "purchase.marketClosed")
                  : clubLimitReached ? t("purchase.clubLimit")
                  : positionFull ? t(player.position === "GOALKEEPER" ? "purchase.goalkeeperLimit" : "purchase.fieldLimit")
                  : squadFull ? t("budget.full")
                  : noBudget ? t("player.noBudget")
                  : transferLimitReached ? t("purchase.transferLimit")
                  : transfers.isPending ? t("purchase.scheduleLoading")
                  : transfers.isError ? t("purchase.scheduleUnavailable")
                  : buy.isPending ? t("auth.wait") : undefined;
                const disabled = Boolean(notice);
                const label = alreadySelected ? t("purchase.purchased") : disabled ? t("purchase.unavailable") : t("purchase.buy");
                return (
                  <PlayerCard
                    key={player.id}
                    player={player}
                    label={label}
                    notice={notice}
                    disabled={disabled}
                    onClick={() => buy.mutate(player.id)}
                  />
                );
              })
            )}
          </div>
        )}
        {filteredPlayers && filteredPlayers.length > visiblePlayerCount && <div className="catalog-load-more"><button className="button button--secondary" onClick={() => setVisiblePlayerCount(count => count + 16)}>{t("catalog.showMore", { count: Math.min(16, filteredPlayers.length - visiblePlayerCount) })}</button></div>}
      </section>
      {squadOpen && (
        <Modal
          title={t("purchase.viewSquad")}
          onClose={() => setSquadOpen(false)}
          className="squad-preview-modal"
        >
          <div className="squad-preview-head">
            <h2>
              {t("purchase.squadCount", { count: team.data.players.length })}
            </h2>
            <strong>
              {t("purchase.budgetLabel")}:{" "}
              {formatEuro(team.data.budget, locale)}
            </strong>
          </div>
          {team.data.players.length ? (
            <div className="squad-preview-list">
              {team.data.players.map((entry) => (
                <div key={entry.id}>
                  <b>#{entry.player.displayNumber ?? entry.player.number}</b>
                  <span>{entry.player.name}</span>
                  <small>{roleLabel(entry.player.role, locale)}</small>
                  <small>{entry.player.club.name}</small>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">{t("purchase.emptySquad")}</p>
          )}
        </Modal>
      )}
    </div>
  );
}
