const fs = require('fs');
const edit = (p, f) => fs.writeFileSync(p, f(fs.readFileSync(p, 'utf8')).replace(/\r\n/g, '\n'));
edit('backend/src/services/gameweeks.ts', s => s.replace('import { ApiError', 'import { applyPlayerPrices, previewPlayerPrices } from "./player-prices.js";\nimport { ApiError')
.replace('export async function requireOpenMarket(lineup = false)', 'export async function requireOpenMarket(lineup = false, userId?: string)')
.replace('return assertOpenMarket(prisma, lineup);', 'return assertOpenMarket(prisma, lineup, new Date(), userId);')
.replace('now = new Date()) {\n  const gameweek = await tx.gameweek.findFirst', 'now = new Date(), userId?: string) {\n  if (userId && (await tx.user.findUnique({ where: { id: userId }, select: { role: true } }))?.role === "ADMIN") {\n    return tx.gameweek.findFirstOrThrow({ orderBy: { number: "desc" }, where: { marketOpenAt: { lte: now } } });\n  }\n  const gameweek = await tx.gameweek.findFirst')
.replace('  const squads = await tx.userGameweekSquad.findMany({', `  const gameweek = await tx.gameweek.findUniqueOrThrow({ where: { id: gameweekId } });
  const sourceStats = await tx.playerGameweekStats.findMany({ where: { gameweekId }, include: { player: true } });
  for (const stat of sourceStats) {
    const calculatedPoints = calculatePlayerPoints({ ...stat, position: stat.player.position });
    await tx.playerGameweekStats.update({ where: { id: stat.id }, data: { calculatedPoints, totalPoints: calculatedPoints + stat.adjustmentPoints } });
  }
  if (gameweek.status === "COMPLETED") {
    const preview = await previewPlayerPrices(tx, gameweekId);
    await applyPlayerPrices(tx, gameweekId, preview.revision);
  }
  const squads = await tx.userGameweekSquad.findMany({`)
.replace('basePoints * (item.isCaptain ? 2 : 1)', 'basePoints')
.replace('      if (item.isCaptain) captainBonus += basePoints;\n', '')
.replace('  const rows = await tx.userGameweekPoints.findMany({ where: { gameweekId },', '  await tx.userGameweekPoints.updateMany({ where: { gameweekId, user: { role: "ADMIN" } }, data: { rank: null } });\n  const rows = await tx.userGameweekPoints.findMany({ where: { gameweekId, user: { role: "USER" } },')
.replace('  return rows;', `  if (gameweek.status === "COMPLETED") {
    await tx.userGameweekPoints.updateMany({ where: { gameweekId }, data: { isFinal: true } });
    await tx.gameweekWinner.deleteMany({ where: { gameweekId } });
    const leaders = await tx.userGameweekPoints.findMany({ where: { gameweekId, rank: 1, user: { role: "USER" } } });
    if (leaders.length) await tx.gameweekWinner.createMany({ data: leaders.map(row => ({ gameweekId, userId: row.userId, rank: 1, points: row.totalPoints })) });
  }
  return rows;`));
edit('backend/src/routes/admin.ts', s => s.replace('Math.max(0, calculatedPoints + input.adjustmentPoints)', 'calculatedPoints + input.adjustmentPoints')
.replace('    if (gameweek.status === GameweekStatus.COMPLETED) throw new ApiError(409, "Тур уже завершён");\n    await snapshotGameweek(tx, id); await recalculateGameweek(tx, id);', '    if (gameweek.deadlineAt > new Date()) throw new ApiError(409, "GAMEWEEK_NOT_LOCKED");\n    await tx.gameweek.update({ where: { id }, data: { status: GameweekStatus.COMPLETED } });\n    await recalculateGameweek(tx, id);')
.replace('where: { gameweekId: id, rank: 1 }', 'where: { gameweekId: id, rank: 1, user: { role: "USER" } }')
.replace('gameweekWinner.findMany({ orderBy:', 'gameweekWinner.findMany({ where: { user: { role: "USER" }, gameweek: { status: "COMPLETED" } }, orderBy:')
.replace('winners: { include:', 'winners: { where: { user: { role: "USER" }, gameweek: { status: "COMPLETED" } }, include:')
.replace('select: { role: true }', 'select: { role: true }'));
edit('backend/src/services/player-stats.ts', s => s.replace('Math.max(0, calculatedPoints + (old?.adjustmentPoints ?? 0))', 'calculatedPoints + (old?.adjustmentPoints ?? 0)'));
edit('backend/src/routes/team.ts', s => s.replaceAll('await requireOpenMarket();', 'await requireOpenMarket(false, request.auth!.userId);').replaceAll('await requireOpenMarket(true);', 'await requireOpenMarket(true, request.auth!.userId);').replaceAll('await assertOpenMarket(tx, request.method === "PATCH");', 'await assertOpenMarket(tx, request.method === "PATCH", new Date(), request.auth!.userId);')
.replace('router.use(authenticate);', 'router.use(authenticate);\n\nasync function isAdmin(userId: string) {\n  return (await prisma.user.findUnique({ where: { id: userId }, select: { role: true } }))?.role === "ADMIN";\n}')
.replace('marketIsOpen: gameweek.status === "OPEN" && gameweek.marketOpenAt <= now && now < gameweek.deadlineAt', 'marketIsOpen: await isAdmin(request.auth!.userId) || (gameweek.status === "OPEN" && gameweek.marketOpenAt <= now && now < gameweek.deadlineAt)')
.replace('if (purchases >= 2)', 'if (purchases >= 2 && (await tx.user.findUnique({ where: { id: request.auth!.userId } }))?.role !== "ADMIN")')
.replace('if (sales >= 2)', 'if (sales >= 2 && (await tx.user.findUnique({ where: { id: request.auth!.userId } }))?.role !== "ADMIN")'));
edit('backend/src/routes/gameweeks.ts', s => s.replace('"/current", asyncRoute(async (_request, response)', '"/current", asyncRoute(async (request, response)')
.replace('marketIsOpen: gameweek.status === "OPEN" && gameweek.marketOpenAt <= now && now < gameweek.deadlineAt', 'marketIsOpen: (await prisma.user.findUnique({ where: { id: request.auth!.userId }, select: { role: true } }))?.role === "ADMIN" || (gameweek.status === "OPEN" && gameweek.marketOpenAt <= now && now < gameweek.deadlineAt)')
.replace('const totals = await prisma.user.findMany({', 'const totals = await prisma.user.findMany({\n    where: { role: "USER" },')
.replace('totals.filter((user) => user.fantasyTeam?.players.length === 10 && user.fantasyTeam.players.filter((entry) => entry.player.position === "GOALKEEPER").length === 2)', 'totals.filter((user) => user.gameweekPoints.length > 0 || (user.fantasyTeam?.players.length === 10 && user.fantasyTeam.players.filter((entry) => entry.player.position === "GOALKEEPER").length === 2))')
.replace('where: { gameweekId: id }, orderBy:', 'where: { gameweekId: id, user: { role: "USER" } }, orderBy:'));
edit('backend/src/routes/private-leagues.ts', s => s.replaceAll('members: { include: { user:', 'members: { where: { user: { role: "USER" } }, include: { user:').replaceAll('_count: { select: { members: true } }', '_count: { select: { members: { where: { user: { role: "USER" } } } } }'));
edit('backend/src/services/player-popularity.ts', s => s.replace('where: { players: { some: {} } }', 'where: { user: { role: "USER" }, players: { some: {} } }').replace('    by: ["playerId"],', '    by: ["playerId"],\n    where: { fantasyTeam: { user: { role: "USER" } } },'));
edit('backend/src/routes/league.ts', s => s.replace('where: { leagueId: league.id }', 'where: { leagueId: league.id, user: { role: "USER" } }').replace('members: true', 'members: { where: { user: { role: "USER" } } }').replace('supporters: true', 'supporters: { where: { role: "USER" } }'));
