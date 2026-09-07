import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { resetGameUsers } from "./reset-game-users.js";
const args = process.argv.slice(2);
const prisma = new PrismaClient();
try {
  const index = args.indexOf("--backup-dir");
  const result = await resetGameUsers(prisma, { apply: args.includes("--apply"), backupDirectory: index >= 0 ? args[index + 1] : undefined });
  console.info(JSON.stringify(result, null, 2));
} catch (error) { console.error(error instanceof Error ? error.message : "Reset failed"); process.exitCode = 1; }
finally { await prisma.$disconnect(); }
