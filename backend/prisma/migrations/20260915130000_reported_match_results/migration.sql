-- A confirmed score can exist before the player protocol is available.
ALTER TABLE "Match" ADD COLUMN "reportedResult" JSONB;
