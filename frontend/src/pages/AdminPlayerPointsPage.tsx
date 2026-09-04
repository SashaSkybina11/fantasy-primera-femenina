import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../services/api";

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
  const queryClient = useQueryClient();
  const [gameweekId, setGameweekId] = useState("");
  const [search, setSearch] = useState("");
  const [club, setClub] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [form, setForm] = useState(empty);
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
      toast.success("Статистика сохранена, рейтинг пересчитан");
      void queryClient.invalidateQueries({ queryKey: ["admin-player-points"] });
    },
    onError: (error) => toast.error(error.message),
  });
  const complete = useMutation({
    mutationFn: (id: string) => api.completeGameweek(id),
    onSuccess: () => {
      toast.success("Тур завершён");
      void queryClient.invalidateQueries({ queryKey: ["admin-gameweeks"] });
    },
    onError: (error) => toast.error(error.message),
  });
  const reopen = useMutation({
    mutationFn: (id: string) => api.reopenGameweek(id),
    onSuccess: () => {
      toast.success("Тур открыт для исправлений");
      void queryClient.invalidateQueries({ queryKey: ["admin-gameweeks"] });
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
        <p className="eyebrow">Администрирование</p>
        <h1>Очки игроков</h1>
        <p className="muted">
          События матча автоматически пересчитывают fantasy-очки и рейтинг.
        </p>
        <Link to="/admin/users">Пользователи →</Link>
      </header>
      <section className="admin-toolbar">
        <select
          value={gameweekId}
          onChange={(event) => {
            setGameweekId(event.target.value);
            setSelected(null);
          }}
        >
          <option value="">Выберите тур (1–30)</option>
          {gameweeks.data?.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} · {item.status}
            </option>
          ))}
        </select>
        <input
          placeholder="Поиск по имени или клубу"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select value={club} onChange={(event) => setClub(event.target.value)}>
          <option value="">Все клубы</option>
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
                window.confirm("Повторно открыть тур?") &&
                reopen.mutate(current.id)
              }
            >
              Повторно открыть
            </button>
          ) : (
            <button
              className="button"
              onClick={() =>
                window.confirm("Завершить тур и зафиксировать победителей?") &&
                complete.mutate(current.id)
              }
            >
              Завершить тур
            </button>
          ))}
      </section>
      <div className="admin-stats-grid">
        <section className="admin-card">
          <div className="admin-card__head">
            <h2>Игроки</h2>
            <span>{filtered.length}</span>
          </div>
          {filtered.map((player) => (
            <button
              className={`stats-player ${selected === player.id ? "stats-player--active" : ""}`}
              key={player.id}
              onClick={() => {
                setSelected(player.id);
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
              <b>{player.lastGameweekPoints} pts</b>
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
                Участвовала
              </label>
              <label>
                Результат
                <select
                  value={form.result}
                  onChange={(e) => setForm({ ...form, result: e.target.value })}
                >
                  <option value="WIN">Победа</option>
                  <option value="DRAW">Ничья</option>
                  <option value="LOSS">Поражение</option>
                </select>
              </label>
              {(["goals", "yellowCards", "redCards"] as const).map((key) => (
                <label key={key}>
                  {key === "goals"
                    ? "Голы"
                    : key === "yellowCards"
                      ? "Жёлтые карточки"
                      : "Красные карточки"}
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
                  Сухой матч
                </label>
              )}
              <label>
                Корректировка
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
                Причина
                <textarea
                  value={form.adjustmentReason}
                  onChange={(e) =>
                    setForm({ ...form, adjustmentReason: e.target.value })
                  }
                />
              </label>
              <button className="button" disabled={save.isPending}>
                Сохранить и пересчитать
              </button>
            </form>
          ) : (
            <p className="muted">Выберите тур и игрока.</p>
          )}
        </section>
      </div>
    </div>
  );
}
