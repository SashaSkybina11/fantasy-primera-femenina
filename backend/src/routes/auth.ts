import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { inTransaction } from "../lib/transaction.js";
import { authenticate } from "../middleware/auth.js";
import { asyncRoute, ApiError } from "../utils/http.js";

const router = Router();
const credentialsSchema = z.object({
  email: z.string().trim().email("Введите корректный email").max(254),
  password: z.string().min(8, "Пароль должен содержать минимум 8 символов").max(72),
});
const registerSchema = credentialsSchema.extend({
  name: z.string().trim().min(2, "Введите имя").max(50),
});

function publicUser(user: { id: string; email: string; name: string; role: "USER" | "ADMIN"; avatarUrl: string | null; favoriteClub?: { id: string; name: string; logoUrl: string | null } | null }) {
  return { id: user.id, email: user.email, name: user.name, role: user.role, avatarUrl: user.avatarUrl, favoriteClub: user.favoriteClub ?? null };
}

function issueToken(userId: string) {
  return jwt.sign({}, env.jwtSecret, { subject: userId, expiresIn: "30d" });
}

router.post("/register", asyncRoute(async (request, response) => {
  const input = registerSchema.parse(request.body);
  const email = input.email.toLowerCase();
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) throw new ApiError(409, "Пользователь с таким email уже зарегистрирован");

  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await inTransaction(async (tx) => {
    const league = await tx.league.upsert({
      where: { name: "Fantasy Primera División Fútbol Sala Femenino" },
      update: {},
      create: { name: "Fantasy Primera División Fútbol Sala Femenino" },
    });
    const created = await tx.user.create({
      data: {
        email,
        passwordHash,
        name: input.name,
        fantasyTeam: { create: { name: `${input.name} FC`, budget: 50000 } },
      },
    });
    await tx.leagueMember.create({ data: { userId: created.id, leagueId: league.id } });
    return created;
  });

  response.status(201).json({ token: issueToken(user.id), user: publicUser(user) });
}));

router.post("/login", asyncRoute(async (request, response) => {
  const input = credentialsSchema.parse(request.body);
  const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
    throw new ApiError(401, "Неверный email или пароль");
  }
  response.json({ token: issueToken(user.id), user: publicUser(user) });
}));

router.post("/logout", authenticate, (_request, response) => response.status(204).send());

router.get("/me", authenticate, asyncRoute(async (request, response) => {
  const user = await prisma.user.findUnique({ where: { id: request.auth!.userId }, include: { favoriteClub: true } });
  if (!user) throw new ApiError(401, "Пользователь не найден");
  response.json({ user: publicUser(user) });
}));

export default router;
