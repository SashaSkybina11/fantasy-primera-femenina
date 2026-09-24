import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../config/env.js";
import { INITIAL_BUDGET } from "../config/game.js";
import { prisma } from "../lib/prisma.js";
import { inTransaction } from "../lib/transaction.js";
import { authenticate } from "../middleware/auth.js";
import { asyncRoute, ApiError } from "../utils/http.js";
import { assertEmailConfigured, consumeEmailChallenge, createEmailChallenge, sendAuthEmail, takeAuthLimit } from "../services/auth-email.js";

const router = Router();
const credentialsSchema = z.object({
  email: z.string().trim().email("Введите корректный email").max(254),
  password: z.string().min(8, "Пароль должен содержать минимум 8 символов").max(72),
});
const registerSchema = credentialsSchema.extend({
  name: z.string().trim().min(2, "Введите имя").max(50),
});
const emailSchema = credentialsSchema.pick({ email: true });

router.use(asyncRoute(async (request, _response, next) => {
  if (request.method !== "POST" || request.path === "/logout") return next();
  // Vercel overwrites this header; other hosts use the socket address, never an untrusted X-Forwarded-For.
  const ip = process.env.VERCEL ? request.header("x-vercel-forwarded-for") ?? request.ip ?? "unknown" : request.ip ?? "unknown";
  await takeAuthLimit("auth-ip", ip, 60, 15 * 60_000);
  next();
}));

async function emailSendLimits(email: string) {
  assertEmailConfigured();
  await takeAuthLimit("email-minute", email, 1, 60_000);
  await takeAuthLimit("email-hour", email, 5, 60 * 60_000);
}

function publicUser(user: { id: string; email: string; name: string; role: "USER" | "ADMIN"; avatarUrl: string | null; favoriteClub?: { id: string; name: string; logoUrl: string | null } | null }) {
  return { id: user.id, email: user.email, name: user.name, role: user.role, avatarUrl: user.avatarUrl, favoriteClub: user.favoriteClub ?? null };
}

function issueToken(userId: string, sessionVersion: number) {
  return jwt.sign({ sessionVersion }, env.jwtSecret, { subject: userId, expiresIn: "30d" });
}

router.post("/register", asyncRoute(async (request, response) => {
  const input = registerSchema.parse(request.body);
  const email = input.email.toLowerCase();
  await emailSendLimits(email);
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) throw new ApiError(409, "Пользователь с таким email уже зарегистрирован");

  const passwordHash = await bcrypt.hash(input.password, 12);
  const { secret } = await createEmailChallenge({ email, purpose: "REGISTER", name: input.name, passwordHash });
  await sendAuthEmail(email, "REGISTER", secret, request.header("accept-language"));
  response.status(202).json({ verificationRequired: true, email, retryAfterSeconds: 60 });
}));

router.post("/verify-email", asyncRoute(async (request, response) => {
  const input = emailSchema.extend({ code: z.string().regex(/^\d{6}$/, "AUTH_INVALID_CODE") }).parse(request.body);
  const email = input.email.toLowerCase();
  const user = await inTransaction(async (tx) => {
    const challenge = await consumeEmailChallenge(tx, email, "REGISTER", input.code);
    if (!challenge?.name || !challenge.passwordHash) return null;
    if (await tx.user.findUnique({ where: { email } })) return null;
    const league = await tx.league.upsert({
      where: { name: "Fantasy Primera División Fútbol Sala Femenino" },
      update: {},
      create: { name: "Fantasy Primera División Fútbol Sala Femenino" },
    });
    const created = await tx.user.create({
      data: {
        email,
        passwordHash: challenge.passwordHash,
        name: challenge.name,
        emailVerifiedAt: new Date(),
        fantasyTeam: { create: { name: `${challenge.name} FC`, budget: INITIAL_BUDGET } },
      },
    });
    await tx.leagueMember.create({ data: { userId: created.id, leagueId: league.id } });
    return created;
  });

  if (!user) throw new ApiError(400, "AUTH_INVALID_CODE");
  response.status(201).json({ token: issueToken(user.id, user.sessionVersion), user: publicUser(user) });
}));

router.post("/resend-verification", asyncRoute(async (request, response) => {
  const { email: rawEmail } = emailSchema.parse(request.body);
  const email = rawEmail.toLowerCase();
  await emailSendLimits(email);
  const previous = await prisma.emailChallenge.findUnique({ where: { email_purpose: { email, purpose: "REGISTER" } } });
  if (!previous || previous.consumedAt || !previous.name || !previous.passwordHash || previous.expiresAt.getTime() < Date.now() - 24 * 60 * 60_000) {
    throw new ApiError(400, "AUTH_REGISTRATION_EXPIRED");
  }
  const { secret } = await createEmailChallenge({ email, purpose: "REGISTER", name: previous.name, passwordHash: previous.passwordHash });
  await sendAuthEmail(email, "REGISTER", secret, request.header("accept-language"));
  response.json({ retryAfterSeconds: 60 });
}));

router.post("/forgot-password", asyncRoute(async (request, response) => {
  const { email: rawEmail } = emailSchema.parse(request.body);
  const email = rawEmail.toLowerCase();
  await emailSendLimits(email);
  const user = await prisma.user.findUnique({ where: { email } });
  // Same response for registered and unknown emails; never expose account existence.
  if (user) {
    const { secret } = await createEmailChallenge({ email, purpose: "RESET", userId: user.id, sessionVersion: user.sessionVersion });
    try {
      await sendAuthEmail(email, "RESET", secret, request.header("accept-language"));
    } catch {
      console.error("Password reset email delivery failed");
    }
  }
  response.json({ ok: true, retryAfterSeconds: 60 });
}));

router.post("/reset-password", asyncRoute(async (request, response) => {
  const input = credentialsSchema.extend({ token: z.string().regex(/^[a-f0-9]{64}$/, "AUTH_INVALID_RESET") }).parse(request.body);
  const email = input.email.toLowerCase();
  const passwordHash = await bcrypt.hash(input.password, 12);
  const reset = await inTransaction(async tx => {
    const challenge = await consumeEmailChallenge(tx, email, "RESET", input.token);
    if (!challenge?.userId || challenge.sessionVersion == null) return false;
    const updated = await tx.user.updateMany({
      where: { id: challenge.userId, email, sessionVersion: challenge.sessionVersion },
      data: { passwordHash, emailVerifiedAt: new Date(), sessionVersion: { increment: 1 } },
    });
    return updated.count === 1;
  });
  if (!reset) throw new ApiError(400, "AUTH_INVALID_RESET");
  response.json({ ok: true });
}));

router.post("/login", asyncRoute(async (request, response) => {
  const input = credentialsSchema.parse(request.body);
  const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() }, include: { favoriteClub: true } });
  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
    throw new ApiError(401, "Неверный email или пароль");
  }
  response.json({ token: issueToken(user.id, user.sessionVersion), user: publicUser(user) });
}));

router.post("/logout", authenticate, (_request, response) => response.status(204).send());

router.get("/me", authenticate, asyncRoute(async (request, response) => {
  const user = await prisma.user.findUnique({ where: { id: request.auth!.userId }, include: { favoriteClub: true } });
  if (!user) throw new ApiError(401, "Пользователь не найден");
  response.json({ user: publicUser(user) });
}));

export default router;
