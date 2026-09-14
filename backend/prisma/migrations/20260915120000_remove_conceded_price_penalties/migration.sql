-- Refund only recorded goalkeeper penalties; preserve other price changes.
WITH refunds AS (
 SELECT "playerId", SUM(-LEAST("goalkeeperDelta", 0))::integer AS amount
 FROM "PlayerPriceChange" GROUP BY "playerId"
)
UPDATE "Player" p SET price = p.price + r.amount FROM refunds r WHERE p.id = r."playerId" AND r.amount > 0;

WITH corrections AS (
 SELECT c.id, -LEAST(c."goalkeeperDelta", 0) AS refund,
 COALESCE(SUM(-LEAST(c."goalkeeperDelta", 0)) OVER (
 PARTITION BY c."playerId" ORDER BY g.number ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
 ), 0)::integer AS prior_refund
 FROM "PlayerPriceChange" c JOIN "Gameweek" g ON g.id = c."gameweekId"
)
UPDATE "PlayerPriceChange" c SET
 "priceBefore" = c."priceBefore" + r.prior_refund,
 "priceAfter" = c."priceAfter" + r.prior_refund + r.refund,
 "priceDelta" = c."priceDelta" + r.refund,
 "goalkeeperDelta" = GREATEST(c."goalkeeperDelta", 0)
FROM corrections r WHERE c.id = r.id;
