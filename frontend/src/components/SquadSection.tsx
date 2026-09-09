import type { SquadEntry, SquadStatus } from "../types";
import { SquadPlayerCard } from "./SquadPlayerCard";
import { useLocale } from "../contexts/LocaleContext";

export function SquadSection({
  title,
  subtitle,
  status,
  players,
  showEmptySlots = true,
  readOnly,
  disabled = false,
  onMove,
  onCaptain,
  onRemove,
}: {
  title: string;
  subtitle: string;
  status: SquadStatus;
  players: SquadEntry[];
  showEmptySlots?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
  onMove?: (entry: SquadEntry) => void;
  onCaptain?: (entry: SquadEntry) => void;
  onRemove?: (entry: SquadEntry) => void;
}) {
  const { t } = useLocale();

  const goalkeeper = players.find(
    (entry) => entry.player.position === "GOALKEEPER",
  );

  const fieldPlayers = players.filter(
    (entry) => entry.player.position !== "GOALKEEPER",
  );

  const renderPlayer = (entry: SquadEntry) => (
    <SquadPlayerCard
      key={entry.id}
      entry={entry}
      readOnly={readOnly}
      disabled={disabled}
      onMove={() => onMove?.(entry)}
      onCaptain={() => onCaptain?.(entry)}
      onRemove={() => onRemove?.(entry)}
    />
  );

  return (
    <section
      className={`squad-section ${
        status === "STARTER" ? "squad-section--starters" : ""
      }`}
    >
      <header>
        <div>
          <p className="eyebrow">{subtitle}</p>
          <h2>{title}</h2>
        </div>

        <span className="section-counter">{players.length}/5</span>
      </header>

      {status === "STARTER" ? (
        <div className="squad-field">
          <div className="squad-field__goalkeeper">
            {goalkeeper ? (
              renderPlayer(goalkeeper)
            ) : showEmptySlots ? (
              <div className="squad-slot squad-slot--field">
                {t("squad.freeSlot")}
              </div>
            ) : null}
          </div>

          <div className="squad-field__players">
            {fieldPlayers.map(renderPlayer)}

            {showEmptySlots &&
              Array.from({
                length: Math.max(0, 4 - fieldPlayers.length),
              }).map((_, index) => (
                <div
                  className="squad-slot squad-slot--field"
                  key={`field-slot-${index}`}
                >
                  {t("squad.freeSlot")}
                </div>
              ))}
          </div>
        </div>
      ) : (
        <div className="squad-list">
          {players.map(renderPlayer)}

          {showEmptySlots &&
            Array.from({
              length: Math.max(0, 5 - players.length),
            }).map((_, index) => (
              <div className="squad-slot" key={`slot-${index}`}>
                {t("squad.freeSlot")}
              </div>
            ))}
        </div>
      )}
    </section>
  );
}
