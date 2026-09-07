import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { players } from "../prisma/data/players.js";
const csvPath = fileURLToPath(new URL("../../Цені игроков.csv", import.meta.url));
const seedPath = fileURLToPath(new URL("../prisma/data/players.ts", import.meta.url));
const bytes = readFileSync(csvPath);
let contents: string;
try { contents = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { contents = new TextDecoder("windows-1252").decode(bytes); }
const key = (p: { club: string; number: number; name: string }) => JSON.stringify([p.club, p.number, p.name]);
const rows = contents.trim().split(/\r?\n/).slice(1).map((line, index) => {
  const fields = line.split(";");
  const [club, number, name, , price] = fields;
  if (fields.length !== 5 || !club || !name || !Number.isSafeInteger(Number(price)) || Number(price) <= 0) throw new Error("Invalid CSV row " + (index + 2));
  return { club, number: Number(number), name, price: Number(price) };
});
const csv = new Map(rows.map((row) => [key(row), row]));
if (rows.length !== csv.size || players.length !== rows.length || players.some((p) => !csv.has(key(p))) || new Set(players.map(key)).size !== players.length) throw new Error("CSV/seed identities or counts do not match");
const differences = players.filter((p) => p.price !== csv.get(key(p))!.price).map((p) => ({ club: p.club, name: p.name, number: p.number, seedPrice: p.price, csvPrice: csv.get(key(p))!.price }));
if (process.argv.includes("--write")) {
  let seen = 0;
  const updated = readFileSync(seedPath, "utf8").replace(/\{\s*club:\s*"([^"]+)"[\s\S]*?\n  \}/g, (block) => {
    const club = /club:\s*"([^"]+)"/.exec(block)![1];
    const name = /name:\s*"([^"]+)"/.exec(block)![1];
    const number = Number(/number:\s*(\d+)/.exec(block)![1]);
    const row = csv.get(key({ club, name, number }));
    if (!row) throw new Error("Unknown seed block");
    seen++;
    return block.replace(/price:\s*\d+/, "price: " + row.price);
  });
  if (seen !== players.length) throw new Error("Incomplete seed update");
  writeFileSync(seedPath, updated);
}
console.info(JSON.stringify({ players: players.length, checked: rows.length, corrected: process.argv.includes("--write") ? differences.length : 0, differences, unusualPrices: rows.filter((p) => p.price < 1000) }, null, 2));
if (differences.length && !process.argv.includes("--write")) process.exitCode = 1;
