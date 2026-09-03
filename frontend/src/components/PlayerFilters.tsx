import type { Club, PlayerRole } from "../types";
import { useLocale } from "../contexts/LocaleContext";

export type PlayerFilterState = {
  clubId: string;
  role: "" | PlayerRole;
  search: string;
};

export function PlayerFilters({
  clubs,
  value,
  onChange,
}: {
  clubs: Club[];
  value: PlayerFilterState;
  onChange: (value: PlayerFilterState) => void;
}) {
  const { t } = useLocale();
  return (
    <div className="filters">
      <label>
        <span>{t("player.club")}</span>
        <select
          value={value.clubId}
          onChange={(event) =>
            onChange({ ...value, clubId: event.target.value })
          }
        >
          <option value="">{t("player.allClubs")}</option>
          {clubs.map((club) => (
            <option key={club.id} value={club.id}>
              {club.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>{t("player.position")}</span>
        <select
          value={value.role}
          onChange={(event) =>
            onChange({
              ...value,
              role: event.target.value as PlayerFilterState["role"],
            })
          }
        >
          <option value="">{t("player.allPositions")}</option>
          <option value="PORTERA">{t("player.goalkeeper")}</option>
          <option value="CIERRE">{t("player.cierre")}</option>
          <option value="ALA">{t("player.ala")}</option>
          <option value="PIVOT">{t("player.pivot")}</option>
        </select>
      </label>
      <label className="filters__search">
        <span>{t("player.search")}</span>
        <input
          value={value.search}
          onChange={(event) =>
            onChange({ ...value, search: event.target.value })
          }
          placeholder={t("player.searchPlaceholder")}
        />
      </label>
    </div>
  );
}
