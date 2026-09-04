import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { BudgetDisplay } from "../components/BudgetDisplay";
import { SquadSection } from "../components/SquadSection";
import { api } from "../services/api";
import type { SquadEntry } from "../types";
import { useLocale } from "../contexts/LocaleContext";

export function MyTeamPage() {
  const { t } = useLocale();
  const teamQuery = useQuery({ queryKey: ["team"], queryFn: api.team });
  const queryClient = useQueryClient();
  const [removeTarget, setRemoveTarget] = useState<SquadEntry | null>(null);
  const refresh = () =>
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: ["team"] }),
      queryClient.invalidateQueries({ queryKey: ["transfer-status"] }),
    ]);
  const move = useMutation({
    mutationFn: ({
      playerId,
      status,
    }: {
      playerId: string;
      status: "STARTER" | "BENCH";
    }) => api.setStatus(playerId, status),
    onSuccess: () => {
      refresh();
      toast.success(t("team.updated"));
    },
    onError: (error) => toast.error(error.message),
  });
  const captain = useMutation({
    mutationFn: api.setCaptain,
    onSuccess: () => {
      refresh();
      toast.success(t("team.captainSet"));
    },
    onError: (error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: api.removePlayer,
    onSuccess: () => {
      setRemoveTarget(null);
      refresh();
      toast.success(t("team.playerRemoved"));
    },
    onError: (error) => toast.error(error.message),
  });
  const save = useMutation({
    mutationFn: () =>
      api.saveLineup(
        teamQuery.data!.players.map((entry) => ({
          playerId: entry.playerId,
          status: entry.status,
        })),
      ),
    onSuccess: () => {
      refresh();
      toast.success(t("team.lineupSaved"));
    },
    onError: (error) => toast.error(error.message),
  });
  if (teamQuery.isLoading)
    return <div className="state-card">{t("loading.team")}</div>;
  if (teamQuery.isError || !teamQuery.data)
    return (
      <div className="state-card state-card--error">{t("error.generic")}</div>
    );
  const team = teamQuery.data;
  const starters = team.players.filter((entry) => entry.status === "STARTER");
  const bench = team.players.filter((entry) => entry.status === "BENCH");
  const onMove = (entry: SquadEntry) =>
    move.mutate({
      playerId: entry.playerId,
      status: entry.status === "STARTER" ? "BENCH" : "STARTER",
    });
  const isComplete = team.players.length === 10;

  return (
    <div className="page">
      <header className="team-heading">
        <div>
          <p className="eyebrow">{t("team.eyebrow")}</p>
          <h1>{team.name}</h1>
          <p className="muted">{t("team.description")}</p>
        </div>
        <BudgetDisplay budget={team.budget} count={team.players.length} />
      </header>
      <div className="team-toolbar">
        <div>
          <span className="status-dot" />
          {team.players.some((entry) => entry.isCaptain)
            ? t("team.captainSelected")
            : t("team.selectCaptain")}
        </div>
        <Link className="button" to="/purchase-players">
          ＋ {t("nav.purchase")}
        </Link>
      </div>
      {team.players.length === 0 ? (
        <section className="state-card empty-team-card">
          <h2>{t("team.emptyTitle")}</h2>
          <p>{t("team.empty")}</p>
          <Link className="button" to="/purchase-players">
            {t("team.goToPurchase")}
          </Link>
        </section>
      ) : (
        <>
          <div className="team-grid">
            <SquadSection
              title={t("team.starters")}
              subtitle={t("team.startersSubtitle")}
              status="STARTER"
              players={starters}
              showEmptySlots={false}
              onMove={onMove}
              onCaptain={(entry) =>
                captain.mutate(entry.isCaptain ? null : entry.playerId)
              }
              onRemove={setRemoveTarget}
            />
            <SquadSection
              title={t("team.bench")}
              subtitle={t("team.benchSubtitle")}
              status="BENCH"
              players={bench}
              showEmptySlots={false}
              onMove={onMove}
              onRemove={setRemoveTarget}
            />
          </div>
          <div className="save-bar">
            <div>
              <strong>{t("team.checkLineup")}</strong>
              <span>{t("team.lineupRequirements")}</span>
            </div>
            <button
              className="button"
              disabled={!isComplete || save.isPending}
              onClick={() => save.mutate()}
            >
              {save.isPending ? t("team.checking") : t("team.saveLineup")}
            </button>
          </div>
        </>
      )}
      {removeTarget && (
        <div
          className="modal-backdrop"
          onClick={() => !remove.isPending && setRemoveTarget(null)}
        >
          <section
            className="compact-modal remove-player-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="compact-modal__close"
              aria-label={t("squad.closeRemove")}
              onClick={() => setRemoveTarget(null)}
            >
              ×
            </button>
            <h2>{t("squad.removeTitle")}</h2>
            <p>
              {t("squad.removeQuestion", { name: removeTarget.player.name })}
            </p>
            <div className="modal-actions">
              <button
                className="button button--danger"
                disabled={remove.isPending}
                onClick={() => remove.mutate(removeTarget.playerId)}
              >
                {t("squad.remove")}
              </button>
              <button
                className="button button--secondary"
                disabled={remove.isPending}
                onClick={() => setRemoveTarget(null)}
              >
                {t("squad.keep")}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
