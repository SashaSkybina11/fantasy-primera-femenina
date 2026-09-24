-- Display-only results. Do not write player statistics, prices, budgets or points.
DO $$
DECLARE
  fixture JSONB;
  week_id TEXT;
  home_id TEXT;
  away_id TEXT;
  match_id TEXT;
  existing_count INTEGER;
  published_score JSONB;
BEGIN
  -- Empty databases are populated by the seed after schema migrations.
  IF NOT EXISTS (SELECT 1 FROM "Club") THEN RETURN; END IF;
  FOR fixture IN SELECT value FROM jsonb_array_elements($fixtures$[
  {
    "week": 1,
    "home": "Estrela Revoltosa Verín FSF",
    "away": "FSF Castro Bloques Cando",
    "homeScore": 1,
    "awayScore": 2,
    "date": "2026-09-04",
    "kickoffAt": "2026-09-04T21:00:00+02:00"
  },
  {
    "week": 1,
    "home": "MRB Móstoles FSF",
    "away": "STV Roldán",
    "homeScore": 6,
    "awayScore": 5,
    "date": "2026-09-05",
    "kickoffAt": "2026-09-05T11:03:00+02:00"
  },
  {
    "week": 1,
    "home": "LBTL Futsal Alcantarilla",
    "away": "AD Ceuta FC",
    "homeScore": 5,
    "awayScore": 0,
    "date": "2026-09-05",
    "kickoffAt": "2026-09-05T12:30:00+02:00"
  },
  {
    "week": 1,
    "home": "Melilla CD Torreblanca",
    "away": "Nueces de Ronda Atlético Torcal",
    "homeScore": 6,
    "awayScore": 3,
    "date": "2026-09-05",
    "kickoffAt": "2026-09-05T13:00:00+02:00"
  },
  {
    "week": 1,
    "home": "Arriva AD Alcorcón",
    "away": "Cajasol Guadalcacin FS",
    "homeScore": 3,
    "awayScore": 1,
    "date": "2026-09-05",
    "kickoffAt": "2026-09-05T16:38:00+02:00"
  },
  {
    "week": 1,
    "home": "Ourense Ontime",
    "away": "Les Corts UBAE",
    "homeScore": 4,
    "awayScore": 3,
    "date": "2026-09-05",
    "kickoffAt": "2026-09-05T17:00:00+02:00"
  },
  {
    "week": 1,
    "home": "Wanapix Aldelis",
    "away": "Poio Pescamar",
    "homeScore": 0,
    "awayScore": 3,
    "date": "2026-09-05",
    "kickoffAt": "2026-09-05T18:00:00+02:00"
  },
  {
    "week": 1,
    "home": "Rodiles FS",
    "away": "Futsi Atlético Navalcarnero",
    "homeScore": 1,
    "awayScore": 4,
    "date": "2026-09-05",
    "kickoffAt": "2026-09-05T18:30:00+02:00"
  },
  {
    "week": 2,
    "home": "Futsi Atlético Navalcarnero",
    "away": "Arriva AD Alcorcón",
    "homeScore": 2,
    "awayScore": 1,
    "date": "2026-09-12",
    "kickoffAt": "2026-09-12T10:00:00+02:00"
  },
  {
    "week": 2,
    "home": "Les Corts UBAE",
    "away": "Melilla CD Torreblanca",
    "homeScore": 0,
    "awayScore": 1,
    "date": "2026-09-12",
    "kickoffAt": "2026-09-12T12:00:00+02:00"
  },
  {
    "week": 2,
    "home": "AD Ceuta FC",
    "away": "FSF Castro Bloques Cando",
    "homeScore": 2,
    "awayScore": 2,
    "date": "2026-09-12",
    "kickoffAt": "2026-09-12T13:00:00+02:00"
  },
  {
    "week": 2,
    "home": "Cajasol Guadalcacin FS",
    "away": "Ourense Ontime",
    "homeScore": 1,
    "awayScore": 2,
    "date": "2026-09-12",
    "kickoffAt": "2026-09-12T17:00:00+02:00"
  },
  {
    "week": 2,
    "home": "STV Roldán",
    "away": "Wanapix Aldelis",
    "homeScore": 6,
    "awayScore": 3,
    "date": "2026-09-12",
    "kickoffAt": "2026-09-12T18:00:00+02:00"
  },
  {
    "week": 2,
    "home": "Nueces de Ronda Atlético Torcal",
    "away": "Estrela Revoltosa Verín FSF",
    "homeScore": 0,
    "awayScore": 0,
    "date": "2026-09-12",
    "kickoffAt": "2026-09-12T18:00:00+02:00"
  },
  {
    "week": 2,
    "home": "MRB Móstoles FSF",
    "away": "LBTL Futsal Alcantarilla",
    "homeScore": 4,
    "awayScore": 2,
    "date": "2026-09-12",
    "kickoffAt": "2026-09-12T18:30:00+02:00"
  },
  {
    "week": 2,
    "home": "Poio Pescamar",
    "away": "Rodiles FS",
    "homeScore": 11,
    "awayScore": 2,
    "date": "2026-09-12",
    "kickoffAt": "2026-09-12T18:30:00+02:00"
  }
]
$fixtures$::jsonb)
  LOOP
    SELECT "id" INTO week_id FROM "Gameweek" WHERE "number" = (fixture->>'week')::integer;
    SELECT "id" INTO home_id FROM "Club" WHERE "name" = fixture->>'home';
    SELECT "id" INTO away_id FROM "Club" WHERE "name" = fixture->>'away';
    IF week_id IS NULL OR home_id IS NULL OR away_id IS NULL THEN
      RAISE EXCEPTION 'Missing round or club for result: %', fixture;
    END IF;
    SELECT count(DISTINCT "matchId"), min("matchId") INTO existing_count, match_id
      FROM "MatchTeam" WHERE "gameweekId" = week_id AND "clubId" IN (home_id, away_id);
    IF existing_count > 1 THEN RAISE EXCEPTION 'Conflicting fixtures: %', fixture; END IF;
    IF existing_count = 1 THEN
      IF NOT EXISTS (SELECT 1 FROM "MatchTeam" WHERE "matchId" = match_id AND "clubId" = home_id AND "side" = 'home')
        OR NOT EXISTS (SELECT 1 FROM "MatchTeam" WHERE "matchId" = match_id AND "clubId" = away_id AND "side" = 'away') THEN
        RAISE EXCEPTION 'Conflicting pairing: %', fixture;
      END IF;
      SELECT "published" INTO published_score FROM "Match" WHERE "id" = match_id;
      IF published_score IS NOT NULL AND published_score <> 'null'::jsonb THEN
        IF (published_score->>'homeScore')::integer IS DISTINCT FROM (fixture->>'homeScore')::integer
          OR (published_score->>'awayScore')::integer IS DISTINCT FROM (fixture->>'awayScore')::integer THEN
          RAISE EXCEPTION 'Published score differs: %', fixture;
        END IF;
      END IF;
      UPDATE "Match" SET
        "reportedResult" = jsonb_build_object('homeScore', (fixture->>'homeScore')::integer, 'awayScore', (fixture->>'awayScore')::integer, 'date', fixture->>'date'),
        "kickoffAt" = (fixture->>'kickoffAt')::timestamptz AT TIME ZONE 'UTC',
        "version" = "version" + 1, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = match_id;
    ELSE
      match_id := 'c' || substr(md5('confirmed-result:' || week_id || ':' || home_id || ':' || away_id), 1, 24);
      INSERT INTO "Match" ("id", "gameweekId", "kickoffAt", "reportedResult", "updatedAt") VALUES (
        match_id, week_id, (fixture->>'kickoffAt')::timestamptz AT TIME ZONE 'UTC',
        jsonb_build_object('homeScore', (fixture->>'homeScore')::integer, 'awayScore', (fixture->>'awayScore')::integer, 'date', fixture->>'date'), CURRENT_TIMESTAMP);
      INSERT INTO "MatchTeam" ("id", "matchId", "gameweekId", "clubId", "side") VALUES
        ('c' || substr(md5(match_id || ':home'), 1, 24), match_id, week_id, home_id, 'home'),
        ('c' || substr(md5(match_id || ':away'), 1, 24), match_id, week_id, away_id, 'away');
    END IF;
  END LOOP;
END $$;
