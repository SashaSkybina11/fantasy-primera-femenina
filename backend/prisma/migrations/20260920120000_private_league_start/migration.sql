ALTER TABLE "PrivateLeague" ADD COLUMN "startGameweek" INTEGER NOT NULL DEFAULT 1, ADD COLUMN "logoUrl" TEXT;
UPDATE "PrivateLeague" l SET "startGameweek" = COALESCE(
 (SELECT MIN(g."number") FROM "Gameweek" g WHERE g."deadlineAt" > l."createdAt"),
 (SELECT MAX(g."number") + 1 FROM "Gameweek" g), 1);
