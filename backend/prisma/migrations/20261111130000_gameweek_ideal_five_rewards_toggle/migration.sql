ALTER TABLE "Gameweek" ADD COLUMN "idealFiveBonusesEnabled" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Gameweek"
SET "idealFiveBonusesEnabled" = true
WHERE "number" >= 8
  AND EXISTS (
    SELECT 1
    FROM "GameweekIdealFiveEntry" entry
    WHERE entry."gameweekId" = "Gameweek"."id"
  );
