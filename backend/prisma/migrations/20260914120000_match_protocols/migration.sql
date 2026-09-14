CREATE TABLE "Match" (
 "id" TEXT PRIMARY KEY, "gameweekId" TEXT NOT NULL REFERENCES "Gameweek"("id") ON DELETE CASCADE,
 "kickoffAt" TIMESTAMP(3), "draft" JSONB, "published" JSONB, "publishedAt" TIMESTAMP(3),
 "version" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "Match_gameweekId_idx" ON "Match"("gameweekId");
CREATE TABLE "MatchTeam" (
 "id" TEXT PRIMARY KEY, "matchId" TEXT NOT NULL REFERENCES "Match"("id") ON DELETE CASCADE,
 "gameweekId" TEXT NOT NULL, "clubId" TEXT NOT NULL REFERENCES "Club"("id") ON DELETE RESTRICT,
 "side" TEXT NOT NULL CHECK ("side" IN ('home','away'))
);
CREATE UNIQUE INDEX "MatchTeam_gameweekId_clubId_key" ON "MatchTeam"("gameweekId", "clubId");
CREATE UNIQUE INDEX "MatchTeam_matchId_side_key" ON "MatchTeam"("matchId", "side");
