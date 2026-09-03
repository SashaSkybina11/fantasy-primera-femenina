import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { Avatar } from "../components/Avatar";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { useLocale } from "../contexts/LocaleContext";

const projectName = <>Fantasy Primera División<br />Fútbol Sala Femenino</>;

function NavLinks({ mobile = false, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) {
  const { t } = useLocale();
  const navigation = [
    { to: "/", label: t("nav.home"), icon: "⌂", end: true },
    { to: "/my-team", label: t("nav.myTeam"), mobile: t("nav.team"), icon: "▦" },
    { to: "/purchase-players", label: t("nav.purchase"), icon: "＋" },
    { to: "/calendar", label: t("nav.calendar"), icon: "□" },
    { to: "/teams", label: t("nav.teams"), icon: "⌁" },
    { to: "/league", label: t("nav.league"), icon: "◌" },
    { to: "/profile", label: t("nav.profile"), icon: "◉" },
  ];
  return <>{navigation.map((item) => <NavLink key={item.to} to={item.to} end={item.end} onClick={onNavigate} className={({ isActive }) => `nav-link ${isActive ? "nav-link--active" : ""}`}><i>{item.icon}</i><span>{mobile ? item.mobile ?? item.label : item.label}</span></NavLink>)}</>;
}

export function AppShell() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t } = useLocale();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const signOut = async () => { await logout(); navigate("/login"); };
  const closeMenu = () => setMenuOpen(false);

  return <div className="app-shell">
    <aside className="sidebar">
      <NavLink to="/" end className="brand"><span className="brand-mark">F</span><span>{projectName}</span></NavLink>
      <nav className="sidebar__nav" aria-label={t("nav.primary")}><NavLinks /></nav>
      <div className="sidebar__bottom">
        <LanguageSwitcher />
        <button className="theme-toggle" onClick={toggleTheme}><span>{theme === "light" ? "☼" : "☾"}</span>{theme === "light" ? t("theme.light") : t("theme.dark")}</button>
        {user && <div className="user-mini"><Avatar name={user.name} src={user.avatarUrl} size="sm" /><span>{user.name}</span></div>}
        <button className="logout-button" onClick={signOut}>{t("nav.logout")} <span>↗</span></button>
      </div>
    </aside>
    <header className="mobile-header">
      <NavLink to="/" end className="mobile-brand"><span className="brand-mark">F</span><span>{projectName}</span></NavLink>
      <div className="mobile-controls">
        <button className="mobile-theme-toggle" onClick={toggleTheme} aria-label={t("theme.switch")}>{theme === "light" ? "☾" : "☼"}</button>
        <button className="menu-toggle" onClick={() => setMenuOpen((open) => !open)} aria-label={t("nav.openMenu")} aria-expanded={menuOpen}>☰</button>
      </div>
    </header>
    {menuOpen && <><button className="mobile-menu-backdrop" onClick={closeMenu} aria-label={t("nav.closeMenu")} /><aside className="mobile-menu" aria-label={t("nav.primary")}>
      <div className="mobile-menu__head"><span>{t("nav.menu")}</span><button className="icon-button" onClick={closeMenu} aria-label={t("nav.closeMenu")}>×</button></div>
      <nav><NavLinks mobile onNavigate={closeMenu} /></nav>
      <div className="mobile-menu__bottom"><LanguageSwitcher /><button className="theme-toggle" onClick={toggleTheme}><span>{theme === "light" ? "☼" : "☾"}</span>{theme === "light" ? t("theme.light") : t("theme.dark")}</button>{user && <div className="user-mini"><Avatar name={user.name} src={user.avatarUrl} size="sm" /><span>{user.name}</span></div>}<button className="logout-button" onClick={signOut}>{t("nav.logout")} <span>↗</span></button></div>
    </aside></>}
    <main className="page-content"><Outlet /><footer className="site-footer">{t("footer.creator")}: <a href="https://www.instagram.com/s.skybina_19/" target="_blank" rel="noreferrer">Oleksandra Skybina</a></footer></main>
  </div>;
}
