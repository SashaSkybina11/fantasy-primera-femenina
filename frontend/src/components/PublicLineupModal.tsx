import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";
import { useLocale } from "../contexts/LocaleContext";
import { Modal } from "./Modal";
import { SquadPlayerCard } from "./SquadPlayerCard";
import { ClubLogo } from "./ClubLogo";
import { Loader } from "./Loader";

export function PublicLineupModal({ userId, name, onClose }: { userId: string; name: string; onClose: () => void }) {
  const { t } = useLocale();
  const lineup = useQuery({ queryKey: ["public-lineup", userId], queryFn: () => api.publicLineup(userId), gcTime: 0 });
  const history = useQuery({ queryKey: ["member-gameweek-history", userId], queryFn: () => api.member(userId), gcTime: 0 });
  const previousGameweek = history.data?.gameweekPoints[0];
  const pointsByPlayer = new Map((previousGameweek?.breakdown ?? []).map((entry) => [entry.playerId, entry.points]));
  return <Modal title={lineup.data?.user.name ?? name} onClose={onClose} className="lineup-modal">
    <p className="eyebrow">{previousGameweek ? t("gameweek.label", { number: previousGameweek.gameweek.number }) : t("lineup.title")}</p>
    {(lineup.isPending || history.isPending) ? <div className="modal-loading" role="status"><Loader label={t("loading.team")} /></div>
      : lineup.isError ? <div role="alert" className="state-card state-card--error">{t("lineup.error")} <button className="button button--secondary" onClick={() => void lineup.refetch()}>{t("friends.retry")}</button></div>
      : history.isError ? <div role="alert" className="state-card state-card--error">{t("error.generic")} <button className="button button--secondary" onClick={() => void history.refetch()}>{t("friends.retry")}</button></div>
      : !lineup.data.players.length ? <p className="state-card">{t("lineup.empty")}</p>
      : <div className="public-lineup-list">{lineup.data.players.map((entry) => <div className="public-lineup-player" key={entry.id}><ClubLogo club={entry.player.club} /><SquadPlayerCard entry={entry} readOnly /><strong className="lineup-points">{pointsByPlayer.get(entry.playerId) ?? 0} {t("common.pointsShort")}</strong></div>)}</div>}
  </Modal>;
}
