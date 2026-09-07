import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";
import { INITIAL_BUDGET } from "../src/config/game.js";
import { databaseIdentity, digest, gameTables, lockGameTables, preservedFingerprint, saveBackup, saveReceipt, snapshot } from "./backup.js";

export async function resetGameUsers(prisma: PrismaClient, options: { apply: boolean; backupDirectory?: string; failAfterDelete?: boolean }) {
  if (options.apply && !options.backupDirectory) throw new Error("--backup-dir is required for --apply");
  return prisma.$transaction(async (tx) => {
    await lockGameTables(tx);
    const users = await tx.user.findMany({ select: { id: true, name: true } });
    const before = await snapshot(tx, gameTables);
    const preserved = await preservedFingerprint(tx);
    const database = await databaseIdentity(tx);
    if (!options.apply) return { dryRun: true, users: users.length, counts: Object.fromEntries(Object.entries(before).map(([table, rows]) => [table, rows.length])), initialBudget: INITIAL_BUDGET };
    // The durable, verified backup is written under the same locks before any deletion.
    const backup = saveBackup(options.backupDirectory!, { version: 1, kind: "game-reset", database, createdAt: new Date(), preserved, tables: before });
    const removed = {
      teamPlayers: (await tx.fantasyTeamPlayer.deleteMany()).count,
      snapshotPlayers: (await tx.userGameweekPlayer.deleteMany()).count,
      snapshots: (await tx.userGameweekSquad.deleteMany()).count,
      userPoints: (await tx.userGameweekPoints.deleteMany()).count,
      adjustments: (await tx.userPointAdjustment.deleteMany()).count,
      winners: (await tx.gameweekWinner.deleteMany()).count,
      transfers: (await tx.userTransfer.deleteMany()).count,
    };
    if (options.failAfterDelete) throw new Error("Injected rollback test");
    await tx.fantasyTeam.updateMany({ data: { budget: INITIAL_BUDGET, isInitialSquadComplete: false } });
    const existing = new Set((await tx.fantasyTeam.findMany({ select: { userId: true } })).map((team) => team.userId));
    for (const user of users) if (!existing.has(user.id)) await tx.fantasyTeam.create({ data: { userId: user.id, name: user.name + " FC", budget: INITIAL_BUDGET } });
    const after = await snapshot(tx, gameTables);
    if (await preservedFingerprint(tx) !== preserved) throw new Error("Protected account/statistics data changed");
    if (after.FantasyTeam.length !== users.length || await tx.fantasyTeam.count({ where: { OR: [{ budget: { not: INITIAL_BUDGET } }, { isInitialSquadComplete: true }] } })) throw new Error("Budget verification failed");
    if (gameTables.filter((table) => table !== "FantasyTeam").some((table) => after[table].length)) throw new Error("Gameplay records remain");
    const result = { dryRun: false, usersProcessed: users.length, budgetsReset: users.length, userPointsReset: users.length, removed, backup, afterFingerprint: digest(after), errors: 0 };
    saveReceipt(backup.path, result);
    return result;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 15000, timeout: 120000 });
}
