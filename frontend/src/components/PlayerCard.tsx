import { formatEuro, positionLabel } from "../services/api";
import type { Player } from "../types";
import { useLocale } from "../contexts/LocaleContext";

export function PlayerCard({ player, disabled, label, onClick }: { player: Player; disabled?: boolean; label?: string; onClick?: () => void }) {
  const { locale, t } = useLocale();
  return (
    <article className="player-card">
      <div className="player-card__top"><span className="jersey-number">#{player.number}</span><span className={`position-tag position-tag--${player.position}`}>{positionLabel(player.position, locale)}</span></div>
      <h3>{player.name}</h3>
      <p>{player.club?.name ?? t("player.club")}</p>
      <footer><strong>{formatEuro(player.price, locale)}</strong><button className="button button--small" disabled={disabled} onClick={onClick}>{label ?? t("player.add")}</button></footer>
    </article>
  );
}
