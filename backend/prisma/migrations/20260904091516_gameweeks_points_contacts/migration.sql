-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "GameweekStatus" AS ENUM ('UPCOMING', 'OPEN', 'LOCKED', 'CALCULATING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "MatchResult" AS ENUM ('WIN', 'DRAW', 'LOSS');

-- CreateEnum
CREATE TYPE "AdminActionType" AS ENUM ('PLAYER_STATS_UPDATED', 'PLAYER_POINTS_ADJUSTED', 'GAMEWEEK_COMPLETED', 'GAMEWEEK_REOPENED', 'WINNERS_CHANGED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "contactConsent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "instagram" TEXT,
ADD COLUMN     "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "whatsapp" TEXT;

-- CreateTable
CREATE TABLE "Gameweek" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "status" "GameweekStatus" NOT NULL DEFAULT 'UPCOMING',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "marketOpenAt" TIMESTAMP(3) NOT NULL,
    "deadlineAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "entryFeeCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "prizePoolCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Gameweek_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerGameweekStats" (
    "id" TEXT NOT NULL,
    "gameweekId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "participated" BOOLEAN NOT NULL DEFAULT false,
    "result" "MatchResult" NOT NULL DEFAULT 'LOSS',
    "goals" INTEGER NOT NULL DEFAULT 0,
    "yellowCards" INTEGER NOT NULL DEFAULT 0,
    "redCards" INTEGER NOT NULL DEFAULT 0,
    "cleanSheet" BOOLEAN NOT NULL DEFAULT false,
    "calculatedPoints" INTEGER NOT NULL DEFAULT 0,
    "adjustmentPoints" INTEGER NOT NULL DEFAULT 0,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "adjustmentReason" TEXT,
    "adjustedById" TEXT,
    "adjustedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerGameweekStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserGameweekSquad" (
    "id" TEXT NOT NULL,
    "gameweekId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fantasyTeamName" TEXT NOT NULL,
    "snapshottedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserGameweekSquad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserGameweekPlayer" (
    "id" TEXT NOT NULL,
    "squadId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "status" "SquadStatus" NOT NULL,
    "isCaptain" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "UserGameweekPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserGameweekPoints" (
    "id" TEXT NOT NULL,
    "gameweekId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "playerPoints" INTEGER NOT NULL DEFAULT 0,
    "captainBonus" INTEGER NOT NULL DEFAULT 0,
    "adjustmentPoints" INTEGER NOT NULL DEFAULT 0,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "starterGoals" INTEGER NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "isFinal" BOOLEAN NOT NULL DEFAULT false,
    "breakdown" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserGameweekPoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPointAdjustment" (
    "id" TEXT NOT NULL,
    "gameweekId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPointAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameweekWinner" (
    "id" TEXT NOT NULL,
    "gameweekId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameweekWinner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "action" "AdminActionType" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "oldData" JSONB,
    "newData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Gameweek_number_key" ON "Gameweek"("number");

-- CreateIndex
CREATE INDEX "Gameweek_status_deadlineAt_idx" ON "Gameweek"("status", "deadlineAt");

-- CreateIndex
CREATE INDEX "PlayerGameweekStats_playerId_idx" ON "PlayerGameweekStats"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerGameweekStats_gameweekId_playerId_key" ON "PlayerGameweekStats"("gameweekId", "playerId");

-- CreateIndex
CREATE INDEX "UserGameweekSquad_userId_idx" ON "UserGameweekSquad"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserGameweekSquad_gameweekId_userId_key" ON "UserGameweekSquad"("gameweekId", "userId");

-- CreateIndex
CREATE INDEX "UserGameweekPlayer_playerId_idx" ON "UserGameweekPlayer"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "UserGameweekPlayer_squadId_playerId_key" ON "UserGameweekPlayer"("squadId", "playerId");

-- CreateIndex
CREATE INDEX "UserGameweekPoints_userId_totalPoints_idx" ON "UserGameweekPoints"("userId", "totalPoints");

-- CreateIndex
CREATE UNIQUE INDEX "UserGameweekPoints_gameweekId_userId_key" ON "UserGameweekPoints"("gameweekId", "userId");

-- CreateIndex
CREATE INDEX "UserPointAdjustment_gameweekId_userId_idx" ON "UserPointAdjustment"("gameweekId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "GameweekWinner_gameweekId_userId_key" ON "GameweekWinner"("gameweekId", "userId");

-- CreateIndex
CREATE INDEX "AdminAuditLog_entityType_entityId_idx" ON "AdminAuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AdminAuditLog_adminUserId_createdAt_idx" ON "AdminAuditLog"("adminUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "PlayerGameweekStats" ADD CONSTRAINT "PlayerGameweekStats_gameweekId_fkey" FOREIGN KEY ("gameweekId") REFERENCES "Gameweek"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerGameweekStats" ADD CONSTRAINT "PlayerGameweekStats_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGameweekSquad" ADD CONSTRAINT "UserGameweekSquad_gameweekId_fkey" FOREIGN KEY ("gameweekId") REFERENCES "Gameweek"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGameweekSquad" ADD CONSTRAINT "UserGameweekSquad_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGameweekPlayer" ADD CONSTRAINT "UserGameweekPlayer_squadId_fkey" FOREIGN KEY ("squadId") REFERENCES "UserGameweekSquad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGameweekPlayer" ADD CONSTRAINT "UserGameweekPlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGameweekPoints" ADD CONSTRAINT "UserGameweekPoints_gameweekId_fkey" FOREIGN KEY ("gameweekId") REFERENCES "Gameweek"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGameweekPoints" ADD CONSTRAINT "UserGameweekPoints_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPointAdjustment" ADD CONSTRAINT "UserPointAdjustment_gameweekId_fkey" FOREIGN KEY ("gameweekId") REFERENCES "Gameweek"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPointAdjustment" ADD CONSTRAINT "UserPointAdjustment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPointAdjustment" ADD CONSTRAINT "UserPointAdjustment_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameweekWinner" ADD CONSTRAINT "GameweekWinner_gameweekId_fkey" FOREIGN KEY ("gameweekId") REFERENCES "Gameweek"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameweekWinner" ADD CONSTRAINT "GameweekWinner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
