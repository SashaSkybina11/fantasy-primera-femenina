ALTER TABLE "FantasyTeamPlayer" ADD COLUMN "fieldSlot" INTEGER;

WITH ranked_field_starters AS (
  SELECT
    squad_player."id",
    ROW_NUMBER() OVER (PARTITION BY squad_player."fantasyTeamId" ORDER BY squad_player."createdAt", squad_player."id") - 1 AS slot
  FROM "FantasyTeamPlayer" AS squad_player
  INNER JOIN "Player" AS player ON player."id" = squad_player."playerId"
  WHERE squad_player."status" = 'STARTER'
    AND player."position" = 'FIELD_PLAYER'
)
UPDATE "FantasyTeamPlayer" AS squad_player
SET "fieldSlot" = ranked_field_starters.slot
FROM ranked_field_starters
WHERE squad_player."id" = ranked_field_starters."id";
