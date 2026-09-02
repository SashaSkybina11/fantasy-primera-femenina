import { existsSync, unlinkSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { basename, join } from "node:path";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { inTransaction } from "../lib/transaction.js";
import { uploadsDirectory } from "../config/paths.js";
import { authenticate } from "../middleware/auth.js";
import { asyncRoute, ApiError } from "../utils/http.js";

const imageExtensions: Record<string, string> = {
  "image/avif": ".avif",
  "image/gif": ".gif",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDirectory,
    filename: (_request, file, callback) => callback(null, `${randomUUID()}${imageExtensions[file.mimetype]}`),
  }),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => {
    if (!imageExtensions[file.mimetype]) return callback(new ApiError(400, "Поддерживаются изображения JPEG, PNG, WebP, GIF или AVIF"));
    callback(null, true);
  },
});
const router = Router();
const profileSchema = z.object({
  name: z.string().trim().min(2, "Введите имя").max(50).optional(),
  teamName: z.string().trim().min(2, "Введите название команды").max(60).optional(),
  removeAvatar: z.preprocess(
    (value) => value === "true" || value === true ? true : value === "false" || value === false || value === "" ? false : value,
    z.boolean().optional(),
  ),
});

function serialize(user: { id: string; email: string; name: string; avatarUrl: string | null; fantasyTeam: { id: string; name: string; budget: number } | null }) {
  return { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl, fantasyTeam: user.fantasyTeam };
}

function removeLocalAvatar(avatarUrl: string | null) {
  if (!avatarUrl?.startsWith("/uploads/")) return;
  const file = join(uploadsDirectory, basename(avatarUrl));
  try {
    if (existsSync(file)) unlinkSync(file);
  } catch (error) {
    console.warn("Не удалось удалить старый аватар", error);
  }
}

function removeUploadedAvatar(file: Express.Multer.File | undefined) {
  if (!file) return;
  try {
    if (existsSync(file.path)) unlinkSync(file.path);
  } catch (error) {
    console.warn("Не удалось удалить загруженный аватар", error);
  }
}

router.get("/", authenticate, asyncRoute(async (request, response) => {
  const user = await prisma.user.findUnique({
    where: { id: request.auth!.userId },
    include: { fantasyTeam: { select: { id: true, name: true, budget: true } } },
  });
  if (!user) throw new ApiError(404, "Профиль не найден");
  response.json(serialize(user));
}));

router.patch("/", authenticate, upload.single("avatar"), asyncRoute(async (request, response) => {
  try {
    const input = profileSchema.parse(request.body);
    if (input.name === undefined && input.teamName === undefined && !request.file && input.removeAvatar !== true) {
      throw new ApiError(400, "Нет изменений для сохранения");
    }

    const result = await inTransaction(async (tx) => {
      const current = await tx.user.findUnique({
        where: { id: request.auth!.userId },
        include: { fantasyTeam: true },
      });
      if (!current?.fantasyTeam) throw new ApiError(404, "Профиль не найден");

      const avatarUrl = request.file ? `/uploads/${request.file.filename}` : input.removeAvatar ? null : undefined;
      if (input.teamName !== undefined) {
        await tx.fantasyTeam.update({ where: { id: current.fantasyTeam.id }, data: { name: input.teamName } });
      }
      const user = await tx.user.update({
        where: { id: current.id },
        data: { ...(input.name !== undefined ? { name: input.name } : {}), ...(avatarUrl !== undefined ? { avatarUrl } : {}) },
        include: { fantasyTeam: { select: { id: true, name: true, budget: true } } },
      });
      return { user, previousAvatarUrl: current.avatarUrl, avatarChanged: avatarUrl !== undefined };
    });

    if (result.avatarChanged) removeLocalAvatar(result.previousAvatarUrl);
    response.json(serialize(result.user));
  } catch (error) {
    removeUploadedAvatar(request.file);
    throw error;
  }
}));

export default router;
