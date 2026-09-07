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
  return <Modal title={lineup.data?.user.name ?? name} onClose={onClose} className="lineup-modal">
    <p className="eyebrow">{t("lineup.title")}</p>
    {lineup.isPending ? <div className="modal-loading" role="status"><Loader label={t("loading.team")} /></div>
      : lineup.isError ? <div role="alert" className="state-card state-card--error">{t("lineup.error")} <button className="button button--secondary" onClick={() => void lineup.refetch()}>{t("friends.retry")}</button></div>
      : !lineup.data.players.length ? <p className="state-card">{t("lineup.empty")}</p>
      : <div className="public-lineup-list">{lineup.data.players.map((entry) => <div className="public-lineup-player" key={entry.id}><ClubLogo club={entry.player.club} /><SquadPlayerCard entry={entry} readOnly /><strong className="lineup-points">{entry.points} {t("common.pointsShort")}</strong></div>)}</div>}
  </Modal>;
}
