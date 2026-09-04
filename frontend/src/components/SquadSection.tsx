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
  onMove?: (entry: SquadEntry) => void;
  onCaptain?: (entry: SquadEntry) => void;
  onRemove?: (entry: SquadEntry) => void;
}) {
  const { t } = useLocale();
  const slots = Math.max(0, 5 - players.length);
  return (
    <section className="squad-section">
      <header>
        <div>
          <p className="eyebrow">{subtitle}</p>
          <h2>{title}</h2>
        </div>
        <span className="section-counter">{players.length}/5</span>
      </header>
      <div className="squad-list">
        {players.map((entry) => (
          <SquadPlayerCard
            key={entry.id}
            entry={entry}
            readOnly={readOnly}
            onMove={() => onMove?.(entry)}
            onCaptain={() => onCaptain?.(entry)}
            onRemove={() => onRemove?.(entry)}
          />
        ))}
        {showEmptySlots &&
          Array.from({ length: slots }).map((_, index) => (
            <div className="squad-slot" key={`slot-${index}`}>
              {t("squad.freeSlot")}
            </div>
          ))}
      </div>
    </section>
  );
}
