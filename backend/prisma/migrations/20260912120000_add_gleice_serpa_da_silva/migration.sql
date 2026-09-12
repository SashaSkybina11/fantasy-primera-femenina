-- Add the player to existing databases as well as the seed roster.
INSERT INTO "Player" (
  "id", "clubId", "name", "number", "position", "role", "price", "nationality", "updatedAt"
)
SELECT
  'cgleice000000000000000001', "id", 'Serpa Da Silva, Gleice', 13,
  'FIELD_PLAYER'::"PlayerPosition", 'PIVOT'::"PlayerRole", 3500, 'BR', CURRENT_TIMESTAMP
FROM "Club"
WHERE "name" = 'Cajasol Guadalcacin FS'
ON CONFLICT ("clubId", "number", "name") DO NOTHING;
