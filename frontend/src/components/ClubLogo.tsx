import { useEffect, useState } from "react";
import { imageUrl } from "../services/api";
import type { Club } from "../types";
import { useLocale } from "../contexts/LocaleContext";

export function ClubLogo({ club, large = false }: { club: Club; large?: boolean }) {
  const { t } = useLocale();
  const [failed, setFailed] = useState(false);
  const source = imageUrl(club.logoUrl);
  const initials = club.name.split(" ").slice(0, 2).map((word) => word[0]).join("");

  useEffect(() => setFailed(false), [source]);

  if (!source || failed) {
    return <span className={`club-mark ${large ? "club-mark--large" : ""}`} aria-label={t("clubLogo.alt", { name: club.name })}>{initials}</span>;
  }

  return <img className={`club-logo ${large ? "club-logo--large" : ""}`} src={source} alt={t("clubLogo.alt", { name: club.name })} onError={() => setFailed(true)} />;
}
