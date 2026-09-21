ALTER TABLE "FantasyTeamPlayer" ADD COLUMN "purchasePrice" INTEGER;

-- Only restore recorded purchases for the current ownership period.
-- Initial squads did not record transfers, so their unknown prices stay null.
UPDATE "FantasyTeamPlayer" AS entry
SET "purchasePrice" = (
  SELECT transfer.price
  FROM "UserTransfer" AS transfer
  JOIN "FantasyTeam" AS team ON team."userId" = transfer."userId"
  WHERE team.id = entry."fantasyTeamId"
    AND transfer."playerId" = entry."playerId"
    AND transfer.type = 'BUY'
    AND transfer."createdAt" >= entry."createdAt"
  ORDER BY transfer."createdAt" DESC
  LIMIT 1
);
