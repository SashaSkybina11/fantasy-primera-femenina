import { playerSummaryLabel } from "../services/api";
import type { SquadEntry } from "../types";
import { useLocale } from "../contexts/LocaleContext";

export function SquadPlayerCard({
  entry,
  readOnly = false,
  disabled = false,
  onMove,
  onCaptain,
  onRemove,
}: {
  entry: SquadEntry;
  readOnly?: boolean;
  disabled?: boolean;
  onMove?: () => void;
  onCaptain?: () => void;
  onRemove?: () => void;
}) {
  const { locale, t } = useLocale();
  const moveLabel =
    entry.status === "STARTER" ? t("squad.moveBench") : t("squad.moveStarter");
  return (
    <article className="squad-player-card">
      <span className="jersey-number">
        #{entry.player.displayNumber ?? entry.player.number}
      </span>
      <div className="squad-player-card__main">
        <h3>
          {entry.player.name}{" "}
          {entry.isCaptain && (
            <span className="captain-badge">{t("squad.captainBadge")}</span>
          )}
        </h3>
        <p>
          {entry.player.club.name} · {playerSummaryLabel(entry.player, locale)}
        </p>
      </div>
      {!readOnly && (
        <div className="squad-actions">
          {entry.status === "STARTER" && (
            <button
              className={`text-button ${entry.isCaptain ? "text-button--active" : ""}`}
              disabled={disabled} onClick={onCaptain}
            >
              {entry.isCaptain ? t("squad.removeCaptain") : t("squad.captain")}
            </button>
          )}
          <button className="text-button" disabled={disabled} onClick={onMove}>
            {moveLabel}
          </button>
          <button
            className="text-button text-button--danger"
            disabled={disabled} onClick={onRemove}
          >
            {t("squad.remove")}
          </button>
        </div>
      )}
    </article>
  );
}
