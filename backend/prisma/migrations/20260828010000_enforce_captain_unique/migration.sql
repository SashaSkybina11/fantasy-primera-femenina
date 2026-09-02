WITH ranked_captains AS (
  SELECT "id", ROW_NUMBER() OVER (
    PARTITION BY "fantasyTeamId"
    ORDER BY "updatedAt" DESC, "id"
  ) AS rank
  FROM "FantasyTeamPlayer"
  WHERE "isCaptain"
)
UPDATE "FantasyTeamPlayer" AS player
SET "isCaptain" = false
FROM ranked_captains
WHERE player."id" = ranked_captains."id" AND ranked_captains.rank > 1;

CREATE UNIQUE INDEX "FantasyTeamPlayer_one_captain_per_team"
ON "FantasyTeamPlayer"("fantasyTeamId")
WHERE "isCaptain";
