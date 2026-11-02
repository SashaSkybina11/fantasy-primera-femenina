import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";
import { useLocale } from "../contexts/LocaleContext";
import { Modal } from "./Modal";
import { SquadPlayerCard } from "./SquadPlayerCard";
import { ClubLogo } from "./ClubLogo";
import { Loader } from "./Loader";
import { useEffect, useState } from "react";

export function PublicLineupModal({ userId, name, onClose, admin = false, gameweekId }: { userId: string; name: string; onClose: () => void; admin?: boolean; gameweekId?: string }) {
  const { t } = useLocale();
  const [selectedGameweekId, setSelectedGameweekId] = useState(gameweekId ?? "");
  const lineup = useQuery({ queryKey: ["public-lineup", userId], queryFn: () => api.publicLineup(userId), gcTime: 0 });
  const history = useQuery({ queryKey: ["member-gameweek-history", userId], queryFn: () => api.member(userId), enabled: !admin, gcTime: 0 });
  const adminHistory = useQuery({ queryKey: ["admin-user-gameweek-history", userId], queryFn: () => api.adminUserGameweekHistory(userId), enabled: admin, gcTime: 0 });
  const historicalLineup = useQuery({ queryKey: ["admin-historical-lineup", userId, selectedGameweekId], queryFn: () => api.adminHistoricalLineup(userId, selectedGameweekId), enabled: admin && Boolean(selectedGameweekId), gcTime: 0 });
  useEffect(() => {
    if (!selectedGameweekId && adminHistory.data?.length) setSelectedGameweekId(adminHistory.data[0].gameweek.id);
  }, [adminHistory.data, selectedGameweekId]);
  const previousGameweek = history.data?.gameweekPoints[0];
  const activeLineup = admin ? historicalLineup.data : lineup.data;
  const pointsByPlayer = new Map((previousGameweek?.breakdown ?? []).map((entry) => [entry.playerId, entry.points]));
  const isPending = admin ? adminHistory.isPending || historicalLineup.isPending : lineup.isPending || history.isPending;
  const hasError = admin ? adminHistory.isError || historicalLineup.isError : lineup.isError || history.isError;
  const title = admin ? historicalLineup.data?.user.name : lineup.data?.user.name;
  return <Modal title={title ?? name} onClose={onClose} className="lineup-modal">
    {admin && adminHistory.data && <label className="field"><span>{t("leaderboard.myGameweeks")}</span><select value={selectedGameweekId} onChange={(event) => setSelectedGameweekId(event.target.value)}>{adminHistory.data.map((row) => <option key={row.gameweek.id} value={row.gameweek.id}>{t("gameweek.label", { number: row.gameweek.number })}</option>)}</select></label>}
    <p className="eyebrow">{admin ? t("gameweek.label", { number: adminHistory.data?.find((row) => row.gameweek.id === selectedGameweekId)?.gameweek.number ?? "—" }) : previousGameweek ? t("gameweek.label", { number: previousGameweek.gameweek.number }) : t("lineup.title")}</p>
    {isPending ? <div className="modal-loading" role="status"><Loader label={t("loading.team")} /></div>
      : hasError ? <div role="alert" className="state-card state-card--error">{t("lineup.error")} <button className="button button--secondary" onClick={() => void (admin ? historicalLineup.refetch() : lineup.refetch())}>{t("friends.retry")}</button></div>
      : !activeLineup?.players.length ? <p className="state-card">{t("lineup.empty")}</p>
      : <div className="public-lineup-list">{activeLineup.players.map((entry) => <div className="public-lineup-player" key={entry.id}><ClubLogo club={entry.player.club} /><SquadPlayerCard entry={entry} readOnly /><strong className="lineup-points">{admin ? entry.points : pointsByPlayer.get(entry.playerId) ?? 0} {t("common.pointsShort")}</strong></div>)}</div>}
  </Modal>;
}
