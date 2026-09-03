ALTER TABLE "User" ADD COLUMN "favoriteClubId" TEXT;

CREATE INDEX "User_favoriteClubId_idx" ON "User"("favoriteClubId");

ALTER TABLE "User"
  ADD CONSTRAINT "User_favoriteClubId_fkey"
  FOREIGN KEY ("favoriteClubId") REFERENCES "Club"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
