import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../services/api";
import { useLocale } from "../contexts/LocaleContext";

const empty = {
  started: false,
  result: "LOSS",
  goals: 0,
  yellowCards: 0,
  redCards: 0,
  cleanSheet: false,
  goalsConceded: null as number | null,
  adjustmentPoints: 0,
  adjustmentReason: "",
};

export function AdminPlayerPointsPage() {
  const { user } = useAuth();
  const { t } = useLocale();
  const queryClient = useQueryClient();
  const [gameweekId, setGameweekId] = useState("");
  const [search, setSearch] = useState("");
  const [club, setClub] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [form, setForm] = useState(empty);
  const editor = useRef<HTMLElement>(null);
  useEffect(() => {
    if (selected && gameweekId && window.matchMedia("(max-width: 900px)").matches) {
      editor.current?.scrollIntoView({ block: "start" });
    }
  }, [selected, gameweekId]);
  const [teamResults, setTeamResults] = useState<Record<string, string>>({});
  const gameweeks = useQuery({
    queryKey: ["admin-gameweeks"],
    queryFn: api.adminGameweeks,
    enabled: user?.role === "ADMIN",
  });
  const players = useQuery({
    queryKey: ["admin-player-points", gameweekId],
    queryFn: () => api.adminPlayerPoints(gameweekId || undefined),
    enabled: user?.role === "ADMIN",
  });
  const save = useMutation({
    mutationFn: () => api.savePlayerStats(gameweekId, selected!, form),
    onSuccess: () => {
      toast.success(t("adminStats.saved"));
      void queryClient.invalidateQueries();
    },
    onError: (error) => toast.error(error.message),
  });
  const complete = useMutation({
    mutationFn: (id: string) => api.completeGameweek(id),
    onSuccess: () => {
      toast.success(t("adminStats.completed"));
      void queryClient.invalidateQueries({ queryKey: ["admin-gameweeks"] });
    },
    onError: (error) => toast.error(error.message),
  });
  const reopen = useMutation({
    mutationFn: (id: string) => api.reopenGameweek(id),
    onSuccess: () => {
      toast.success(t("adminStats.reopened"));
      void queryClient.invalidateQueries({ queryKey: ["admin-gameweeks"] });
    },
    onError: (error) => toast.error(error.message),
  });
  const bulk = useMutation({
    mutationFn: () => api.applyTeamResults(gameweekId, Object.entries(teamResults).map(([clubId, result]) => ({ clubId, result }))),
    onSuccess: () => { setTeamResults({}); setSelected(null); toast.success(t("adminStats.saved")); void queryClient.invalidateQueries(); },
    onError: (error) => toast.error(error.message),
  });
  const filtered = useMemo(
    () =>
      players.data?.filter(
        (player) =>
          (!search ||
            player.name.toLowerCase().includes(search.toLowerCase()) ||
            String(player.number).includes(search) ||
            player.club?.name.toLowerCase().includes(search.toLowerCase())) &&
          (!club || player.clubId === club),
      ) ?? [],
    [players.data, search, club],
  );
  if (user?.role !== "ADMIN") return <Navigate to="/" replace />;
  const current = gameweeks.data?.find((item) => item.id === gameweekId);
  return (
    <div className="page admin-stats">
      <header className="page-heading">
        <p className="eyebrow">{t("adminStats.eyebrow")}</p>
        <h1>{t("adminStats.title")}</h1>
        <p className="muted">{t("adminStats.description")}</p>
        <Link to="/admin/player-prices">{t("prices.title")} →</Link>
        <Link to="/admin/users">{t("adminStats.usersLink")} →</Link>
      </header>
      <section className="admin-toolbar">
        <select
          aria-label={t("adminStats.selectGameweek")}
          value={gameweekId}
          onChange={(event) => {
            setGameweekId(event.target.value);
            setSelected(null);
            setTeamResults({});
          }}
        >
          <option value="">{t("adminStats.selectGameweek")}</option>
          {gameweeks.data?.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} · {t(`gameweek.${item.status}`)}
            </option>
          ))}
        </select>
        <input
          aria-label={t("adminStats.searchPlaceholder")}
          placeholder={t("adminStats.searchPlaceholder")}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select aria-label={t("adminStats.allClubs")} value={club} onChange={(event) => setClub(event.target.value)}>
          <option value="">{t("adminStats.allClubs")}</option>
          {Array.from(
            new Map(
              players.data?.map((player) => [
                player.clubId,
                player.club?.name,
              ]) ?? [],
            ),
          ).map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        {current &&
          (current.status === "COMPLETED" ? (
            <button
              className="button button--secondary"
              onClick={() =>
                window.confirm(t("adminStats.reopenConfirm")) &&
                reopen.mutate(current.id)
              }
            >
              {t("adminStats.reopen")}
            </button>
          ) : (
            <button
              className="button"
              onClick={() =>
                window.confirm(t("adminStats.completeConfirm")) &&
                complete.mutate(current.id)
              }
            >
              {t("adminStats.complete")}
            </button>
          ))}
      </section>
      <section className="admin-card team-results">
        <h2>{t("adminStats.teamResults")}</h2>
        <div className="team-results-grid">
          {Array.from(new Map(players.data?.map(player => [player.clubId, player.club?.name]) ?? [])).map(([id, name]) => (
            <label key={id}>{name}<select value={teamResults[id] ?? ""} onChange={e => setTeamResults(previous => { const next = { ...previous }; if (e.target.value) next[id] = e.target.value; else delete next[id]; return next; })}>
              <option value="">{t("adminStats.unchanged")}</option>
              <option value="WIN">{t("adminStats.win")}</option><option value="DRAW">{t("adminStats.draw")}</option><option value="LOSS">{t("adminStats.loss")}</option>
            </select></label>
          ))}
        </div>
        <button className="button" disabled={!gameweekId || current?.status === "COMPLETED" || bulk.isPending || !Object.keys(teamResults).length} onClick={() => bulk.mutate()}>{t("adminStats.applyResults")}</button>
      </section>
      <div className="admin-stats-grid">
        <section className="admin-card">
          <div className="admin-card__head">
            <h2>{t("adminStats.players")}</h2>
            <span>{filtered.length}</span>
          </div>
          {filtered.map((player) => (
            <button
              className={`stats-player ${selected === player.id ? "stats-player--active" : ""}`}
              key={player.id}
              aria-pressed={selected === player.id}
              onClick={() => {
                setSelected(player.id);
                const stat = player.gameweekStats[0] as
                  | typeof empty
                  | undefined;
                setForm(
                  stat
                    ? {
                        started: Boolean(stat.started),
                        result: String(stat.result),
                        goals: Number(stat.goals),
                        yellowCards: Number(stat.yellowCards),
                        redCards: Number(stat.redCards),
                        cleanSheet: Boolean(stat.cleanSheet),
                        goalsConceded: stat.goalsConceded == null ? null : Number(stat.goalsConceded),
                        adjustmentPoints: Number(stat.adjustmentPoints),
                        adjustmentReason: String(stat.adjustmentReason ?? ""),
                      }
                    : empty,
                );
              }}
            >
              <span>
                <strong>№{player.number} — {player.name}</strong>
                <small>
                  {player.club?.name} · {player.role}
                </small>
                {player.gameweekStats[0] && <small className="stats-summary">
                  {t("adminStats.goals")}: {Number(player.gameweekStats[0].goals)} · {t("adminStats.yellowCards")}: {Number(player.gameweekStats[0].yellowCards)} · {t("adminStats.redCards")}: {Number(player.gameweekStats[0].redCards)}
                </small>}
              </span>
              <b>{player.lastGameweekPoints} {t("common.pointsShort")}</b>
            </button>
          ))}
        </section>
        <section className="admin-card stats-editor" ref={editor}>
          {selected && gameweekId ? (
            <form
              className="stats-form"
              onSubmit={(event) => {
                event.preventDefault();
                save.mutate();
              }}
            >
              <h2>
                {players.data?.find((item) => item.id === selected)?.name}
              </h2>
              <label>
                <input
                  type="checkbox"
                  checked={form.started}
                  onChange={(e) =>
                    setForm({ ...form, started: e.target.checked })
                  }
                />{" "}
                {t("adminStats.started")}
              </label>
              <label>
                {t("adminStats.result")}
                <select
                  value={form.result}
                  onChange={(e) => setForm({ ...form, result: e.target.value })}
                >
                  <option value="WIN">{t("adminStats.win")}</option>
                  <option value="DRAW">{t("adminStats.draw")}</option>
                  <option value="LOSS">{t("adminStats.loss")}</option>
                </select>
              </label>
              {(["goals", "yellowCards", "redCards"] as const).map((key) => (
                <label key={key}>
                  {key === "goals"
                    ? t("adminStats.goals")
                    : key === "yellowCards"
                      ? t("adminStats.yellowCards")
                      : t("adminStats.redCards")}
                  <input
                    type="number"
                    min="0"
                    value={form[key]}
                    onChange={(e) =>
                      setForm({ ...form, [key]: Number(e.target.value) })
                    }
                  />
                </label>
              ))}
              {players.data?.find((item) => item.id === selected)?.position ===
                "GOALKEEPER" && (
                <label>
                  {t("adminStats.goalsConceded")}
                  <input type="number" min="0" max="99" value={form.goalsConceded ?? ""}
                    onChange={e => { const value = e.target.value === "" ? null : Number(e.target.value); setForm({ ...form, goalsConceded: value, cleanSheet: value === 0 }); }} />
                </label>
              )}
              <label>
                {t("adminStats.adjustment")}
                <input
                  type="number"
                  value={form.adjustmentPoints}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      adjustmentPoints: Number(e.target.value),
                    })
                  }
                />
              </label>
              <label>
                {t("adminStats.reason")}
                <textarea
                  value={form.adjustmentReason}
                  onChange={(e) =>
                    setForm({ ...form, adjustmentReason: e.target.value })
                  }
                />
              </label>
              <button className="button" disabled={save.isPending || current?.status === "COMPLETED"}>
                {t("adminStats.save")}
              </button>
            </form>
          ) : (
            <p className="muted">{t("adminStats.selectHint")}</p>
          )}
        </section>
      </div>
    </div>
  );
}
