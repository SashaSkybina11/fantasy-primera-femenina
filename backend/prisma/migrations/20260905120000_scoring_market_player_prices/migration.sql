-- AlterTable
-- Participation does not prove a real start. Keep the legacy evidence for review.
ALTER TABLE "PlayerGameweekStats" RENAME COLUMN "participated" TO "legacyParticipated";
ALTER TABLE "PlayerGameweekStats"
ADD COLUMN     "goalsConceded" INTEGER,
ADD COLUMN     "started" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PriceSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "teamWin" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerPriceChange" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "gameweekId" TEXT NOT NULL,
    "priceBefore" INTEGER NOT NULL,
    "priceDelta" INTEGER NOT NULL,
    "priceAfter" INTEGER NOT NULL,
    "teamResultDelta" INTEGER NOT NULL,
    "goalsDelta" INTEGER NOT NULL,
    "startedDelta" INTEGER NOT NULL,
    "yellowCardsDelta" INTEGER NOT NULL,
    "redCardsDelta" INTEGER NOT NULL,
    "goalkeeperDelta" INTEGER NOT NULL,
    "teamWinBonus" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerPriceChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlayerPriceChange_gameweekId_idx" ON "PlayerPriceChange"("gameweekId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerPriceChange_playerId_gameweekId_key" ON "PlayerPriceChange"("playerId", "gameweekId");

-- AddForeignKey
ALTER TABLE "PlayerPriceChange" ADD CONSTRAINT "PlayerPriceChange_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerPriceChange" ADD CONSTRAINT "PlayerPriceChange_gameweekId_fkey" FOREIGN KEY ("gameweekId") REFERENCES "Gameweek"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve previously confirmed clean sheets, while keeping unknown conceded counts NULL.
UPDATE "PlayerGameweekStats" SET "goalsConceded" = 0 WHERE "cleanSheet" = true;
ALTER TABLE "PlayerGameweekStats" ADD CONSTRAINT "stats_conceded_nonnegative" CHECK ("goalsConceded" IS NULL OR "goalsConceded" >= 0);
ALTER TABLE "PlayerGameweekStats" ADD CONSTRAINT "stats_clean_sheet_consistent" CHECK ("cleanSheet" = COALESCE("goalsConceded" = 0, false));
ALTER TABLE "PriceSettings" ADD CONSTRAINT "team_win_nonnegative" CHECK ("teamWin" IS NULL OR "teamWin" >= 0);
ALTER TABLE "PlayerPriceChange" ADD CONSTRAINT "price_history_consistent" CHECK ("priceBefore" >= 0 AND "priceAfter" >= 0 AND "priceAfter" = "priceBefore" + "priceDelta");
-- Apply the new scoring rules to existing events without inferring starting status.
UPDATE "PlayerGameweekStats" s SET "calculatedPoints" =
  (CASE WHEN s."started" THEN 2 ELSE 0 END)
  + (CASE s."result" WHEN 'WIN' THEN 2 WHEN 'DRAW' THEN 1 ELSE 0 END)
  + s."goals" * (CASE WHEN p."position" = 'GOALKEEPER' THEN 8 ELSE 5 END)
  + (CASE WHEN s."goals" >= 3 THEN 3 ELSE 0 END)
  + (CASE WHEN p."position" = 'GOALKEEPER' AND s."cleanSheet" THEN 5 ELSE 0 END)
  - s."yellowCards" - s."redCards" * 4
FROM "Player" p WHERE p.id = s."playerId";
UPDATE "PlayerGameweekStats" SET "totalPoints" = GREATEST(0, "calculatedPoints" + "adjustmentPoints");
ALTER TABLE "PlayerGameweekStats" ADD CONSTRAINT "stats_total_nonnegative" CHECK ("totalPoints" >= 0);
-- PostgreSQL also uses the named IANA timezone, not a season-specific UTC offset.
UPDATE "Gameweek" SET
  "marketOpenAt" = ((date_trunc('week', "startsAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Madrid') + interval '1 day 10 hours') AT TIME ZONE 'Europe/Madrid') AT TIME ZONE 'UTC',
  "deadlineAt" = ((date_trunc('week', "startsAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Madrid') + interval '4 days 12 hours') AT TIME ZONE 'Europe/Madrid') AT TIME ZONE 'UTC';

-- Rebuild existing fantasy totals/breakdowns and ranks after the scoring change.
WITH totals AS (
 SELECT sq."gameweekId", sq."userId",
  COALESCE(SUM(s."totalPoints"), 0)::integer AS points,
  COALESCE(SUM(CASE WHEN e."isCaptain" THEN s."totalPoints" ELSE 0 END), 0)::integer AS captain,
  COALESCE(SUM(s.goals), 0)::integer AS goals,
  COALESCE(jsonb_agg(jsonb_build_object('playerId', p.id, 'name', p.name, 'isCaptain', e."isCaptain",
    'basePoints', COALESCE(s."totalPoints", 0), 'points', COALESCE(s."totalPoints", 0) * CASE WHEN e."isCaptain" THEN 2 ELSE 1 END)) FILTER (WHERE p.id IS NOT NULL), '[]'::jsonb) AS breakdown
 FROM "UserGameweekSquad" sq
 LEFT JOIN "UserGameweekPlayer" e ON e."squadId" = sq.id AND e.status = 'STARTER'
 LEFT JOIN "Player" p ON p.id = e."playerId"
 LEFT JOIN "PlayerGameweekStats" s ON s."playerId" = e."playerId" AND s."gameweekId" = sq."gameweekId"
 GROUP BY sq."gameweekId", sq."userId"
)
UPDATE "UserGameweekPoints" u SET "playerPoints" = t.points, "captainBonus" = t.captain,
 "starterGoals" = t.goals, "totalPoints" = t.points + t.captain + u."adjustmentPoints", breakdown = t.breakdown
FROM totals t WHERE u."gameweekId" = t."gameweekId" AND u."userId" = t."userId";
WITH ranks AS (
 SELECT id, RANK() OVER (PARTITION BY "gameweekId" ORDER BY "totalPoints" DESC, "playerPoints" DESC, "starterGoals" DESC)::integer AS rank
 FROM "UserGameweekPoints"
)
UPDATE "UserGameweekPoints" u SET rank = r.rank FROM ranks r WHERE r.id = u.id;
DELETE FROM "GameweekWinner" w USING "Gameweek" g WHERE w."gameweekId" = g.id AND g.status = 'COMPLETED';
INSERT INTO "GameweekWinner" (id, "gameweekId", "userId", rank, points, "createdAt")
SELECT 'c' || substr(md5(u."gameweekId" || u."userId"), 1, 24), u."gameweekId", u."userId", 1, u."totalPoints", CURRENT_TIMESTAMP
FROM "UserGameweekPoints" u JOIN "Gameweek" g ON g.id = u."gameweekId" WHERE g.status = 'COMPLETED' AND u.rank = 1;
