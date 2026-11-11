CREATE TYPE "IdealFiveSlot" AS ENUM ('GOALKEEPER', 'PIVOT', 'CLOSER', 'WINGER_ONE', 'WINGER_TWO');

CREATE TABLE "GameweekIdealFiveEntry" (
    "id" TEXT NOT NULL,
    "gameweekId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "slot" "IdealFiveSlot" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GameweekIdealFiveEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GameweekIdealFiveEntry_gameweekId_slot_key" ON "GameweekIdealFiveEntry"("gameweekId", "slot");
CREATE UNIQUE INDEX "GameweekIdealFiveEntry_gameweekId_playerId_key" ON "GameweekIdealFiveEntry"("gameweekId", "playerId");
ALTER TABLE "GameweekIdealFiveEntry" ADD CONSTRAINT "GameweekIdealFiveEntry_gameweekId_fkey" FOREIGN KEY ("gameweekId") REFERENCES "Gameweek"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GameweekIdealFiveEntry" ADD CONSTRAINT "GameweekIdealFiveEntry_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlayerPriceChange" ADD COLUMN "idealFivePriceDelta" INTEGER NOT NULL DEFAULT 0;
