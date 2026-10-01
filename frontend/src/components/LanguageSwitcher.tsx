import { IoLanguageSharp } from "react-icons/io5";
import { useLocale, type Locale } from "../contexts/LocaleContext";

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, setLocale, t } = useLocale();
  return <span className="language-control"><IoLanguageSharp aria-hidden="true" /><select className={`language-switcher ${className}`.trim()} value={locale} onChange={(event) => setLocale(event.target.value as Locale)} aria-label={t("language.label")}>
    <option value="es">{t("language.es")}</option>
    <option value="uk">{t("language.uk")}</option>
    <option value="en">{t("language.en")}</option>
    <option value="pt">{t("language.pt")}</option>
    <option value="pt-BR">{t("language.pt-BR")}</option>
  </select></span>;
}
