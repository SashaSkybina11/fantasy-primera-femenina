import { FriendLeaguesPanel } from "../components/FriendLeaguesPanel";
import { useLocale } from "../contexts/LocaleContext";

export function FriendLeaguesPage() {
  const { t } = useLocale();
  return <div className="page friend-leagues-page">
    <header className="page-heading"><p className="eyebrow">{t("home.eyebrow")}</p><h1>{t("nav.friends")}</h1></header>
    <FriendLeaguesPanel />
  </div>;
}
