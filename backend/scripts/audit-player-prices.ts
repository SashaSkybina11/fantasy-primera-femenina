import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";
import { players as seed } from "../prisma/data/players.js";
import { databaseIdentity, priceTables, saveBackup, snapshot } from "./backup.js";
const args = process.argv.slice(2);
const apply = args.includes("--apply");
const directory = args[args.indexOf("--backup-dir") + 1];
if (apply && (!args.includes("--backup-dir") || !directory)) throw new Error("--backup-dir required");
const key = (club: string, number: number, name: string) => JSON.stringify([club, number, name]);
const expected = new Map(seed.map((p) => [key(p.club, p.number, p.name), p.price]));
if (expected.size !== seed.length || seed.some((p) => !Number.isSafeInteger(p.price) || p.price <= 0)) throw new Error("Invalid or duplicate seed entries");
const prisma = new PrismaClient();
try {
  const report = await prisma.$transaction(async (tx) => {
    if (apply) await tx.$executeRawUnsafe('LOCK TABLE "Player", "PlayerPriceChange" IN EXCLUSIVE MODE');
    const all = await tx.player.findMany({ include: { club: true, priceChanges: { orderBy: { gameweek: { number: "asc" } } } }, orderBy: { id: "asc" } });
    const differences: Array<{ id: string; name: string; club: string; actual: number; expected: number; seed: number }> = [];
    const review: unknown[] = [];
    const seen = new Set<string>();
    const duplicates = new Map<string, string[]>();
    for (const player of all) {
      const identity = key(player.club.name, player.number, player.name);
      const base = expected.get(identity);
      seen.add(identity);
      const duplicateKey = player.clubId + ":" + player.name.normalize("NFKC").trim().toLocaleLowerCase();
      duplicates.set(duplicateKey, [...(duplicates.get(duplicateKey) ?? []), player.id]);
      if (base === undefined) { review.push({ id: player.id, reason: "Missing seed identity", name: player.name }); continue; }
      let current = base;
      let chainValid = true;
      for (const change of player.priceChanges) {
        if (change.priceBefore !== current || change.priceAfter !== change.priceBefore + change.priceDelta) chainValid = false;
        current = change.priceAfter;
      }
      if (!chainValid) { review.push({ id: player.id, name: player.name, reason: "Price history diverges from seed; classify real/test changes before rebasing" }); continue; }
      if (!Number.isSafeInteger(current) || current <= 0) { review.push({ id: player.id, reason: "Invalid expected price" }); continue; }
      if (player.price !== current || !Number.isSafeInteger(player.price)) differences.push({ id: player.id, name: player.name, club: player.club.name, actual: player.price, expected: current, seed: base });
    }
    const missing = seed.filter((p) => !seen.has(key(p.club, p.number, p.name)));
    for (const [identity, ids] of duplicates) if (ids.length > 1) review.push({ identity, ids, reason: "Possible duplicate player" });
    let backup;
    if (apply) {
      if (missing.length || review.length) throw new Error("Audit requires review; run without --apply for details. Nothing changed.");
      if (differences.length) {
        backup = saveBackup(directory, { version: 1, kind: "price-audit", database: await databaseIdentity(tx), createdAt: new Date(), tables: await snapshot(tx, priceTables) });
        for (const row of differences) await tx.player.update({ where: { id: row.id }, data: { price: row.expected } });
        for (const row of differences) if ((await tx.player.findUniqueOrThrow({ where: { id: row.id } })).price !== row.expected) throw new Error("Price verification failed");
      }
    }
    return { database: await databaseIdentity(tx), playersInDatabase: all.length, playersChecked: all.length, correctedPrices: apply ? differences.length : 0, differences, missing, review, backup, preservedPriceHistory: true };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120000 });
  console.info(JSON.stringify(report, null, 2));
  if (report.review.length || report.missing.length || (!apply && report.differences.length)) process.exitCode = 1;
} catch (error) { console.error(error instanceof Error ? error.message : "Price audit failed"); process.exitCode = 1; }
finally { await prisma.$disconnect(); }
