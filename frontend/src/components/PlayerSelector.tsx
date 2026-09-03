import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { api } from "../services/api";
import type { FantasyTeam } from "../types";
import { PlayerCard } from "./PlayerCard";
import { PlayerFilters, type PlayerFilterState } from "./PlayerFilters";
import { useLocale } from "../contexts/LocaleContext";

export function PlayerSelector({ team, onClose }: { team: FantasyTeam; onClose: () => void }) {
  const { t } = useLocale();
  const [filters, setFilters] = useState<PlayerFilterState>({ clubId: "", role: "", search: "" });
  const queryClient = useQueryClient();
  const clubs = useQuery({ queryKey: ["clubs"], queryFn: api.clubs });
  const players = useQuery({ queryKey: ["players", filters], queryFn: () => api.players(filters) });
  const addPlayer = useMutation({
    mutationFn: api.addPlayer,
    onSuccess: (updatedTeam) => {
      queryClient.setQueryData(["team"], updatedTeam);
      void queryClient.invalidateQueries({ queryKey: ["team"] });
      toast.success(t("player.added"));
    },
    onError: (error) => toast.error(error.message),
  });
  const selected = new Set(team.players.map((entry) => entry.playerId));
  const clubCounts = team.players.reduce((counts, entry) => {
    counts.set(entry.player.clubId, (counts.get(entry.player.clubId) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.body.classList.add("modal-open");
    window.addEventListener("keydown", onKeyDown);
    return () => { document.body.classList.remove("modal-open"); window.removeEventListener("keydown", onKeyDown); };
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="selector-modal" role="dialog" aria-modal="true" aria-labelledby="selector-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="modal-header"><div><p className="eyebrow">{t("player.market")}</p><h2 id="selector-title">{t("team.addPlayer")}</h2></div><button className="icon-button" onClick={onClose} aria-label={t("player.close")}>×</button></header>
        <PlayerFilters clubs={clubs.data ?? []} value={filters} onChange={setFilters} />
        {players.isLoading && <div className="state-card">{t("loading.players")}</div>}
        {players.isError && <div className="state-card state-card--error">{t("error.generic")}</div>}
        {players.data && <div className="selector-grid">
          {players.data.length === 0 ? <div className="state-card">{t("player.notFound")}</div> : players.data.map((player) => {
            const isSelected = selected.has(player.id);
            const squadFull = team.players.length >= 10;
            const noBudget = team.budget < player.price;
            const clubLimitReached = (clubCounts.get(player.clubId) ?? 0) >= 2;
            const label = isSelected ? t("player.alreadySelected") : clubLimitReached ? t("purchase.clubLimit") : squadFull ? t("budget.full") : noBudget ? t("player.noBudget") : t("player.add");
            return <PlayerCard key={player.id} player={player} label={label} notice={clubLimitReached ? t("purchase.clubLimit") : undefined} disabled={isSelected || clubLimitReached || squadFull || noBudget || addPlayer.isPending} onClick={() => addPlayer.mutate(player.id)} />;
          })}
        </div>}
      </section>
    </div>
  );
}
