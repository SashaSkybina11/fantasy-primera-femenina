import { dirname } from "node:path";
import "dotenv/config";
import { readFileSync } from "node:fs";
import { PrismaClient, Prisma } from "@prisma/client";
import { databaseIdentity, digest, gameTables, lockGameTables, preservedFingerprint, saveBackup, snapshot } from "./backup.js";
const path = process.argv[2];
if (!path) throw new Error("Provide backup JSON path; --apply is required to restore");
const backup = JSON.parse(readFileSync(path, "utf8"));
const receipt = JSON.parse(readFileSync(path + ".receipt.json", "utf8"));
if (backup.version !== 1 || backup.kind !== "game-reset" || digest(backup) !== receipt.backup.sha256) throw new Error("Invalid backup or checksum");
if (gameTables.some((table) => !Array.isArray(backup.tables[table]))) throw new Error("Incomplete backup");
const prisma = new PrismaClient();
try {
  const result = await prisma.$transaction(async (tx) => {
    await lockGameTables(tx);
    if (JSON.stringify(await databaseIdentity(tx)) !== JSON.stringify(backup.database)) throw new Error("Wrong database");
    if (await preservedFingerprint(tx) !== backup.preserved) throw new Error("Accounts/statistics changed since reset; manual recovery required");
    const current = await snapshot(tx, gameTables);
    if (digest(current) !== receipt.afterFingerprint) throw new Error("Gameplay changed since reset; refusing to overwrite new activity");
    if (!process.argv.includes("--apply")) return { dryRun: true, canRestore: true };
    const recovery = saveBackup(dirname(path), { kind: "before-restore", tables: current });
    for (const table of [...gameTables].reverse()) await tx.$executeRawUnsafe('DELETE FROM "' + table + '"');
    for (const table of gameTables) if (backup.tables[table].length) await tx.$executeRawUnsafe('INSERT INTO "' + table + '" SELECT * FROM json_populate_recordset(NULL::"' + table + '", $1::json)', JSON.stringify(backup.tables[table]));
    if (digest(await snapshot(tx, gameTables)) !== digest(backup.tables)) throw new Error("Restore verification failed");
    return { restored: true, recovery };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120000 });
  console.info(JSON.stringify(result, null, 2));
} catch (error) { console.error(error instanceof Error ? error.message : "Restore failed"); process.exitCode = 1; }
finally { await prisma.$disconnect(); }
