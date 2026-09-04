import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import { useLocale } from "../contexts/LocaleContext";
import { api } from "../services/api";

export function FriendLeaguesPanel() {
  const { t } = useLocale();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"create" | "join" | null>(null);
  const [value, setValue] = useState("");
  const [createdCode, setCreatedCode] = useState("");
  const leagues = useQuery({
    queryKey: ["private-leagues"],
    queryFn: api.privateLeagues,
  });
  const close = () => {
    setMode(null);
    setValue("");
    setCreatedCode("");
  };
  const create = useMutation({
    mutationFn: () => api.createPrivateLeague(value),
    onSuccess: (league) => {
      setCreatedCode(league.inviteCode);
      void queryClient.invalidateQueries({ queryKey: ["private-leagues"] });
      toast.success(t("friends.created"));
    },
    onError: (error) => toast.error(error.message),
  });
  const join = useMutation({
    mutationFn: () => api.joinPrivateLeague(value),
    onSuccess: () => {
      close();
      void queryClient.invalidateQueries({ queryKey: ["private-leagues"] });
    },
    onError: (error) => toast.error(error.message),
  });
  return (
    <section className="profile-card friend-leagues">
      <div>
        <p className="eyebrow">Fantasy</p>
        <h2>{t("friends.title")}</h2>
      </div>
      <div className="friend-league-list">
        {leagues.data?.map((league) => (
          <article key={league.id}>
            <div>
              <strong>{league.name}</strong>
              <small>
                {league._count?.members ?? 1} · {t("friends.members")}
              </small>
              {league.rank && <small>{t("friends.position")}: {league.rank}</small>}
            </div>
            <Link
              className="button button--secondary"
              to={`/league/${league.id}`}
            >
              {t("friends.view")}
            </Link>
          </article>
        ))}
      </div>
      <div className="friend-league-actions">
        <button className="button" onClick={() => setMode("create")}>
          {t("friends.create")}
        </button>
        <button
          className="button button--secondary"
          onClick={() => setMode("join")}
        >
          {t("friends.join")}
        </button>
      </div>
      {mode && (
        <div className="modal-backdrop" onClick={close}>
          <section
            className="compact-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="compact-modal__close"
              onClick={close}
              aria-label={t("friends.close")}
            >
              ×
            </button>
            <h2>
              {mode === "create" ? t("friends.create") : t("friends.join")}
            </h2>
            {createdCode ? (
              <div className="invite-result">
                <strong>{t("friends.created")}</strong>
                <span>
                  {t("friends.inviteCode")}: <b>{createdCode}</b>
                </span>
                <button
                  className="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(createdCode);
                    toast.success(t("friends.copied"));
                  }}
                >
                  {t("friends.copy")}
                </button>
              </div>
            ) : (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  mode === "create" ? create.mutate() : join.mutate();
                }}
              >
                <label>
                  {mode === "create" ? t("friends.name") : t("friends.code")}
                  <input
                    required
                    minLength={mode === "create" ? 3 : 6}
                    maxLength={mode === "create" ? 50 : 10}
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                  />
                </label>
                <button
                  className="button"
                  disabled={create.isPending || join.isPending}
                >
                  {mode === "create"
                    ? t("friends.submitCreate")
                    : t("friends.submitJoin")}
                </button>
              </form>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
