import bcrypt from "bcrypt";
import { PrismaClient, UserRole } from "@prisma/client";

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
const name = process.env.ADMIN_NAME?.trim() || "Oleksandra";

if (process.env.CONFIRM_RESET_USERS !== "YES" || !email || !password) {
  throw new Error("Укажите CONFIRM_RESET_USERS=YES, ADMIN_EMAIL и ADMIN_PASSWORD");
}
if (password.length < 8) throw new Error("Пароль администратора должен содержать минимум 8 символов");

const prisma = new PrismaClient();

try {
  const admin = await prisma.$transaction(async (tx) => {
    await tx.user.deleteMany();
    const league = await tx.league.upsert({
      where: { name: "Fantasy Primera División Fútbol Sala Femenino" },
      update: {},
      create: { name: "Fantasy Primera División Fútbol Sala Femenino" },
    });
    const user = await tx.user.create({
      data: {
        email,
        name,
        role: UserRole.ADMIN,
        passwordHash: await bcrypt.hash(password, 12),
        fantasyTeam: { create: { name: `${name} FC`, budget: 50000 } },
      },
    });
    await tx.leagueMember.create({ data: { leagueId: league.id, userId: user.id } });
    return user;
  });
  console.info(`Создан администратор: ${admin.email}`);
} finally {
  await prisma.$disconnect();
}
