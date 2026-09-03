-- Some official rosters contain the same shirt number for different players.
DROP INDEX "Player_clubId_number_key";

CREATE UNIQUE INDEX "Player_clubId_number_name_key" ON "Player"("clubId", "number", "name");
