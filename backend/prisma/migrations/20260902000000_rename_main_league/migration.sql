DO $$
DECLARE
  old_league_id TEXT;
  new_league_id TEXT;
BEGIN
  SELECT "id" INTO old_league_id FROM "League" WHERE "name" = 'Fantasy Primera División Femenina';
  SELECT "id" INTO new_league_id FROM "League" WHERE "name" = 'Fantasy Primera División Fútbol Sala Femenino';

  IF old_league_id IS NOT NULL AND new_league_id IS NULL THEN
    UPDATE "League"
    SET "name" = 'Fantasy Primera División Fútbol Sala Femenino', "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = old_league_id;
  ELSIF old_league_id IS NOT NULL AND new_league_id IS NOT NULL THEN
    INSERT INTO "LeagueMember" ("id", "leagueId", "userId", "createdAt")
    SELECT CONCAT('migrated_', "id"), new_league_id, "userId", "createdAt"
    FROM "LeagueMember"
    WHERE "leagueId" = old_league_id
    ON CONFLICT ("leagueId", "userId") DO NOTHING;

    DELETE FROM "League" WHERE "id" = old_league_id;
  END IF;
END $$;
