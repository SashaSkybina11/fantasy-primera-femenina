CREATE TABLE "GameweekControl" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "gameweekId" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GameweekControl_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GameweekControl_gameweekId_key" ON "GameweekControl"("gameweekId");
ALTER TABLE "GameweekControl" ADD CONSTRAINT "GameweekControl_gameweekId_fkey" FOREIGN KEY ("gameweekId") REFERENCES "Gameweek"("id") ON DELETE SET NULL ON UPDATE CASCADE;
