import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { Avatar } from "../components/Avatar";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { useLocale } from "../contexts/LocaleContext";

const projectName = <>Fantasy Primera División<br />Fútbol Sala Femenino</>;

type IconName = "ball" | "shirt" | "boot" | "calendar" | "crest" | "trophy" | "whistle";

function FootballIcon({ name }: { name: IconName }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  if (name === "ball") return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><circle cx="12" cy="12" r="9" /><path d="m12 7 3 2.2-1.1 3.5h-3.8L9 9.2 12 7Z" /><path d="m9 9.2-3.5 1.4M15 9.2l3.5 1.4m-8.3 2.1-2 3.2m5.7-3.2 2 3.2M8.2 15.9l2.1 2.5m5.5-2.5-2.1 2.5" /></svg>;
  if (name === "shirt") return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><path d="m8 4 4 2 4-2 4 3-2.4 4.1-2.1-1.2V20H8.5V9.9l-2.1 1.2L4 7l4-3Z" /></svg>;
  if (name === "boot") return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><path d="M5 5v6.3c0 1.3.8 2.5 2 3l4.4 1.9c1 .4 1.6 1.4 1.6 2.5V20H4a2 2 0 0 1-2-2v-1.2c0-2 1.6-3.7 3.6-3.7h3.2" /><path d="m8 7 2 3m1-2 2 3m1-2 2 3" /></svg>;
  if (name === "calendar") return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 10h18m-11 5h4m-2-2v4" /></svg>;
  if (name === "crest") return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><path d="M12 3 19 6v5c0 4.4-2.9 7.9-7 10-4.1-2.1-7-5.6-7-10V6l7-3Z" /><path d="m8.5 12 2.1 2.1 4.9-4.8" /></svg>;
  if (name === "trophy") return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" /><path d="M8 6H4v1a4 4 0 0 0 4 4m8-5h4v1a4 4 0 0 1-4 4m-4-2v5m-3 6h6m-7 0h8" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><path d="M14.5 4.5 19 9l-4.2 1.3-1.6 4.2-4.5-4.5 1.6-1.6-3-3 1.4-1.4 3 3 1.8-1.8Z" /><path d="m7 14-3 3m5-1-3 3" /></svg>;
}

function NavLinks({ mobile = false, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) {
  const { t } = useLocale();
  const navigation = [
    { to: "/", label: t("nav.home"), icon: "ball" as const, end: true },
    { to: "/my-team", label: t("nav.myTeam"), mobile: t("nav.team"), icon: "shirt" as const },
    { to: "/purchase-players", label: t("nav.purchase"), icon: "boot" as const },
    { to: "/calendar", label: t("nav.calendar"), icon: "calendar" as const },
    { to: "/teams", label: t("nav.teams"), icon: "crest" as const },
    { to: "/league", label: t("nav.league"), icon: "trophy" as const },
    { to: "/profile", label: t("nav.profile"), icon: "whistle" as const },
  ];
  return <>{navigation.map((item) => <NavLink key={item.to} to={item.to} end={item.end} onClick={onNavigate} className={({ isActive }) => `nav-link ${isActive ? "nav-link--active" : ""}`}><i><FootballIcon name={item.icon} /></i><span>{mobile ? item.mobile ?? item.label : item.label}</span></NavLink>)}</>;
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
      <NavLink to="/" end className="brand"><span className="brand-mark"><FootballIcon name="ball" /></span><span>{projectName}</span></NavLink>
      <nav className="sidebar__nav" aria-label={t("nav.primary")}><NavLinks /></nav>
      <div className="sidebar__bottom">
        <LanguageSwitcher />
        <button className="theme-toggle" onClick={toggleTheme}><span>{theme === "light" ? "☼" : "☾"}</span>{theme === "light" ? t("theme.light") : t("theme.dark")}</button>
        {user && <div className="user-mini"><Avatar name={user.name} src={user.avatarUrl} size="sm" /><span>{user.name}</span></div>}
        <button className="logout-button" onClick={signOut}>{t("nav.logout")} <span>↗</span></button>
      </div>
    </aside>
    <header className="mobile-header">
      <NavLink to="/" end className="mobile-brand"><span className="brand-mark"><FootballIcon name="ball" /></span><span>{projectName}</span></NavLink>
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
