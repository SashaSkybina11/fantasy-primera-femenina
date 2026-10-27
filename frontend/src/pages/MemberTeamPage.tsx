import { GoArrowRight } from "react-icons/go";
import { Loader } from "../components/Loader";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { Avatar } from "../components/Avatar";
import { SquadSection } from "../components/SquadSection";
import { api } from "../services/api";
import { useLocale } from "../contexts/LocaleContext";

export function MemberTeamPage() {
  const { t } = useLocale();
  const { userId = "" } = useParams();
  const [compare, setCompare] = useState(false);
  const [selectedGameweekId, setSelectedGameweekId] = useState("");
  const member = useQuery({
    queryKey: ["member", userId],
    queryFn: () => api.member(userId),
  });
  const ownTeam = useQuery({ queryKey: ["team"], queryFn: api.team });
  if (member.isLoading || ownTeam.isLoading)
    return (
      <div className="state-card">
        <Loader label={t("loading.team")} />
      </div>
    );
  if (member.isError || ownTeam.isError || !member.data || !ownTeam.data)
    return (
      <div className="state-card state-card--error">
        {t("error.memberNotFound")}
      </div>
    );
  const players = member.data.fantasyTeam.players;
  const starterPlayers = players.filter((entry) => entry.status === "STARTER");
  const benchPlayers = players.filter((entry) => entry.status === "BENCH");
  const ownIds = new Set(ownTeam.data.players.map((entry) => entry.playerId));
  const otherIds = new Set(players.map((entry) => entry.playerId));
  const common = ownTeam.data.players.filter((entry) =>
    otherIds.has(entry.playerId),
  );
  const onlyOwn = ownTeam.data.players.filter(
    (entry) => !otherIds.has(entry.playerId),
  );
  const onlyOther = players.filter((entry) => !ownIds.has(entry.playerId));
  const comparisonGroup = (title: string, names: string[]) => (
    <div className="comparison-group">
      <h3>{title}</h3>
      {names.length ? (
        <ul>
          {names.map((name, index) => (
            <li key={`${name}-${index}`}>{name}</li>
          ))}
        </ul>
      ) : (
        <p>{t("member.noPlayers")}</p>
      )}
    </div>
  );
  const gameweeks = member.data.gameweekPoints;
  const selectedPoints =
    gameweeks.find((row) => row.gameweek.id === selectedGameweekId) ??
    gameweeks[0];
  return (
    <div className="page">
      <Link className="back-link" to="/league">
        <GoArrowRight className="ui-arrow ui-arrow--back" aria-hidden="true" />
        {t("member.back")}
      </Link>

      <header className="member-heading">
        <Avatar name={member.data.name} src={member.data.avatarUrl} size="lg" />
        <div>
          <p className="eyebrow">{t("team.eyebrow")}</p>
          <h1>{member.data.fantasyTeam.name}</h1>
          <p>{member.data.name}</p>
        </div>
        <button
          className="button button--secondary"
          onClick={() => setCompare(!compare)}
        >
          {compare ? t("member.hideComparison") : t("member.compare")}
        </button>
      </header>

      {compare && (
        <section className="comparison-card">
          <h2>{t("member.comparison")}</h2>
          <div>
            {comparisonGroup(
              t("member.common"),
              common.map((entry) => entry.player.name),
            )}
            {comparisonGroup(
              t("member.onlyMine"),
              onlyOwn.map((entry) => entry.player.name),
            )}
            {comparisonGroup(
              t("member.onlyTheirs", { name: member.data.name }),
              onlyOther.map((entry) => entry.player.name),
            )}
          </div>
        </section>
      )}

      <section className="member-gameweek-history">
        <header>
          <div>
            <p className="eyebrow">{t("member.pointsEyebrow")}</p>
            <h2>{t("member.pointsTitle")}</h2>
          </div>

          {gameweeks.length > 0 && (
            <label>
              {t("member.selectGameweek")}
              <select
                value={selectedPoints?.gameweek.id ?? ""}
                onChange={(event) => setSelectedGameweekId(event.target.value)}
              >
                {gameweeks.map((row) => (
                  <option key={row.gameweek.id} value={row.gameweek.id}>
                    {t("gameweek.label", { number: row.gameweek.number })}
                  </option>
                ))}
              </select>
            </label>
          )}
        </header>

        {!selectedPoints ? (
          <p className="muted">{t("member.noPoints")}</p>
        ) : (
          <>
            <div className="member-gameweek-total">
              <span>
                {t("gameweek.label", {
                  number: selectedPoints.gameweek.number,
                })}
              </span>
              <strong>
                {selectedPoints.totalPoints} {t("common.pointsShort")}
              </strong>
            </div>

            <div className="member-gameweek-breakdown">
              {selectedPoints.breakdown?.map((entry) => (
                <div key={entry.playerId}>
                  <span>
                    {entry.name}
                    {entry.isCaptain ? ` 👑 ${t("member.captain")}` : ""}
                  </span>
                  <strong>
                    {entry.points} {t("common.pointsShort")}
                  </strong>
                </div>
              ))}

              {selectedPoints.captainBonus !== 0 && (
                <div>
                  <span>{t("member.captainBonus")}</span>
                  <strong>
                    {selectedPoints.captainBonus > 0 ? "+" : ""}
                    {selectedPoints.captainBonus} {t("common.pointsShort")}
                  </strong>
                </div>
              )}

              {selectedPoints.adjustmentPoints !== 0 && (
                <div>
                  <span>{t("member.adjustment")}</span>
                  <strong>
                    {selectedPoints.adjustmentPoints > 0 ? "+" : ""}
                    {selectedPoints.adjustmentPoints} {t("common.pointsShort")}
                  </strong>
                </div>
              )}
            </div>
          </>
        )}
      </section>

      <div className="team-grid">
        <SquadSection
          title={t("team.starters")}
          subtitle={t("member.memberSquad")}
          status="STARTER"
          players={starterPlayers}
          readOnly
        />
        <SquadSection
          title={t("team.bench")}
          subtitle={t("member.memberSquad")}
          status="BENCH"
          players={benchPlayers}
          readOnly
        />
      </div>
    </div>
  );
}
