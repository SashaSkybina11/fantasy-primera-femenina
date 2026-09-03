import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { IoIosFootball } from "react-icons/io";
import { GiBuyCard } from "react-icons/gi";
import { RiTeamLine } from "react-icons/ri";
import { MdOutlinePersonOutline } from "react-icons/md";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { Avatar } from "../components/Avatar";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { useLocale } from "../contexts/LocaleContext";

const projectName = <>Fantasy Primera División<br />Fútbol Sala Femenino</>;

type IconName = "shirt" | "calendar" | "trophy" | "home" | "purchase" | "teams" | "profile";

function FootballIcon({ name }: { name: IconName }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  if (name === "home") return <IoIosFootball aria-hidden="true" />;
  if (name === "purchase") return <GiBuyCard aria-hidden="true" />;
  if (name === "teams") return <RiTeamLine aria-hidden="true" />;
  if (name === "profile") return <MdOutlinePersonOutline aria-hidden="true" />;
  if (name === "shirt") return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><path d="m8 4 4 2 4-2 4 3-2.4 4.1-2.1-1.2V20H8.5V9.9l-2.1 1.2L4 7l4-3Z" /></svg>;
  if (name === "calendar") return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 10h18m-11 5h4m-2-2v4" /></svg>;
  if (name === "trophy") return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" /><path d="M8 6H4v1a4 4 0 0 0 4 4m8-5h4v1a4 4 0 0 1-4 4m-4-2v5m-3 6h6m-7 0h8" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}><path d="m8 4 4 2 4-2 4 3-2.4 4.1-2.1-1.2V20H8.5V9.9l-2.1 1.2L4 7l4-3Z" /></svg>;
}

function NavLinks({ mobile = false, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) {
  const { t } = useLocale();
  const navigation = [
    { to: "/", label: t("nav.home"), icon: "home" as const, end: true },
    { to: "/my-team", label: t("nav.myTeam"), mobile: t("nav.team"), icon: "shirt" as const },
    { to: "/purchase-players", label: t("nav.purchase"), icon: "purchase" as const },
    { to: "/calendar", label: t("nav.calendar"), icon: "calendar" as const },
    { to: "/teams", label: t("nav.teams"), icon: "teams" as const },
    { to: "/league", label: t("nav.league"), icon: "trophy" as const },
    { to: "/profile", label: t("nav.profile"), icon: "profile" as const },
  ];
  return <>{navigation.map((item) => <NavLink key={item.to} to={item.to} end={item.end} onClick={onNavigate} className={({ isActive }) => `nav-link ${isActive ? "nav-link--active" : ""}`}><i><FootballIcon name={item.icon} /></i><span>{mobile ? item.mobile ?? item.label : item.label}</span></NavLink>)}</>;
}

export function AppShell() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t } = useLocale();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const logoutCloseButton = useRef<HTMLButtonElement>(null);
  const logoutTrigger = useRef<HTMLElement | null>(null);
  const requestSignOut = (event: React.MouseEvent<HTMLButtonElement>) => { logoutTrigger.current = event.currentTarget; setMenuOpen(false); setLogoutDialogOpen(true); };
  const signOut = async () => { await logout(); setLogoutDialogOpen(false); navigate("/login"); };
  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    if (!logoutDialogOpen) {
      logoutTrigger.current?.focus();
      return;
    }
    logoutCloseButton.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setLogoutDialogOpen(false); };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [logoutDialogOpen]);

  return <div className="app-shell">
    <aside className="sidebar">
      <NavLink to="/" end className="brand"><span className="brand-mark"><IoIosFootball aria-hidden="true" /></span><span>{projectName}</span></NavLink>
      <nav className="sidebar__nav" aria-label={t("nav.primary")}><NavLinks /></nav>
      <div className="sidebar__bottom">
        <LanguageSwitcher />
        <button className="theme-toggle" onClick={toggleTheme}><span>{theme === "light" ? "☼" : "☾"}</span>{theme === "light" ? t("theme.light") : t("theme.dark")}</button>
        {user && <div className="user-mini"><Avatar name={user.name} src={user.avatarUrl} size="sm" /><span>{user.name}</span></div>}
        <button className="logout-button" onClick={requestSignOut}>{t("nav.logout")} <span>↗</span></button>
      </div>
    </aside>
    <header className="mobile-header">
      <NavLink to="/" end className="mobile-brand"><span className="brand-mark"><IoIosFootball aria-hidden="true" /></span><span>{projectName}</span></NavLink>
      <div className="mobile-controls">
        <button className="mobile-theme-toggle" onClick={toggleTheme} aria-label={t("theme.switch")}>{theme === "light" ? "☾" : "☼"}</button>
        <button className="menu-toggle" onClick={() => setMenuOpen((open) => !open)} aria-label={t("nav.openMenu")} aria-expanded={menuOpen}>☰</button>
      </div>
    </header>
    {menuOpen && <><button className="mobile-menu-backdrop" onClick={closeMenu} aria-label={t("nav.closeMenu")} /><aside className="mobile-menu" aria-label={t("nav.primary")}>
      <div className="mobile-menu__head"><span>{t("nav.menu")}</span><button className="icon-button" onClick={closeMenu} aria-label={t("nav.closeMenu")}>×</button></div>
      <nav><NavLinks mobile onNavigate={closeMenu} /></nav>
      <div className="mobile-menu__bottom"><LanguageSwitcher /><button className="theme-toggle" onClick={toggleTheme}><span>{theme === "light" ? "☼" : "☾"}</span>{theme === "light" ? t("theme.light") : t("theme.dark")}</button>{user && <div className="user-mini"><Avatar name={user.name} src={user.avatarUrl} size="sm" /><span>{user.name}</span></div>}<button className="logout-button" onClick={requestSignOut}>{t("nav.logout")} <span>↗</span></button></div>
    </aside></>}
    {logoutDialogOpen && <div className="logout-modal-backdrop" onClick={() => setLogoutDialogOpen(false)}>
      <section className="logout-modal" role="dialog" aria-modal="true" aria-labelledby="logout-modal-title" aria-describedby="logout-modal-description" onClick={(event) => event.stopPropagation()}>
        <button ref={logoutCloseButton} className="logout-modal__close" onClick={() => setLogoutDialogOpen(false)} aria-label={t("logout.close")}>×</button>
        <p className="eyebrow">{t("logout.eyebrow")}</p>
        <h2 id="logout-modal-title">{t("logout.title")}</h2>
        <p id="logout-modal-description">{t("logout.description")}</p>
        <div className="logout-modal__actions"><button className="logout-modal__confirm" onClick={signOut}>{t("logout.confirm")}</button><button className="logout-modal__cancel" onClick={() => setLogoutDialogOpen(false)}>{t("logout.cancel")}</button></div>
      </section>
    </div>}
    <main className="page-content"><Outlet /><footer className="site-footer">{t("footer.creator")}: <a href="https://www.instagram.com/s.skybina_19/" target="_blank" rel="noreferrer">Oleksandra Skybina</a></footer></main>
  </div>;
}
