import { RxCross1 } from "react-icons/rx";
import { createPortal } from "react-dom";
import { useState } from "react";
import { GoArrowRight } from "react-icons/go";
import { Modal } from "./Modal";
import { ClubLogo } from "./ClubLogo";
import { formatEuro, imageUrl, nationalityLabel, playerAgeLabel, playerSummaryLabel, roleLabel } from "../services/api";
import type { SquadEntry } from "../types";
import { useLocale } from "../contexts/LocaleContext";

function playerInitials(name: string) {
  const latin: Record<string, string> = { А: "A", Б: "B", В: "V", Г: "H", Ґ: "G", Д: "D", Е: "E", Є: "Y", Ё: "Y", Ж: "Z", З: "Z", И: "I", І: "I", Ї: "Y", Й: "Y", К: "K", Л: "L", М: "M", Н: "N", О: "O", П: "P", Р: "R", С: "S", Т: "T", У: "U", Ф: "F", Х: "K", Ц: "T", Ч: "C", Ш: "S", Щ: "S", Э: "E", Ю: "Y", Я: "Y" };
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return [parts[0], parts.length > 1 ? parts[parts.length - 1] : null]
    .filter(Boolean).map(part => { const letter = Array.from(part!)[0].toUpperCase(); return latin[letter] ?? letter; }).join("");
}

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
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  const { locale, t } = useLocale();
  const photo = imageUrl(entry.player.photoUrl);
  const country = entry.player.nationality?.toUpperCase();
  const flag = country && /^[A-Z]{2}$/.test(country)
    ? Array.from(country).map(letter => String.fromCodePoint(127397 + letter.charCodeAt(0))).join("") : "";
  const initialPrice = entry.player.initialPrice;
  const priceDelta = initialPrice == null ? null : entry.player.price - initialPrice;
  const priceClass = priceDelta === null || priceDelta === 0 ? "" : priceDelta > 0 ? "price-delta--up" : "price-delta--down";
  const moveLabel =
    entry.status === "STARTER" ? t("squad.moveBench") : t("squad.moveStarter");
  if (compact) return <>
    <article className={`squad-player-card squad-player-card--compact ${entry.status === "BENCH" ? "squad-player-card--bench" : ""}`}>
      {!readOnly && <>
        {entry.status === "STARTER" && <button className={`squad-icon squad-icon--captain ${entry.isCaptain ? "is-captain" : ""}`} aria-label={entry.isCaptain ? t("squad.removeCaptain") : t("squad.captain")} aria-pressed={entry.isCaptain} disabled={disabled} onClick={onCaptain}>★</button>}
        <button className="squad-icon squad-icon--remove" aria-label={t("squad.remove")} disabled={disabled} onClick={onRemove}><RxCross1 className="ui-cross" aria-hidden="true" /></button>
      </>}
      <button className="squad-player-details" onClick={() => setDetailsOpen(true)} aria-label={t("squad.details", { name: entry.player.name })}>
        <span className="jersey-number">#{entry.player.displayNumber ?? entry.player.number}</span>
        <h3>{entry.player.name}</h3>
      </button>
      {!readOnly && <button className={entry.status === "BENCH" ? "squad-exchange-button" : "squad-bench-button"} aria-label={moveLabel} title={moveLabel} disabled={disabled} onClick={onMove}>{entry.status === "BENCH" ? <GoArrowRight className="ui-arrow" aria-hidden="true" /> : moveLabel}</button>}
    </article>
    {detailsOpen && createPortal(<Modal title={entry.player.name} onClose={() => setDetailsOpen(false)} className="squad-detail-modal fut-player-modal" hideCloseButton>
      <article className="fut-player-card">
      <button type="button" className="compact-modal__close" aria-label={t("friends.close")} onClick={() => setDetailsOpen(false)} autoFocus><RxCross1 className="ui-cross" aria-hidden="true" /></button>
      <div className="fut-player-card__portrait">
        {photo && failedPhoto !== photo
          ? <img src={photo} alt={entry.player.name} onError={() => setFailedPhoto(photo)} />
          : <span className="fut-player-card__initials" aria-hidden="true">{playerInitials(entry.player.name)}</span>}
      </div>
      <h2 className="fut-player-card__name">{entry.player.name} <span className="fut-player-card__number">#{entry.player.displayNumber ?? entry.player.number}</span></h2>
      <div className="squad-detail-club"><ClubLogo club={entry.player.club} /><strong>{entry.player.club.name}</strong></div>
      <p className="fut-player-card__facts">{[roleLabel(entry.player.role, locale), playerAgeLabel(entry.player.age, locale), country ? `${flag} ${nationalityLabel(country, locale)}`.trim() : null].filter(Boolean).join(" · ")}</p>
      <dl className="squad-price-comparison">
        <div><dt>{t("squad.initialPrice")}</dt><dd>{initialPrice == null ? t("squad.priceUnknown") : formatEuro(initialPrice, locale)}<span className="squad-price-comparison__arrow" aria-hidden="true"><GoArrowRight className="ui-arrow" /></span></dd></div>
        <div><dt>{t("prices.current")}</dt><dd className={priceClass}>{formatEuro(entry.player.price, locale)}</dd></div>
        {priceDelta !== null && <div className="squad-price-comparison__change"><dt>{t("squad.valueChange")}</dt><dd className={priceClass}>{priceDelta > 0 ? "+" : ""}{formatEuro(priceDelta, locale)}</dd></div>}
      </dl>
      </article>
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
