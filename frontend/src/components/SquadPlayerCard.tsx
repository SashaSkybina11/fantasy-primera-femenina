import { createPortal } from "react-dom";
import { useState } from "react";
import { FaExchangeAlt } from "react-icons/fa";
import { Modal } from "./Modal";
import { ClubLogo } from "./ClubLogo";
import { playerSummaryLabel } from "../services/api";
import type { SquadEntry } from "../types";
import { useLocale } from "../contexts/LocaleContext";

export function SquadPlayerCard({
  entry,
  compact = false,
  readOnly = false,
  disabled = false,
  onMove,
  onCaptain,
  onRemove,
}: {
  entry: SquadEntry;
  compact?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
  onMove?: () => void;
  onCaptain?: () => void;
  onRemove?: () => void;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { locale, t } = useLocale();
  const moveLabel =
    entry.status === "STARTER" ? t("squad.moveBench") : t("squad.moveStarter");
  if (compact) return <>
    <article className={`squad-player-card squad-player-card--compact ${entry.status === "BENCH" ? "squad-player-card--bench" : ""}`}>
      {!readOnly && <>
        {entry.status === "STARTER" && <button className={`squad-icon squad-icon--captain ${entry.isCaptain ? "is-captain" : ""}`} aria-label={entry.isCaptain ? t("squad.removeCaptain") : t("squad.captain")} aria-pressed={entry.isCaptain} disabled={disabled} onClick={onCaptain}>★</button>}
        <button className="squad-icon squad-icon--remove" aria-label={t("squad.remove")} disabled={disabled} onClick={onRemove}>×</button>
      </>}
      <button className="squad-player-details" onClick={() => setDetailsOpen(true)} aria-label={t("squad.details", { name: entry.player.name })}>
        <span className="jersey-number">#{entry.player.displayNumber ?? entry.player.number}</span>
        <h3>{entry.player.name}</h3>
      </button>
      {!readOnly && <button className={entry.status === "BENCH" ? "squad-exchange-button" : "squad-bench-button"} aria-label={moveLabel} title={moveLabel} disabled={disabled} onClick={onMove}>{entry.status === "BENCH" ? <FaExchangeAlt aria-hidden="true" /> : moveLabel}</button>}
    </article>
    {detailsOpen && createPortal(<Modal title={entry.player.name} onClose={() => setDetailsOpen(false)} className="squad-detail-modal">
      <span className="jersey-number">#{entry.player.displayNumber ?? entry.player.number}</span>
      <div className="squad-detail-club"><ClubLogo club={entry.player.club} /><strong>{entry.player.club.name}</strong></div>
      <p>{playerSummaryLabel(entry.player, locale)}</p>
    </Modal>, document.body)}
  </>;
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
