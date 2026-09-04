import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Avatar } from "../components/Avatar";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../services/api";
import { useLocale } from "../contexts/LocaleContext";
import { optimizeAvatar } from "../utils/avatar";
import { PasswordInput } from "../components/PasswordInput";
import { FriendLeaguesPanel } from "../components/FriendLeaguesPanel";

export function ProfilePage() {
  const profile = useQuery({ queryKey: ["profile"], queryFn: api.profile });
  const queryClient = useQueryClient();
  const { setUser } = useAuth();
  const { t } = useLocale();
  const input = useRef<HTMLInputElement>(null);
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [avatar, setAvatar] = useState<File | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [instagram, setInstagram] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [contactConsent, setContactConsent] = useState(false);
  useEffect(() => {
    if (profile.data) {
      setName(profile.data.name);
      setTeamName(profile.data.fantasyTeam.name);
      setInstagram(profile.data.instagram ?? "");
      setWhatsapp(profile.data.whatsapp ?? "");
      setContactConsent(profile.data.contactConsent);
    }
  }, [profile.data]);
  const save = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      form.set("name", name);
      form.set("teamName", teamName);
      form.set("instagram", instagram);
      form.set("whatsapp", whatsapp);
      form.set("contactConsent", String(contactConsent));
      if (avatar) form.set("avatar", await optimizeAvatar(avatar));
      return api.updateProfile(form);
    },
    onSuccess: (result) => {
      setUser(result);
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      void queryClient.invalidateQueries({ queryKey: ["team"] });
      setEdit(false);
      setAvatar(null);
      toast.success(t("profile.saved"));
    },
    onError: (error) => toast.error(error.message),
  });
  const removeAvatar = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.set("removeAvatar", "true");
      return api.updateProfile(form);
    },
    onSuccess: (result) => {
      setUser(result);
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success(t("profile.avatarRemoved"));
    },
    onError: (error) => toast.error(error.message),
  });
  const changePassword = useMutation({
    mutationFn: () => api.updatePassword({ currentPassword, newPassword }),
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success(t("profile.passwordSaved"));
    },
    onError: (error) => toast.error(error.message),
  });
  if (profile.isLoading)
    return <div className="state-card">{t("loading.profile")}</div>;
  if (profile.isError || !profile.data)
    return (
      <div className="state-card state-card--error">{t("error.generic")}</div>
    );
  const data = profile.data;
  return (
    <div className="page page--narrow">
      <header className="page-heading">
        <p className="eyebrow">{t("profile.space")}</p>
        <h1>{t("profile.title")}</h1>
      </header>
      <section className="profile-card">
        <div className="profile-card__identity">
          <Avatar name={data.name} src={data.avatarUrl} size="lg" />
          <div>
            <h2>{data.name}</h2>
            <p>{data.email}</p>
          </div>
        </div>
        {!edit ? (
          <>
            <div className="profile-stat">
              <span>{t("profile.teamName")}</span>
              <strong>{data.fantasyTeam.name}</strong>
            </div>
            <div className="contact-links">
              {data.instagramUrl && (
                <a href={data.instagramUrl} target="_blank" rel="noreferrer">
                  Instagram @{data.instagram}
                </a>
              )}
              {data.whatsappUrl && (
                <a href={data.whatsappUrl} target="_blank" rel="noreferrer">
                  WhatsApp {data.whatsapp}
                </a>
              )}
            </div>
            <small className="muted">
              {t("profile.registeredAt")}: {new Date(data.createdAt).toLocaleDateString()}
            </small>
            <button className="button" onClick={() => setEdit(true)}>
              {t("profile.edit")}
            </button>
          </>
        ) : (
          <form
            className="profile-form"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate();
            }}
          >
            <label>
              {t("auth.name")}
              <input
                required
                minLength={2}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label>
              {t("profile.teamName")}
              <input
                required
                minLength={2}
                value={teamName}
                onChange={(event) => setTeamName(event.target.value)}
              />
            </label>
            <label>
              Instagram
              <input
                value={instagram}
                onChange={(event) => setInstagram(event.target.value)}
                placeholder="@username"
              />
            </label>
            <label>
              WhatsApp
              <input
                value={whatsapp}
                onChange={(event) => setWhatsapp(event.target.value)}
                placeholder="+346XXXXXXXX"
              />
            </label>
            <label className="consent-check">
              <input
                type="checkbox"
                checked={contactConsent}
                onChange={(event) => setContactConsent(event.target.checked)}
              />
              {t("profile.contactConsent")}
            </label>
            <div className="avatar-edit">
              <input
                ref={input}
                className="visually-hidden"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif,image/gif,image/heic,image/heif"
                onChange={(event) => setAvatar(event.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                className="button button--secondary"
                onClick={() => input.current?.click()}
              >
                {avatar ? avatar.name : t("profile.upload")}
              </button>
              {data.avatarUrl && (
                <button
                  type="button"
                  className="text-button text-button--danger"
                  onClick={() => removeAvatar.mutate()}
                  disabled={removeAvatar.isPending}
                >
                  {t("profile.removeAvatar")}
                </button>
              )}
            </div>
            <div className="form-actions">
              <button className="button" disabled={save.isPending}>
                {save.isPending
                  ? t("profile.saving")
                  : t("profile.saveChanges")}
              </button>
              <button
                type="button"
                className="button button--ghost"
                onClick={() => setEdit(false)}
              >
                {t("profile.cancel")}
              </button>
            </div>
          </form>
        )}
      </section>
    <FriendLeaguesPanel />
    <section className="profile-card profile-card--password">
        <div>
          <p className="eyebrow">{t("profile.security")}</p>
          <h2>{t("profile.passwordTitle")}</h2>
          <p className="muted">{t("profile.passwordDescription")}</p>
        </div>
        <form
          className="profile-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (newPassword !== confirmPassword) {
              toast.error(t("profile.passwordMismatch"));
              return;
            }
            changePassword.mutate();
          }}
        >
          <label>
            {t("profile.currentPassword")}
            <PasswordInput
              required
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </label>
          <label>
            {t("profile.newPassword")}
            <PasswordInput
              required
              minLength={8}
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </label>
          <label>
            {t("profile.confirmPassword")}
            <PasswordInput
              required
              minLength={8}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </label>
          <div className="form-actions">
            <button className="button" disabled={changePassword.isPending}>
              {changePassword.isPending
                ? t("profile.saving")
                : t("profile.changePassword")}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
