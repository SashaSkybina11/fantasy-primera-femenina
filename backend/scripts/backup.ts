import { createHash, randomUUID } from "node:crypto";
import { openSync, writeFileSync, fsyncSync, closeSync, readFileSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import type { Prisma } from "@prisma/client";

export const gameTables = ["FantasyTeam", "FantasyTeamPlayer", "UserGameweekSquad", "UserGameweekPlayer", "UserGameweekPoints", "UserPointAdjustment", "GameweekWinner", "UserTransfer"] as const;
export const priceTables = ["Player", "PlayerPriceChange"] as const;
export type TableName = typeof gameTables[number] | typeof priceTables[number];
export function digest(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
export async function databaseIdentity(tx: Prisma.TransactionClient) {
  const rows = await tx.$queryRaw<Array<{ database: string; address: string | null; port: number | null }>>`SELECT current_database() AS database, inet_server_addr()::text AS address, inet_server_port() AS port`;
  return rows[0]!;
}
export async function snapshot(tx: Prisma.TransactionClient, tables: readonly TableName[]) {
  const result: Record<string, unknown[]> = {};
  for (const table of tables) result[table] = await tx.$queryRawUnsafe('SELECT * FROM "' + table + '" ORDER BY "id"');
  return result;
}
export async function preservedFingerprint(tx: Prisma.TransactionClient) {
  const users = await tx.user.findMany({ orderBy: { id: "asc" } });
  const stats = await tx.$queryRawUnsafe('SELECT * FROM "PlayerGameweekStats" ORDER BY "id"');
  const memberships = await tx.privateLeagueMember.findMany({ orderBy: { id: "asc" } });
  return digest({ users, stats, memberships });
}
export function saveBackup(directory: string, value: unknown) {
  const folder = resolve(directory);
  mkdirSync(folder, { recursive: true });
  const path = join(folder, 'prelaunch-' + Date.now() + '-' + randomUUID() + '.json');
  const contents = JSON.stringify(value, null, 2);
  const fd = openSync(path, "wx", 0o600);
  try { writeFileSync(fd, contents); fsyncSync(fd); } finally { closeSync(fd); }
  if (readFileSync(path, "utf8") !== contents) throw new Error("Backup verification failed");
  return { path, sha256: digest(value) };
}
export async function lockGameTables(tx: Prisma.TransactionClient) {
  // Acquire before taking the snapshot, serializing purchases, registrations and scoring.
  await tx.$executeRawUnsafe('LOCK TABLE "User", "PlayerGameweekStats", "PrivateLeagueMember", "FantasyTeam", "FantasyTeamPlayer", "UserGameweekSquad", "UserGameweekPlayer", "UserGameweekPoints", "UserPointAdjustment", "GameweekWinner", "UserTransfer" IN EXCLUSIVE MODE');
}

export function saveReceipt(path: string, value: unknown) {
  const contents = JSON.stringify(value, null, 2);
  const fd = openSync(path + ".receipt.json", "wx", 0o600);
  try { writeFileSync(fd, contents); fsyncSync(fd); } finally { closeSync(fd); }
  if (readFileSync(path + ".receipt.json", "utf8") !== contents) throw new Error("Receipt verification failed");
}
