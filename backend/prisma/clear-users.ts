import { PrismaClient } from "@prisma/client";

if (process.env.CONFIRM_DELETE_USERS !== "YES") {
  throw new Error('Для удаления пользователей запустите команду с CONFIRM_DELETE_USERS=YES');
}

const prisma = new PrismaClient();

try {
  const result = await prisma.user.deleteMany();
  console.info(`Удалено пользователей: ${result.count}`);
} finally {
  await prisma.$disconnect();
}
