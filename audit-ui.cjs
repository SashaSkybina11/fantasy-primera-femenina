const fs = require('fs');
const edit = (p, f) => fs.writeFileSync(p, f(fs.readFileSync(p, 'utf8')).replace(/\r\n/g, '\n'));
edit('frontend/src/contexts/LocaleContext.tsx', s => s.replace('const spanish = {', 'const spanish = {\n  "gameweek.label": "Jornada {{number}}",\n  "prices.history": "Historial de precios",\n  "prices.empty": "Todavía no hay precios calculados.",')
.replace('const ukrainian: Record<TranslationKey, string> = {', 'const ukrainian: Record<TranslationKey, string> = {\n  "gameweek.label": "Тур {{number}}",\n  "prices.history": "Історія цін",\n  "prices.empty": "Розрахованих цін поки немає.",')
.replace('El total de la jornada nunca es negativo.', 'El total de la jornada puede ser negativo.')
.replace('Підсумок за тур не може бути від’ємним.', 'Підсумок за тур може бути від’ємним.')
.replace('La capitana debe formar parte del quinteto inicial y sus puntos se multiplican por dos.', 'La capitana forma parte del quinteto inicial. Sus puntos cuentan una vez, como los de las otras cuatro titulares.')
.replace(/Капітанка має бути[^"\n]*подво[^"\n]*\./g, 'Капітанка входить до основної п’ятірки. Її очки враховуються один раз, як і очки решти гравчинь основи.')
.replace('; la capitana suma el doble.', '. Se suman los puntos de las cinco titulares.')
.replace(', а капітанка отримує подвійні очки.', '. Враховується сума очок п’яти гравчинь основи.')
.replace('    setLocale,', '    setLocale: (next) => { localStorage.setItem(storageKey, next); setLocale(next); },'));
edit('frontend/src/services/api.ts', s => s.replace('const apiMessages:', 'const apiMessages:')
.replace('  "Недостаточно прав администратора":', '  "GAMEWEEK_NOT_LOCKED": { es: "Espera al cierre de la jornada.", uk: "Дочекайтеся закриття туру." },\n  "Недостаточно прав администратора":')
.replace('return apiMessages[message]?.[locale] ?? message;', 'return apiMessages[message]?.[locale] ?? localizedApiMessage(undefined);')
.replace('if (!response.ok) throw new Error(localizedApiMessage(data.message));', 'if (!response.ok) {\n    const error = new Error();\n    Object.defineProperty(error, "message", { get: () => localizedApiMessage(data.message) });\n    throw error;\n  }')
.replace('export const api = {', 'export const api = {\n  playerPrices: () => request<Array<Player & { priceChanges: Array<{ id: string; gameweek: Gameweek; priceBefore: number; priceAfter: number; priceDelta: number }> }>>("/player-prices"),'));
for (const p of ['AdminPlayerPointsPage', 'AdminPlayerPricesPage', 'HomePage', 'LeaderboardPage', 'PurchasePlayersPage']) edit(`frontend/src/pages/${p}.tsx`, s => s.replace('{item.name} ·', '{t("gameweek.label", { number: item.number })} ·').replace('{row.name} ·', '{t("gameweek.label", { number: row.number })} ·').replaceAll('{gameweek.data.name}', '{t("gameweek.label", { number: gameweek.data.number })}').replace('{row.gameweek.name}', '{t("gameweek.label", { number: row.gameweek.number })}'));
edit('frontend/src/pages/AdminPlayerPointsPage.tsx', s => s.replace('{ api }', '{ api, roleLabel }').replace('const { t } = useLocale();', 'const { t, locale } = useLocale();').replace('{player.role}', '{roleLabel(player.role, locale)}'));
edit('frontend/src/pages/RulesPage.tsx', s => s.replace('⚽ FANTASY FUTSAL FEMENINO 🇪🇸', '⚽ {t("home.eyebrow")}'));
edit('backend/src/routes/catalog.ts', s => s.replace('router.get("/clubs",', 'router.get("/player-prices", asyncRoute(async (_request, response) => {\n  response.json(await prisma.player.findMany({ include: { club: true, priceChanges: { include: { gameweek: true }, orderBy: { gameweek: { number: "desc" } } } }, orderBy: { name: "asc" } }));\n}));\n\nrouter.get("/clubs",'));
edit('frontend/src/App.tsx', s => 'import { PlayerPricesPage } from "./pages/PlayerPricesPage";\n' + s.replace('<Route path="/my-team"', '<Route path="/player-prices" element={<PlayerPricesPage />} />\n        <Route path="/my-team"'));
edit('frontend/src/layouts/AppShell.tsx', s => s.replace('const navigation = [', 'const navigation = [\n    { to: "/player-prices", label: t("prices.title"), icon: "purchase" as const },'));
const old = fs.readFileSync('backend/prisma/migrations/20260905120000_scoring_market_player_prices/migration.sql', 'utf8');
const rebuild = old.slice(old.indexOf('WITH totals AS')).replace('COALESCE(SUM(CASE WHEN e."isCaptain" THEN s."totalPoints" ELSE 0 END), 0)::integer AS captain', '0::integer AS captain').replace('COALESCE(s."totalPoints", 0) * CASE WHEN e."isCaptain" THEN 2 ELSE 1 END', 'COALESCE(s."totalPoints", 0)').replace('FROM "UserGameweekPoints"\n)', 'FROM "UserGameweekPoints" WHERE "userId" IN (SELECT id FROM "User" WHERE role = \'USER\')\n)').replace('AND u.rank = 1;', 'AND u.rank = 1 AND u."userId" IN (SELECT id FROM "User" WHERE role = \'USER\');');
fs.mkdirSync('backend/prisma/migrations/20260908120000_scoring_admin_consistency', {recursive:true});
fs.writeFileSync('backend/prisma/migrations/20260908120000_scoring_admin_consistency/migration.sql', `-- Preserve events, adjustments, squads and price history; rebuild derived scores.
ALTER TABLE "PlayerGameweekStats" DROP CONSTRAINT IF EXISTS "stats_total_nonnegative";
UPDATE "PlayerGameweekStats" SET "totalPoints" = "calculatedPoints" + "adjustmentPoints";
UPDATE "UserGameweekPoints" SET rank = NULL WHERE "userId" IN (SELECT id FROM "User" WHERE role = 'ADMIN');
` + rebuild);
