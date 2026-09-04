import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { BudgetDisplay } from "../components/BudgetDisplay";
import { PlayerCard } from "../components/PlayerCard";
import {
  PlayerFilters,
  type PlayerFilterState,
} from "../components/PlayerFilters";
import { useLocale } from "../contexts/LocaleContext";
import { api, formatEuro, roleLabel } from "../services/api";

export function PurchasePlayersPage() {
  const { locale, t } = useLocale();
  const [filters, setFilters] = useState<PlayerFilterState>({
    clubId: "",
    role: "",
    search: "",
  });
  const [squadOpen, setSquadOpen] = useState(false);
  const queryClient = useQueryClient();
  const team = useQuery({ queryKey: ["team"], queryFn: api.team });
  const clubs = useQuery({ queryKey: ["clubs"], queryFn: api.clubs });
  const players = useQuery({
    queryKey: ["players", filters],
    queryFn: () => api.players(filters),
  });
  const gameweek = useQuery({
    queryKey: ["current-gameweek"],
    queryFn: api.currentGameweek,
  });
  const transfers = useQuery({
    queryKey: ["transfer-status"],
    queryFn: api.transferStatus,
  });
  const buy = useMutation({
    mutationFn: api.addPlayer,
    onSuccess: (updatedTeam) => {
      queryClient.setQueryData(["team"], updatedTeam);
      void queryClient.invalidateQueries({ queryKey: ["team"] });
      void queryClient.invalidateQueries({ queryKey: ["transfer-status"] });
      toast.success(t("purchase.success"));
    },
    onError: (error) => toast.error(error.message),
  });

  if (team.isLoading)
    return <div className="state-card">{t("loading.team")}</div>;
  if (team.isError || !team.data)
    return (
      <div className="state-card state-card--error">{t("error.generic")}</div>
    );
  const selected = new Set(team.data.players.map((entry) => entry.playerId));
  const clubCounts = team.data.players.reduce((counts, entry) => {
    counts.set(entry.player.clubId, (counts.get(entry.player.clubId) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
  const marketIsOpen = gameweek.data?.status === "OPEN";
  const dateFormatter = new Intl.DateTimeFormat(
    locale === "uk" ? "uk-UA" : "es-ES",
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
          <button
            className="button button--secondary"
            onClick={() => setSquadOpen(true)}
          >
            {t("purchase.viewSquad")}
          </button>
        </div>
      </header>
      {gameweek.isLoading && (
        <section className="purchase-deadline purchase-deadline--loading">
          <strong>{t("purchase.scheduleLoading")}</strong>
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
              {t("purchase.gameweekLabel")}: {gameweek.data.name}
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
      <aside className="price-change-notice">
        {t("purchase.dynamicPriceNotice")}
      </aside>
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
          value={filters}
          onChange={setFilters}
        />
        {players.isLoading && (
          <div className="state-card">{t("loading.players")}</div>
        )}
        {players.isError && (
          <div className="state-card state-card--error">
            {t("error.generic")}
          </div>
        )}
        {players.data && (
          <div className="purchase-grid">
            {players.data.length === 0 ? (
              <div className="state-card">{t("player.notFound")}</div>
            ) : (
              players.data.map((player) => {
                const alreadySelected = selected.has(player.id);
                const clubLimitReached =
                  (clubCounts.get(player.clubId) ?? 0) >= 2;
                const squadFull = team.data.players.length >= 10;
                const noBudget = team.data.budget < player.price;
                const disabled =
                  !marketIsOpen ||
                  alreadySelected ||
                  clubLimitReached ||
                  squadFull ||
                  noBudget ||
                  buy.isPending;
                const label = !marketIsOpen
                  ? t("purchase.marketClosed")
                  : alreadySelected
                    ? t("player.alreadySelected")
                    : clubLimitReached
                      ? t("purchase.clubLimit")
                      : squadFull
                        ? t("budget.full")
                        : noBudget
                          ? t("player.noBudget")
                          : t("purchase.buy");
                return (
                  <PlayerCard
                    key={player.id}
                    player={player}
                    label={label}
                    notice={
                      clubLimitReached ? t("purchase.clubLimit") : undefined
                    }
                    disabled={disabled}
                    onClick={() => buy.mutate(player.id)}
                  />
                );
              })
            )}
          </div>
        )}
      </section>
      {squadOpen && (
        <div
          className="modal-backdrop squad-preview-backdrop"
          onClick={() => setSquadOpen(false)}
        >
          <section
            className="compact-modal squad-preview-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="compact-modal__close"
              onClick={() => setSquadOpen(false)}
              aria-label={t("friends.close")}
            >
              ×
            </button>
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
          </section>
        </div>
      )}
    </div>
  );
}
