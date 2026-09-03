import { formatEuro, playerFactsLabel, roleLabel } from "../services/api";
import type { Player } from "../types";
import { useLocale } from "../contexts/LocaleContext";

export function PlayerCard({ player, disabled, label, notice, onClick }: { player: Player; disabled?: boolean; label?: string; notice?: string; onClick?: () => void }) {
  const { locale, t } = useLocale();
  return (
    <article className="player-card">
      <div className="player-card__top"><span className="jersey-number">#{player.displayNumber ?? player.number}</span><span className={`position-tag position-tag--${player.role}`}>{roleLabel(player.role, locale)}</span></div>
      <h3>{player.name}</h3>
      <p>{player.club?.name ?? t("player.club")}</p>
      {playerFactsLabel(player, locale) && <small className="player-card__meta">{playerFactsLabel(player, locale)}</small>}
      {notice && <small className="player-card__notice">{notice}</small>}
      <footer><strong>{formatEuro(player.price, locale)}</strong><button className="button button--small" disabled={disabled} onClick={onClick}>{label ?? t("player.add")}</button></footer>
    </article>
  );
}
