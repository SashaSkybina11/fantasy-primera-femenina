import { upload, storeAvatar, removeAvatar, removeLocalAvatar } from "../services/image-upload.js";
import bcrypt from "bcrypt";
import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { inTransaction } from "../lib/transaction.js";
import { authenticate } from "../middleware/auth.js";
import { asyncRoute, ApiError } from "../utils/http.js";

const router = Router();
const profileSchema = z.object({
  name: z.string().trim().min(2, "Введите имя").max(50).optional(),
  teamName: z
    .string()
    .trim()
    .min(2, "Введите название команды")
    .max(60)
    .optional(),
  instagram: z.string().trim().max(200).optional(),
  whatsapp: z.string().trim().max(30).optional(),
  contactConsent: z.preprocess((value) => value === true || value === "true", z.boolean()).optional(),
  removeAvatar: z.preprocess(
    (value) =>
      value === "true" || value === true
        ? true
        : value === "false" || value === false || value === ""
          ? false
          : value,
    z.boolean().optional(),
  ),
});
const favoriteClubSchema = z.object({ clubId: z.string().cuid().nullable() });
const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Введите текущий пароль"),
  newPassword: z.string().min(8, "Пароль должен содержать минимум 8 символов").max(72),
});

function serialize(user: {
  id: string;
  email: string;
  name: string;
  role: "USER" | "ADMIN";
  avatarUrl: string | null;
  instagram: string | null;
  whatsapp: string | null;
  contactConsent: boolean;
  createdAt: Date;
  favoriteClub: { id: string; name: string; logoUrl: string | null } | null;
  fantasyTeam: { id: string; name: string; budget: number } | null;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    avatarUrl: user.avatarUrl,
    instagram: user.instagram,
    instagramUrl: user.instagram ? `https://instagram.com/${user.instagram}` : null,
    whatsapp: user.whatsapp,
    whatsappUrl: user.whatsapp ? `https://wa.me/${user.whatsapp.slice(1)}` : null,
    contactConsent: user.contactConsent,
    createdAt: user.createdAt,
    favoriteClub: user.favoriteClub,
    fantasyTeam: user.fantasyTeam,
  };
}

router.get(
  "/",
  authenticate,
  asyncRoute(async (request, response) => {
    const user = await prisma.user.findUnique({
      where: { id: request.auth!.userId },
      include: {
        favoriteClub: true,
        fantasyTeam: { select: { id: true, name: true, budget: true } },
      },
    });
    if (!user) throw new ApiError(404, "Профиль не найден");
    response.json(serialize(user));
  }),
);

router.patch(
  "/",
  authenticate,
  upload.single("avatar"),
  asyncRoute(async (request, response) => {
    let uploadedAvatarUrl: string | null = null;
    try {
      const input = profileSchema.parse(request.body);
      if (
        input.name === undefined &&
        input.teamName === undefined &&
        input.instagram === undefined && input.whatsapp === undefined && input.contactConsent === undefined &&
        !request.file &&
        input.removeAvatar !== true
      ) {
        throw new ApiError(400, "Нет изменений для сохранения");
      }
      uploadedAvatarUrl = request.file ? await storeAvatar(request.file) : null;

      const result = await inTransaction(async (tx) => {
        const current = await tx.user.findUnique({
          where: { id: request.auth!.userId },
          include: { favoriteClub: true, fantasyTeam: true },
        });
        if (!current?.fantasyTeam) throw new ApiError(404, "Профиль не найден");

        const avatarUrl =
          uploadedAvatarUrl ?? (input.removeAvatar ? null : undefined);
        if (input.teamName !== undefined) {
          await tx.fantasyTeam.update({
            where: { id: current.fantasyTeam.id },
            data: { name: input.teamName },
          });
        }
        const user = await tx.user.update({
          where: { id: current.id },
          data: {
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.instagram !== undefined ? { instagram: normalizeInstagram(input.instagram) } : {}),
            ...(input.whatsapp !== undefined ? { whatsapp: normalizeWhatsapp(input.whatsapp) } : {}),
            ...(input.contactConsent !== undefined ? { contactConsent: input.contactConsent } : {}),
            ...(avatarUrl !== undefined ? { avatarUrl } : {}),
          },
          include: {
            favoriteClub: true,
            fantasyTeam: { select: { id: true, name: true, budget: true } },
          },
        });
        return {
          user,
          previousAvatarUrl: current.avatarUrl,
          avatarChanged: avatarUrl !== undefined,
        };
      });

      if (result.avatarChanged) await removeAvatar(result.previousAvatarUrl);
      response.json(serialize(result.user));
    } catch (error) {
      if (uploadedAvatarUrl) await removeAvatar(uploadedAvatarUrl);
      else if (request.file && !env.isProduction)
        removeLocalAvatar(`/uploads/${request.file.filename}`);
      throw error;
    }
  }),
);

router.patch(
  "/password",
  authenticate,
  asyncRoute(async (request, response) => {
    const input = passwordSchema.parse(request.body);
    const user = await prisma.user.findUnique({ where: { id: request.auth!.userId } });
    if (!user) throw new ApiError(404, "Профиль не найден");
    if (!(await bcrypt.compare(input.currentPassword, user.passwordHash))) {
      throw new ApiError(400, "Текущий пароль указан неверно");
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(input.newPassword, 12) },
    });
    response.status(204).send();
  }),
);

router.patch(
  "/favorite-club",
  authenticate,
  asyncRoute(async (request, response) => {
    const { clubId } = favoriteClubSchema.parse(request.body);
    if (
      clubId &&
      !(await prisma.club.findUnique({
        where: { id: clubId },
        select: { id: true },
      }))
    ) {
      throw new ApiError(404, "Клуб не найден");
    }
    const user = await prisma.user.update({
      where: { id: request.auth!.userId },
      data: { favoriteClubId: clubId },
      include: {
        favoriteClub: true,
        fantasyTeam: { select: { id: true, name: true, budget: true } },
      },
    });
    response.json(serialize(user));
  }),
);

export default router;

function normalizeInstagram(value: string) {
  const normalized = value.trim().replace(/^https?:\/\/(?:www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/\?.*$/, "").replace(/\/$/, "");
  if (!normalized) return null;
  if (!/^[a-zA-Z0-9._]{1,30}$/.test(normalized)) throw new ApiError(400, "Некорректный Instagram");
  return normalized.toLowerCase();
}

function normalizeWhatsapp(value: string) {
  const digits = value.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
  if (!digits) return null;
  const normalized = digits.startsWith("+") ? digits : `+${digits}`;
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) throw new ApiError(400, "Введите WhatsApp в международном формате");
  return normalized;
}
