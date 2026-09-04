import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import toast from "react-hot-toast";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useLocale } from "../contexts/LocaleContext";
import { api } from "../services/api";

export function AdminPage() {
  const { user } = useAuth();
  const { locale, t } = useLocale();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const users = useQuery({
    queryKey: ["admin-users"],
    queryFn: api.adminUsers,
    enabled: user?.role === "ADMIN",
  });
  const removeUser = useMutation({
    mutationFn: api.deleteAdminUser,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success(t("admin.userDeleted"));
    },
    onError: (error) => toast.error(error.message),
  });
  if (user?.role !== "ADMIN") return <Navigate to="/" replace />;
  const filtered =
    users.data?.filter(
      (member) =>
        !search ||
        [member.name, member.email, member.instagram, member.whatsapp].some(
          (value) => value?.toLowerCase().includes(search.toLowerCase()),
        ),
    ) ?? [];
  return (
    <div className="page page--narrow admin-page">
      <header className="page-heading">
        <p className="eyebrow">{t("admin.eyebrow")}</p>
        <h1>{t("admin.title")}</h1>
        <p className="muted">{t("admin.description")}</p>
        <Link to="/admin/player-points">{t("admin.playerPointsLink")} →</Link>
      </header>
      <section className="admin-card">
        <div className="admin-card__head">
          <h2>{t("admin.users")}</h2>
          <span>{filtered.length}</span>
        </div>
        <input
          className="admin-search"
          placeholder={t("admin.searchPlaceholder")}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {users.isLoading && <p className="muted">{t("admin.loading")}</p>}
        {users.isError && (
          <p className="state-card state-card--error">{t("error.generic")}</p>
        )}
        {filtered.map((member) => (
          <article className="admin-user" key={member.id}>
            <div>
              <strong>{member.name}</strong>
              <small>{member.email}</small>
              {member.instagram && (
                <a
                  href={`https://instagram.com/${member.instagram}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  @{member.instagram}
                </a>
              )}
              {member.whatsapp && (
                <a
                  href={`https://wa.me/${member.whatsapp.slice(1)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {member.whatsapp}
                </a>
              )}
              <small>
                {member.totalPoints} {t("common.pointsShort")} ·{" "}
                {t("admin.players", { count: member.playerCount })} ·{" "}
                {new Intl.DateTimeFormat(locale === "uk" ? "uk-UA" : "es-ES", {
                  dateStyle: "medium",
                }).format(new Date(member.createdAt))}
              </small>
            </div>
            <div>
              <span className="admin-role">
                {member.role === "ADMIN"
                  ? t("admin.roleAdmin")
                  : t("admin.roleUser")}
              </span>
              <small>{t(member.status === "ACTIVE" ? "admin.statusActive" : "admin.statusSuspended")}</small>
              {member.id !== user.id && (
                <button
                  className="text-button text-button--danger"
                  disabled={removeUser.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        t("admin.deleteConfirm", { name: member.name }),
                      )
                    )
                      removeUser.mutate(member.id);
                  }}
                >
                  {t("admin.delete")}
                </button>
              )}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
