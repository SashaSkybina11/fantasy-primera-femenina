import { imageUrl } from "../services/api";
import { useLocale } from "../contexts/LocaleContext";

export function Avatar({ name, src, size = "md" }: { name: string; src?: string | null; size?: "sm" | "md" | "lg" }) {
  const { t } = useLocale();
  const url = imageUrl(src);
  return url ? <img className={`avatar avatar--${size}`} src={url} alt={t("avatar.alt", { name })} /> : <span className={`avatar avatar--${size} avatar--fallback`}>{name.slice(0, 1).toUpperCase()}</span>;
}
