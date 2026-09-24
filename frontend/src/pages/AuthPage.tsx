import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { IoIosFootball } from "react-icons/io";
import { useAuth } from "../contexts/AuthContext";
import { useLocale } from "../contexts/LocaleContext";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { Loader } from "../components/Loader";
import { PasswordInput } from "../components/PasswordInput";
import { api } from "../services/api";

export function AuthPage({ mode }: { mode: "login" | "register" | "forgot" | "reset" }) {
  const { user, isLoading, login, register, verifyEmail, logout } = useAuth();
  const { t } = useLocale();
  const navigate = useNavigate();
  const location = useLocation();
  const isRegister = mode === "register";
  const isForgot = mode === "forgot";
  const isReset = mode === "reset";
  const [resetParams] = useState(() => new URLSearchParams(location.hash.slice(1)));
  const [pendingEmail, setPendingEmail] = useState(() => isRegister ? sessionStorage.getItem("pending-verification-email") ?? "" : "");
  const verifying = isRegister && Boolean(pendingEmail);
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState(false);
  const [cooldown, setCooldown] = useState(() => verifying ? Math.max(0, Math.ceil((Number(sessionStorage.getItem("pending-verification-retry-at")) - Date.now()) / 1000)) : 0);
  const [isPending, setIsPending] = useState(false);
  const [form, setForm] = useState({ name: "", email: isReset ? resetParams.get("email") ?? "" : pendingEmail, password: "" });
  const validReset = Boolean(resetParams.get("email")) && /^[a-f0-9]{64}$/.test(resetParams.get("token") ?? "");
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown(value => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);
  if (isLoading)
    return (
      <main className="initial-loader">
        <Loader label={t("loading.app")} />
      </main>
    );
  if (user && !isReset) return <Navigate to="/" replace />;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    toast.dismiss();
    setIsPending(true);
    try {
      if (isForgot) {
        await api.forgotPassword(form.email);
        setNotice(true);
        setCooldown(60);
        return;
      }
      if (isReset) {
        await api.resetPassword({ email: form.email, token: resetParams.get("token") ?? "", password: form.password });
        await logout().catch(() => {});
        toast.success(t("auth.resetSuccess"));
        navigate("/login", { replace: true });
        return;
      }
      if (verifying) {
        await verifyEmail({ email: pendingEmail, code });
        sessionStorage.removeItem("pending-verification-email");
        sessionStorage.removeItem("pending-verification-retry-at");
      } else if (isRegister) {
        await register(form);
        const email = form.email.trim().toLowerCase();
        sessionStorage.setItem("pending-verification-email", email);
        sessionStorage.setItem("pending-verification-retry-at", String(Date.now() + 60_000));
        setPendingEmail(email);
        setForm({ ...form, email, password: "" });
        setCooldown(60);
        return;
      } else await login({ email: form.email, password: form.password });
      toast.success(
        isRegister ? t("auth.registerSuccess") : t("auth.loginSuccess"),
      );
      navigate(location.state?.from?.pathname ?? "/", { replace: true });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("auth.loginError"),
      );
    } finally {
      setIsPending(false);
    }
  };

  const resend = async () => {
    toast.dismiss();
    setIsPending(true);
    try {
      await api.resendVerification(pendingEmail);
      sessionStorage.setItem("pending-verification-retry-at", String(Date.now() + 60_000));
      setCooldown(60);
      setCode("");
      toast.success(t("auth.codeSent"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("auth.loginError"));
    } finally {
      setIsPending(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-aside">
        <div className="auth-brand">
          <span className="brand-mark">
            <IoIosFootball aria-hidden="true" />
          </span>
          <span>{t("brand.title")}</span>
        </div>
        <div className="auth-story">
          <p className="eyebrow">{t("auth.privateLeague")}</p>
          <h1>
            {t("auth.futsal")}
            <br />
            <em>{t("auth.your")}</em> {t("auth.team")}
          </h1>
          <p>{t("auth.description")}</p>
        </div>
        <div className="auth-court" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
      </section>
      <section className="auth-form-wrap">
        <div className="auth-language">
          <LanguageSwitcher />
        </div>
        <form className="auth-form" onSubmit={submit}>
          <p className="eyebrow">
            {isRegister ? t("auth.newMember") : t("auth.leagueMember")}
          </p>
          <h2>
            {verifying ? t("auth.verifyTitle") : isForgot ? t("auth.forgotTitle") : isReset ? t("auth.resetTitle") : isRegister ? t("auth.createProfile") : t("auth.welcomeBack")}
          </h2>
          <p className="muted">
            {verifying ? t("auth.verifyDescription", { email: pendingEmail }) : isForgot ? t("auth.forgotDescription") : isReset ? t("auth.resetDescription") : isRegister
              ? t("auth.registerDescription")
              : t("auth.loginDescription")}
          </p>
          {notice && <p className="auth-notice" role="status">{t("auth.resetSent")}</p>}
          {isReset && !validReset && <p className="auth-notice" role="alert">{t("auth.invalidReset")}</p>}
          {isRegister && !verifying && (
            <label>
              {t("auth.name")}
              <input
                required
                minLength={2}
                autoComplete="name"
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
                placeholder={t("auth.namePlaceholder")}
              />
            </label>
          )}
          <label>
            {t("auth.email")}
            <input
              required
              type="email"
              readOnly={verifying || isReset}
              autoComplete="email"
              value={form.email}
              onChange={(event) => {
                setForm({ ...form, email: event.target.value });
                setNotice(false);
              }}
              placeholder={t("auth.emailPlaceholder")}
            />
          </label>
          {verifying && <label>
            {t("auth.code")}
            <input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ""))} autoFocus />
          </label>}
          {!verifying && !isForgot && <label>
            {t("auth.password")}
            <PasswordInput
              required
              minLength={8}
              maxLength={72}
              autoComplete={isRegister || isReset ? "new-password" : "current-password"}
              value={form.password}
              onChange={(event) =>
                setForm({ ...form, password: event.target.value })
              }
              placeholder={t("auth.passwordPlaceholder")}
            />
          </label>}
          <button className="button button--wide" disabled={isPending || (isForgot && cooldown > 0) || (isReset && !validReset)}>
            {isPending
              ? t("auth.wait")
              : verifying ? t("auth.verifyButton") : isForgot ? (cooldown > 0 ? t("auth.resendWait", { seconds: cooldown }) : t("auth.sendReset")) : isReset ? t("auth.savePassword") : isRegister
                ? t("auth.createAccount")
                : t("auth.signIn")}
          </button>
          {verifying && <div className="auth-secondary-actions">
            <button type="button" className="text-button" disabled={isPending || cooldown > 0} onClick={resend}>{cooldown > 0 ? t("auth.resendWait", { seconds: cooldown }) : t("auth.resendCode")}</button>
            <button type="button" className="text-button" disabled={isPending} onClick={() => { sessionStorage.removeItem("pending-verification-email"); sessionStorage.removeItem("pending-verification-retry-at"); setPendingEmail(""); setCode(""); }}>{t("auth.changeEmail")}</button>
          </div>}
          {(mode === "login" || isReset) && <div className="auth-secondary-actions"><button type="button" className="text-button" disabled={isPending} onClick={() => navigate("/forgot-password")}>{t("auth.forgotPassword")}</button></div>}
          <p className="switch-auth">
            {isRegister || isForgot || isReset ? t("auth.hasAccount") : t("auth.newHere")}{" "}
            <button
              type="button"
              disabled={isPending}
              onClick={() => navigate(isRegister || isForgot || isReset ? "/login" : "/register")}
            >
              {isRegister || isForgot || isReset ? t("auth.signIn") : t("auth.signUp")}
            </button>
          </p>
        </form>
      </section>
    </main>
  );
}
