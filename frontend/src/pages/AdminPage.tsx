import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useLocale } from "../contexts/LocaleContext";
import { api } from "../services/api";

export function AdminPage() {
  const { user } = useAuth();
  const { locale, t } = useLocale();
  const queryClient = useQueryClient();
  const users = useQuery({ queryKey: ["admin-users"], queryFn: api.adminUsers, enabled: user?.role === "ADMIN" });
  const removeUser = useMutation({
    mutationFn: api.deleteAdminUser,
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["admin-users"] }); toast.success(t("admin.userDeleted")); },
    onError: (error) => toast.error(error.message),
  });

  if (user?.role !== "ADMIN") return <Navigate to="/" replace />;
  return <div className="page page--narrow admin-page"><header className="page-heading"><p className="eyebrow">{t("admin.eyebrow")}</p><h1>{t("admin.title")}</h1><p className="muted">{t("admin.description")}</p></header><section className="admin-card"><div className="admin-card__head"><h2>{t("admin.users")}</h2><span>{users.data?.length ?? 0}</span></div>{users.isLoading && <p className="muted">{t("admin.loading")}</p>}{users.isError && <p className="state-card state-card--error">{t("error.generic")}</p>}{users.data?.map((member) => <article className="admin-user" key={member.id}><div><strong>{member.name}</strong><small>{member.email}</small><small>{t("admin.players", { count: member.playerCount })} · {new Intl.DateTimeFormat(locale === "uk" ? "uk-UA" : "es-ES", { dateStyle: "medium" }).format(new Date(member.createdAt))}</small></div><div><span className="admin-role">{member.role === "ADMIN" ? t("admin.roleAdmin") : t("admin.roleUser")}</span>{member.id !== user.id && <button className="text-button text-button--danger" disabled={removeUser.isPending} onClick={() => { if (window.confirm(t("admin.deleteConfirm", { name: member.name }))) removeUser.mutate(member.id); }}>{t("admin.delete")}</button>}</div></article>)}</section></div>;
}
