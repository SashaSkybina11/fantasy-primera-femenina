CREATE TABLE "PostponedMatchSnapshot" (
  "id" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "frozenById" TEXT NOT NULL,
  "frozenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PostponedMatchSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PostponedMatchSquad" (
  "id" TEXT NOT NULL,
  "snapshotId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "userName" TEXT NOT NULL,
  CONSTRAINT "PostponedMatchSquad_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PostponedMatchSquadPlayer" (
  "squadId" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "isCaptain" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "PostponedMatchSquadPlayer_pkey" PRIMARY KEY ("squadId", "playerId")
);
CREATE TABLE "PostponedMatchAward" (
  "id" TEXT NOT NULL,
  "snapshotId" TEXT NOT NULL,
  "gameweekId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "points" INTEGER NOT NULL,
  "breakdown" JSONB NOT NULL,
  "settledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PostponedMatchAward_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PostponedMatchSnapshot_matchId_key" ON "PostponedMatchSnapshot"("matchId");
CREATE UNIQUE INDEX "PostponedMatchSquad_snapshotId_userId_key" ON "PostponedMatchSquad"("snapshotId", "userId");
CREATE INDEX "PostponedMatchSquadPlayer_playerId_idx" ON "PostponedMatchSquadPlayer"("playerId");
CREATE UNIQUE INDEX "PostponedMatchAward_snapshotId_userId_key" ON "PostponedMatchAward"("snapshotId", "userId");
CREATE INDEX "PostponedMatchAward_gameweekId_userId_idx" ON "PostponedMatchAward"("gameweekId", "userId");
ALTER TABLE "PostponedMatchSnapshot" ADD CONSTRAINT "PostponedMatchSnapshot_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostponedMatchSnapshot" ADD CONSTRAINT "PostponedMatchSnapshot_frozenById_fkey" FOREIGN KEY ("frozenById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PostponedMatchSquad" ADD CONSTRAINT "PostponedMatchSquad_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "PostponedMatchSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostponedMatchSquad" ADD CONSTRAINT "PostponedMatchSquad_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostponedMatchSquadPlayer" ADD CONSTRAINT "PostponedMatchSquadPlayer_squadId_fkey" FOREIGN KEY ("squadId") REFERENCES "PostponedMatchSquad"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostponedMatchSquadPlayer" ADD CONSTRAINT "PostponedMatchSquadPlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PostponedMatchAward" ADD CONSTRAINT "PostponedMatchAward_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "PostponedMatchSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostponedMatchAward" ADD CONSTRAINT "PostponedMatchAward_gameweekId_fkey" FOREIGN KEY ("gameweekId") REFERENCES "Gameweek"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostponedMatchAward" ADD CONSTRAINT "PostponedMatchAward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
