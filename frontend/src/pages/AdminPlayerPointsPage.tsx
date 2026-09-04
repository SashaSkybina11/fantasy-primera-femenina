import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../services/api";
import { useLocale } from "../contexts/LocaleContext";

const empty = {
  participated: false,
  result: "LOSS",
  goals: 0,
  yellowCards: 0,
  redCards: 0,
  cleanSheet: false,
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
  const [price, setPrice] = useState(3000);
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
      void queryClient.invalidateQueries({ queryKey: ["admin-player-points"] });
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
  const updatePrice = useMutation({
    mutationFn: () => api.updatePlayerPrice(selected!, price),
    onSuccess: () => {
      toast.success(t("adminStats.priceSaved"));
      void queryClient.invalidateQueries({ queryKey: ["admin-player-points"] });
      void queryClient.invalidateQueries({ queryKey: ["players"] });
    },
    onError: (error) => toast.error(error.message),
  });
  const filtered = useMemo(
    () =>
      players.data?.filter(
        (player) =>
          (!search ||
            player.name.toLowerCase().includes(search.toLowerCase()) ||
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
        <Link to="/admin/users">{t("adminStats.usersLink")} →</Link>
      </header>
      <section className="admin-toolbar">
        <select
          value={gameweekId}
          onChange={(event) => {
            setGameweekId(event.target.value);
            setSelected(null);
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
          placeholder={t("adminStats.searchPlaceholder")}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select value={club} onChange={(event) => setClub(event.target.value)}>
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
              onClick={() => {
                setSelected(player.id);
                setPrice(player.price);
                const stat = player.gameweekStats[0] as
                  | typeof empty
                  | undefined;
                setForm(
                  stat
                    ? {
                        participated: Boolean(stat.participated),
                        result: String(stat.result),
                        goals: Number(stat.goals),
                        yellowCards: Number(stat.yellowCards),
                        redCards: Number(stat.redCards),
                        cleanSheet: Boolean(stat.cleanSheet),
                        adjustmentPoints: Number(stat.adjustmentPoints),
                        adjustmentReason: String(stat.adjustmentReason ?? ""),
                      }
                    : empty,
                );
              }}
            >
              <span>
                <strong>{player.name}</strong>
                <small>
                  {player.club?.name} · {player.role}
                </small>
              </span>
              <b>{player.lastGameweekPoints} {t("common.pointsShort")}</b>
            </button>
          ))}
        </section>
        <section className="admin-card">
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
                  checked={form.participated}
                  onChange={(e) =>
                    setForm({ ...form, participated: e.target.checked })
                  }
                />{" "}
                {t("adminStats.participated")}
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
                  <input
                    type="checkbox"
                    checked={form.cleanSheet}
                    onChange={(e) =>
                      setForm({ ...form, cleanSheet: e.target.checked })
                    }
                  />{" "}
                  {t("adminStats.cleanSheet")}
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
              <div className="admin-price-control">
                <label>
                  {t("adminStats.price")}
                  <input type="number" min="0" step="100" value={price} onChange={(event) => setPrice(Number(event.target.value))} />
                </label>
                <button type="button" className="button button--secondary" disabled={updatePrice.isPending} onClick={() => updatePrice.mutate()}>
                  {t("adminStats.savePrice")}
                </button>
              </div>
              <button className="button" disabled={save.isPending}>
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
