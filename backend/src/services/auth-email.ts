import { randomBytes, randomInt, createHmac, timingSafeEqual } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { inTransaction } from "../lib/transaction.js";
import { ApiError } from "../utils/http.js";

export type EmailPurpose = "REGISTER" | "RESET";
export const CODE_TTL_MS = 10 * 60_000;
export const RESET_TTL_MS = 30 * 60_000;
export const MAX_CODE_ATTEMPTS = 5;

export function hashEmailSecret(email: string, purpose: string, secret: string) {
  return createHmac("sha256", env.jwtSecret).update(JSON.stringify([email, purpose, secret])).digest("hex");
}

export function matchesEmailSecret(expected: string, email: string, purpose: string, secret: string) {
  const actual = hashEmailSecret(email, purpose, secret);
  return expected.length === actual.length && timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
}

export function assertEmailConfigured() {
  if (!env.resendApiKey || !env.emailFrom) throw new ApiError(503, "AUTH_EMAIL_UNAVAILABLE");
  const url = new URL(env.frontendUrl);
  if (env.isProduction && url.protocol !== "https:") throw new ApiError(503, "AUTH_EMAIL_UNAVAILABLE");
}

// Stored in PostgreSQL so limits also hold across serverless instances.
export async function takeAuthLimit(scope: string, identity: string, maximum: number, durationMs: number) {
  const now = Date.now();
  const bucket = Math.floor(now / durationMs);
  const key = hashEmailSecret(identity, scope, String(bucket));
  const row = await prisma.authRateLimit.upsert({
    where: { key },
    create: { key, count: 1, expiresAt: new Date((bucket + 1) * durationMs) },
    update: { count: { increment: 1 } },
  });
  if (row.count > maximum) throw new ApiError(429, "AUTH_TOO_MANY_REQUESTS");
  if (scope === "auth-ip" && row.count === 1) {
    const cutoff = new Date(now - 24 * 60 * 60_000);
    await Promise.all([
      prisma.authRateLimit.deleteMany({ where: { expiresAt: { lt: cutoff } } }),
      prisma.emailChallenge.deleteMany({ where: { expiresAt: { lt: cutoff } } }),
    ]);
  }
}

const mailText = {
  es: {
    verifySubject: "Confirma tu correo — Fantasy Futsal",
    verify: "Tu código de confirmación es: {{secret}}. Caduca en 10 minutos.",
    resetSubject: "Restablecer contraseña — Fantasy Futsal",
    reset: "Para elegir una nueva contraseña, abre este enlace (válido durante 30 minutos):\n{{secret}}",
    ignore: "Si no lo has solicitado, ignora este mensaje. No compartas el código ni el enlace.",
  },
  uk: {
    verifySubject: "Підтвердіть пошту — Fantasy Futsal",
    verify: "Ваш код підтвердження: {{secret}}. Він діє 10 хвилин.",
    resetSubject: "Відновлення пароля — Fantasy Futsal",
    reset: "Щоб установити новий пароль, відкрийте посилання (діє 30 хвилин):\n{{secret}}",
    ignore: "Якщо ви цього не запитували, проігноруйте лист. Нікому не повідомляйте код або посилання.",
  },
  en: {
    verifySubject: "Verify your email — Fantasy Futsal",
    verify: "Your verification code is: {{secret}}. It expires in 10 minutes.",
    resetSubject: "Reset your password — Fantasy Futsal",
    reset: "To choose a new password, open this link (valid for 30 minutes):\n{{secret}}",
    ignore: "If you did not request this, ignore this message. Do not share the code or link.",
  },
};

export async function sendAuthEmail(email: string, purpose: EmailPurpose, secret: string, language?: string) {
  assertEmailConfigured();
  const copy = mailText[language?.startsWith("uk") ? "uk" : language?.startsWith("en") ? "en" : "es"];
  const url = new URL("/reset-password", env.frontendUrl);
  // A fragment avoids placing the reset credential in HTTP access logs/referrers.
  url.hash = new URLSearchParams({ email, token: secret }).toString();
  const text = (purpose === "REGISTER" ? copy.verify : copy.reset)
    .replace("{{secret}}", purpose === "REGISTER" ? secret : url.toString()) + "\n\n" + copy.ignore;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.emailFrom, to: [email], subject: purpose === "REGISTER" ? copy.verifySubject : copy.resetSubject, text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error("Email delivery rejected");
  } catch {
    // Never log credentials, email bodies or provider responses.
    throw new ApiError(503, "AUTH_EMAIL_UNAVAILABLE");
  }
}

export async function createEmailChallenge(input: {
  email: string; purpose: EmailPurpose; name?: string; passwordHash?: string;
  userId?: string; sessionVersion?: number;
}) {
  const secret = input.purpose === "REGISTER" ? String(randomInt(0, 1_000_000)).padStart(6, "0") : randomBytes(32).toString("hex");
  const now = new Date();
  const challenge = await inTransaction(async tx => {
    const previous = await tx.emailChallenge.findUnique({ where: { email_purpose: { email: input.email, purpose: input.purpose } } });
    // Enforce a rolling one-minute resend delay, independent of fixed rate buckets.
    const ttl = input.purpose === "REGISTER" ? CODE_TTL_MS : RESET_TTL_MS;
    if (previous && previous.expiresAt.getTime() - ttl + 60_000 > now.getTime()) throw new ApiError(429, "AUTH_TOO_MANY_REQUESTS");
    const data = {
      ...input, secretHash: hashEmailSecret(input.email, input.purpose, secret),
      expiresAt: new Date(now.getTime() + ttl), attempts: 0, consumedAt: null,
    };
    return tx.emailChallenge.upsert({
      where: { email_purpose: { email: input.email, purpose: input.purpose } },
      create: data, update: data,
    });
  });
  return { challenge, secret };
}

// Return a failed validation instead of throwing: failed attempts must commit.
export async function consumeEmailChallenge(tx: Prisma.TransactionClient, email: string, purpose: EmailPurpose, secret: string) {
  const row = await tx.emailChallenge.findUnique({ where: { email_purpose: { email, purpose } } });
  if (!row || row.consumedAt || row.expiresAt.getTime() <= Date.now() || row.attempts >= MAX_CODE_ATTEMPTS) return null;
  if (!matchesEmailSecret(row.secretHash, email, purpose, secret)) {
    await tx.emailChallenge.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
    return null;
  }
  await tx.emailChallenge.update({ where: { id: row.id }, data: { consumedAt: new Date(), passwordHash: null, name: null } });
  return row;
}
