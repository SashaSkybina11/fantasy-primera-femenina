import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useLocale } from "../contexts/LocaleContext";
import { api } from "../services/api";

export function PrivateLeaguePage() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const { t } = useLocale();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const league = useQuery({
    queryKey: ["private-league", id],
    queryFn: () => api.privateLeague(id),
    enabled: Boolean(id),
  });
  const leave = useMutation({
    mutationFn: () => api.leavePrivateLeague(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["private-leagues"] });
      navigate("/profile");
    },
    onError: (error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: () => api.deletePrivateLeague(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["private-leagues"] });
      navigate("/profile");
    },
    onError: (error) => toast.error(error.message),
  });
  if (league.isLoading) return <div className="state-card">…</div>;
  if (!league.data)
    return (
      <div className="state-card state-card--error">{t("error.generic")}</div>
    );
  const own = league.data.members.find((member) => member.id === user?.id);
  const isOwner = league.data.ownerId === user?.id;
  return (
    <div className="page page--narrow">
      <Link className="back-link" to="/profile">
        ← {t("nav.profile")}
      </Link>
      <header className="page-heading">
        <p className="eyebrow">{t("friends.title")}</p>
        <h1>{league.data.name}</h1>
        <p>
          {t("friends.inviteCode")}: <strong>{league.data.inviteCode}</strong>
        </p>
        {own && (
          <p>
            {t("friends.position")}: <strong>{own.rank}</strong>
          </p>
        )}
      </header>
      <section className="admin-card">
        <div className="admin-card__head">
          <h2>{t("friends.members")}</h2>
          <span>{league.data.members.length}</span>
        </div>
        {league.data.members.map((member) => (
          <div className="leaderboard-row" key={member.id}>
            <b>{member.rank}</b>
            <strong>{member.name}</strong>
            <span>
              {member.id === league.data.ownerId ? t("friends.owner") : ""}
            </span>
            <em>
              {member.points} {t("common.pointsShort")}
            </em>
          </div>
        ))}
      </section>
      <div className="league-danger-actions">
        {isOwner ? (
          <button
            className="text-button text-button--danger"
            onClick={() =>
              window.confirm(t("friends.deleteConfirm")) && remove.mutate()
            }
          >
            {t("friends.delete")}
          </button>
        ) : (
          <button
            className="text-button text-button--danger"
            onClick={() =>
              window.confirm(t("friends.leaveConfirm")) && leave.mutate()
            }
          >
            {t("friends.leave")}
          </button>
        )}
      </div>
    </div>
  );
}
