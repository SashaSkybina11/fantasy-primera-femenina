import { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";

const maxAttempts = 3;

export async function inTransaction<T>(action: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await prisma.$transaction(action, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 60000, maxWait: 10000 });
    } catch (error) {
      const canRetry = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034" && attempt < maxAttempts - 1;
      if (!canRetry) throw error;
    }
  }

  throw new Error("Не удалось завершить операцию с составом");
}
