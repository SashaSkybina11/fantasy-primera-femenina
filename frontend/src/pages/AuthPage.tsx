import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { IoIosFootball } from "react-icons/io";
import { useAuth } from "../contexts/AuthContext";
import { useLocale } from "../contexts/LocaleContext";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { Loader } from "../components/Loader";

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const { user, isLoading, login, register } = useAuth();
  const { t } = useLocale();
  const navigate = useNavigate();
  const location = useLocation();
  const isRegister = mode === "register";
  const [isPending, setIsPending] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  if (isLoading) return <main className="initial-loader"><Loader label={t("loading.app")} /></main>;
  if (user) return <Navigate to="/" replace />;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsPending(true);
    try {
      if (isRegister) await register(form); else await login({ email: form.email, password: form.password });
      toast.success(isRegister ? t("auth.registerSuccess") : t("auth.loginSuccess"));
      navigate(location.state?.from?.pathname ?? "/", { replace: true });
    } catch (error) { toast.error(error instanceof Error ? error.message : t("auth.loginError")); }
    finally { setIsPending(false); }
  };

  return <main className="auth-page"><section className="auth-aside"><div className="auth-brand"><span className="brand-mark"><IoIosFootball aria-hidden="true" /></span><span>Fantasy Primera División<br />Fútbol Sala Femenino</span></div><div><p className="eyebrow">{t("auth.privateLeague")}</p><h1>{t("auth.futsal")}<br /><em>{t("auth.your")}</em> {t("auth.team")}</h1><p>{t("auth.description")}</p></div><div className="auth-orb" /></section>
    <section className="auth-form-wrap"><div className="auth-language"><LanguageSwitcher /></div><form className="auth-form" onSubmit={submit}><p className="eyebrow">{isRegister ? t("auth.newMember") : t("auth.leagueMember")}</p><h2>{isRegister ? t("auth.createProfile") : t("auth.welcomeBack")}</h2><p className="muted">{isRegister ? t("auth.registerDescription") : t("auth.loginDescription")}</p>
      {isRegister && <label>{t("auth.name")}<input required minLength={2} autoComplete="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder={t("auth.namePlaceholder")} /></label>}
      <label>{t("auth.email")}<input required type="email" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="you@example.com" /></label>
      <label>{t("auth.password")}<input required type="password" minLength={8} autoComplete={isRegister ? "new-password" : "current-password"} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder={t("auth.passwordPlaceholder")} /></label>
      <button className="button button--wide" disabled={isPending}>{isPending ? t("auth.wait") : isRegister ? t("auth.createAccount") : t("auth.signIn")}</button>
      <p className="switch-auth">{isRegister ? t("auth.hasAccount") : t("auth.newHere")} <button type="button" onClick={() => navigate(isRegister ? "/login" : "/register")}>{isRegister ? t("auth.signIn") : t("auth.signUp")}</button></p>
    </form></section>
  </main>;
}
