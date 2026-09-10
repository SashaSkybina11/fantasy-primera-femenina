import { nationalityLabel } from "../services/api";
import type { Club, PlayerRole } from "../types";
import { useLocale } from "../contexts/LocaleContext";

export type PlayerFilterState = {
  clubId: string;
  role: "" | PlayerRole;
  search: string;
  nationality?: string;
  priceSort?: "" | "asc" | "desc";
};

export function PlayerFilters({
  clubs,
  nationalities,
  value,
  onChange,
}: {
  clubs: Club[];
  nationalities?: string[];
  value: PlayerFilterState;
  onChange: (value: PlayerFilterState) => void;
}) {
  const { locale, t } = useLocale();
  return (
    <div className={`filters${nationalities ? " filters--purchase" : ""}`}>
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
      {nationalities && <>
      <label>
        <span>{t("player.nationality")}</span>
        <select value={value.nationality} onChange={(event) => onChange({ ...value, nationality: event.target.value })}>
          <option value="">{t("player.allNationalities")}</option>
          {nationalities.map((code) => <option key={code} value={code}>{nationalityLabel(code, locale)}</option>)}
        </select>
      </label>
      <label>
        <span>{t("player.priceSort")}</span>
        <select value={value.priceSort} onChange={(event) => onChange({ ...value, priceSort: event.target.value as PlayerFilterState["priceSort"] })}>
          <option value="">{t("player.defaultSort")}</option>
          <option value="desc">{t("player.priceDescending")}</option>
          <option value="asc">{t("player.priceAscending")}</option>
        </select>
      </label>
      </>}
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
