import type { Club, Position } from "../types";
import { useLocale } from "../contexts/LocaleContext";

export type PlayerFilterState = { clubId: string; position: "" | Position; search: string };

export function PlayerFilters({ clubs, value, onChange }: { clubs: Club[]; value: PlayerFilterState; onChange: (value: PlayerFilterState) => void }) {
  const { t } = useLocale();
  return (
    <div className="filters">
      <label><span>{t("player.club")}</span><select value={value.clubId} onChange={(event) => onChange({ ...value, clubId: event.target.value })}><option value="">{t("player.allClubs")}</option>{clubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}</select></label>
      <label><span>{t("player.position")}</span><select value={value.position} onChange={(event) => onChange({ ...value, position: event.target.value as PlayerFilterState["position"] })}><option value="">{t("player.allPositions")}</option><option value="GOALKEEPER">{t("player.goalkeeper")}</option><option value="FIELD_PLAYER">{t("player.fieldPlayer")}</option></select></label>
      <label className="filters__search"><span>{t("player.search")}</span><input value={value.search} onChange={(event) => onChange({ ...value, search: event.target.value })} placeholder={t("player.searchPlaceholder")} /></label>
    </div>
  );
}
