-- CreateEnum
CREATE TYPE "TransferType" AS ENUM ('BUY', 'SELL');

-- AlterTable
ALTER TABLE "FantasyTeam" ADD COLUMN     "isInitialSquadComplete" BOOLEAN NOT NULL DEFAULT false;

UPDATE "FantasyTeam" AS team
SET "isInitialSquadComplete" = true
WHERE (SELECT COUNT(*) FROM "FantasyTeamPlayer" AS player WHERE player."fantasyTeamId" = team."id") >= 10;

-- CreateTable
CREATE TABLE "UserTransfer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameweekId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "type" "TransferType" NOT NULL,
    "price" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrivateLeague" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrivateLeague_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrivateLeagueMember" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrivateLeagueMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserTransfer_userId_gameweekId_type_idx" ON "UserTransfer"("userId", "gameweekId", "type");

-- CreateIndex
CREATE INDEX "UserTransfer_playerId_idx" ON "UserTransfer"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "PrivateLeague_inviteCode_key" ON "PrivateLeague"("inviteCode");

-- CreateIndex
CREATE INDEX "PrivateLeague_ownerId_idx" ON "PrivateLeague"("ownerId");

-- CreateIndex
CREATE INDEX "PrivateLeagueMember_userId_idx" ON "PrivateLeagueMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PrivateLeagueMember_leagueId_userId_key" ON "PrivateLeagueMember"("leagueId", "userId");

-- AddForeignKey
ALTER TABLE "UserTransfer" ADD CONSTRAINT "UserTransfer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTransfer" ADD CONSTRAINT "UserTransfer_gameweekId_fkey" FOREIGN KEY ("gameweekId") REFERENCES "Gameweek"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTransfer" ADD CONSTRAINT "UserTransfer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivateLeague" ADD CONSTRAINT "PrivateLeague_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivateLeagueMember" ADD CONSTRAINT "PrivateLeagueMember_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "PrivateLeague"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivateLeagueMember" ADD CONSTRAINT "PrivateLeagueMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
