import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { Avatar } from "../components/Avatar";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { useLocale } from "../contexts/LocaleContext";

function NavLinks({ mobile = false }: { mobile?: boolean }) {
  const { t } = useLocale();
  const navigation = [
    { to: "/profile", label: t("nav.profile"), icon: "◉" },
    { to: "/my-team", label: t("nav.myTeam"), mobile: t("nav.team"), icon: "▦" },
    { to: "/teams", label: t("nav.teams"), icon: "⌁" },
    { to: "/league", label: t("nav.league"), icon: "◌" },
  ];
  return <>{navigation.map((item) => <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-link ${isActive ? "nav-link--active" : ""}`}><i>{item.icon}</i><span>{mobile ? item.mobile ?? item.label : item.label}</span></NavLink>)}</>;
}

export function AppShell() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t } = useLocale();
  const navigate = useNavigate();
  const signOut = async () => { await logout(); navigate("/login"); };

  return <div className="app-shell">
    <aside className="sidebar">
      <NavLink to="/profile" className="brand"><span className="brand-mark">F</span><span>Fantasy<br />Primera División</span></NavLink>
      <nav className="sidebar__nav"><NavLinks /></nav>
      <div className="sidebar__bottom">
        <LanguageSwitcher />
        <button className="theme-toggle" onClick={toggleTheme}><span>{theme === "light" ? "☼" : "☾"}</span>{theme === "light" ? t("theme.light") : t("theme.dark")}</button>
        {user && <div className="user-mini"><Avatar name={user.name} src={user.avatarUrl} size="sm" /><span>{user.name}</span></div>}
        <button className="logout-button" onClick={signOut}>{t("nav.logout")} <span>↗</span></button>
      </div>
    </aside>
    <main className="page-content"><Outlet /></main>
    <div className="mobile-controls"><LanguageSwitcher /><button className="mobile-theme-toggle" onClick={toggleTheme} aria-label={t("theme.switch")}>{theme === "light" ? "☾" : "☼"}</button></div>
    <nav className="mobile-nav"><NavLinks mobile /></nav>
  </div>;
}
