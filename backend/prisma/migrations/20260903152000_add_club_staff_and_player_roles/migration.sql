CREATE TYPE "PlayerRole" AS ENUM ('PORTERA', 'CIERRE', 'ALA', 'PIVOT');

ALTER TABLE "Club"
ADD COLUMN "coach" TEXT,
ADD COLUMN "president" TEXT;

ALTER TABLE "Player"
ADD COLUMN "role" "PlayerRole" NOT NULL DEFAULT 'ALA';

UPDATE "Player"
SET "role" = 'PORTERA'
WHERE "position" = 'GOALKEEPER';

ALTER TABLE "Player"
ALTER COLUMN "role" DROP DEFAULT;

CREATE INDEX "Player_role_idx" ON "Player"("role");
