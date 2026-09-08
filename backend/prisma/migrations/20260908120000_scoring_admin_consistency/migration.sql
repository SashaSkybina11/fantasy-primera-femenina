-- Preserve events, adjustments, squads and price history; rebuild derived scores.
ALTER TABLE "PlayerGameweekStats" DROP CONSTRAINT IF EXISTS "stats_total_nonnegative";
UPDATE "PlayerGameweekStats" SET "totalPoints" = "calculatedPoints" + "adjustmentPoints";
UPDATE "UserGameweekPoints" SET rank = NULL WHERE "userId" IN (SELECT id FROM "User" WHERE role = 'ADMIN');
WITH totals AS (
 SELECT sq."gameweekId", sq."userId",
  COALESCE(SUM(s."totalPoints"), 0)::integer AS points,
  0::integer AS captain,
  COALESCE(SUM(s.goals), 0)::integer AS goals,
  COALESCE(jsonb_agg(jsonb_build_object('playerId', p.id, 'name', p.name, 'isCaptain', e."isCaptain",
    'basePoints', COALESCE(s."totalPoints", 0), 'points', COALESCE(s."totalPoints", 0))) FILTER (WHERE p.id IS NOT NULL), '[]'::jsonb) AS breakdown
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
 FROM "UserGameweekPoints" WHERE "userId" IN (SELECT id FROM "User" WHERE role = 'USER')
)
UPDATE "UserGameweekPoints" u SET rank = r.rank FROM ranks r WHERE r.id = u.id;
DELETE FROM "GameweekWinner" w USING "Gameweek" g WHERE w."gameweekId" = g.id AND g.status = 'COMPLETED';
INSERT INTO "GameweekWinner" (id, "gameweekId", "userId", rank, points, "createdAt")
SELECT 'c' || substr(md5(u."gameweekId" || u."userId"), 1, 24), u."gameweekId", u."userId", 1, u."totalPoints", CURRENT_TIMESTAMP
FROM "UserGameweekPoints" u JOIN "Gameweek" g ON g.id = u."gameweekId" WHERE g.status = 'COMPLETED' AND u.rank = 1 AND u."userId" IN (SELECT id FROM "User" WHERE role = 'USER');
