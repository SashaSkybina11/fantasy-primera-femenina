import { del, put } from "@vercel/blob";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { existsSync, unlinkSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { basename, join } from "node:path";
import { Router } from "express";
import jwt from "jsonwebtoken";
import multer from "multer";
import { z } from "zod";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { inTransaction } from "../lib/transaction.js";
import { uploadsDirectory } from "../config/paths.js";
import { authenticate } from "../middleware/auth.js";
import { asyncRoute, ApiError } from "../utils/http.js";

const imageExtensions: Record<string, string> = {
  "image/avif": ".avif",
  "image/gif": ".gif",
  "image/heic": ".heic",
  "image/heif": ".heif",
  "image/jpg": ".jpg",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};
const imageMimeTypesByExtension: Record<string, string> = Object.fromEntries(Object.entries(imageExtensions).map(([mimeType, extension]) => [extension, mimeType === "image/jpg" ? "image/jpeg" : mimeType]));
const maxAvatarSize = 4 * 1024 * 1024;

function imageMetadata(file: Pick<Express.Multer.File, "mimetype" | "originalname">) {
  if (imageExtensions[file.mimetype]) return { contentType: file.mimetype === "image/jpg" ? "image/jpeg" : file.mimetype, extension: imageExtensions[file.mimetype] };
  const extension = file.originalname.match(/(\.[a-z0-9]+)$/i)?.[1]?.toLowerCase();
  const contentType = extension ? imageMimeTypesByExtension[extension] : undefined;
  return contentType && extension ? { contentType, extension } : null;
}
const localStorage = multer.diskStorage({
  destination: uploadsDirectory,
  filename: (_request, file, callback) => callback(null, `${randomUUID()}${imageExtensions[file.mimetype]}`),
});
const upload = multer({
  // Serverless files disappear after a function invocation. Production uploads
  // are buffered and written to Vercel Blob below; local development retains its
  // current disk-based workflow.
  storage: env.isProduction ? multer.memoryStorage() : localStorage,
  limits: { fileSize: maxAvatarSize },
  fileFilter: (_request, file, callback) => {
    const metadata = imageMetadata(file);
    if (!metadata) return callback(new ApiError(400, "Поддерживаются изображения JPEG, PNG, WebP, HEIC, HEIF, GIF или AVIF"));
    file.mimetype = metadata.contentType;
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
  avatarUrl: z.string().url().optional(),
});
const favoriteClubSchema = z.object({ clubId: z.string().cuid().nullable() });

function serialize(user: { id: string; email: string; name: string; avatarUrl: string | null; favoriteClub: { id: string; name: string; logoUrl: string | null } | null; fantasyTeam: { id: string; name: string; budget: number } | null }) {
  return { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl, favoriteClub: user.favoriteClub, fantasyTeam: user.fantasyTeam };
}

function removeLocalAvatar(avatarUrl: string | null) {
  if (!avatarUrl?.startsWith("/uploads/")) return;
  const file = join(uploadsDirectory, basename(avatarUrl));
  try {
    if (existsSync(file)) unlinkSync(file);
  } catch (error) {
    console.warn("Не удалось удалить локальный аватар", error);
  }
}

function isVercelBlobUrl(avatarUrl: string) {
  try {
    return new URL(avatarUrl).hostname.endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}

async function removeAvatar(avatarUrl: string | null) {
  if (!avatarUrl) return;
  if (avatarUrl.startsWith("/uploads/")) {
    removeLocalAvatar(avatarUrl);
    return;
  }
  if (env.blobReadWriteToken && isVercelBlobUrl(avatarUrl)) {
    try {
      await del(avatarUrl, { token: env.blobReadWriteToken });
    } catch (error) {
      console.warn("Не удалось удалить аватар из Vercel Blob", error);
    }
  }
}

async function storeAvatar(file: Express.Multer.File) {
  if (!env.isProduction) return `/uploads/${file.filename}`;
  if (!env.blobReadWriteToken) {
    throw new ApiError(503, "Для загрузки аватаров в production настройте BLOB_READ_WRITE_TOKEN");
  }
  const metadata = imageMetadata(file);
  if (!metadata) throw new ApiError(400, "Неподдерживаемый формат изображения");
  const blob = await put(`avatars/${randomUUID()}${metadata.extension}`, file.buffer, {
    access: "public",
    addRandomSuffix: false,
    contentType: metadata.contentType,
    token: env.blobReadWriteToken,
  });
  return blob.url;
}

function userIdFromUploadToken(token: string) {
  const payload = jwt.verify(token, env.jwtSecret);
  if (typeof payload !== "object" || !payload.sub) throw new ApiError(401, "Сессия истекла. Войдите снова.");
  return String(payload.sub);
}

router.post("/avatar-upload", asyncRoute(async (request, response) => {
  try {
    if (!env.blobReadWriteToken) throw new ApiError(503, "Для загрузки аватаров в production настройте BLOB_READ_WRITE_TOKEN");
    const result = await handleUpload({
      body: request.body as HandleUploadBody,
      request,
      token: env.blobReadWriteToken,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (!pathname.startsWith("avatars/")) throw new ApiError(400, "Некорректный путь загрузки");
        const userId = userIdFromUploadToken(clientPayload ?? "");
        return {
          allowedContentTypes: Object.keys(imageExtensions).filter((mimeType) => mimeType !== "image/jpg"),
          addRandomSuffix: true,
          maximumSizeInBytes: 12 * 1024 * 1024,
          tokenPayload: JSON.stringify({ userId }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        if (!tokenPayload) throw new ApiError(400, "Не удалось определить владельца аватара");
        const { userId } = z.object({ userId: z.string().cuid() }).parse(JSON.parse(tokenPayload));
        const current = await prisma.user.findUnique({ where: { id: userId }, select: { avatarUrl: true } });
        await prisma.user.update({ where: { id: userId }, data: { avatarUrl: blob.url } });
        if (current?.avatarUrl && current.avatarUrl !== blob.url) await removeAvatar(current.avatarUrl);
      },
    });
    response.status(200).json(result);
  } catch (error) {
    console.error(error);
    throw error;
  }
}));

router.get("/", authenticate, asyncRoute(async (request, response) => {
  const user = await prisma.user.findUnique({
    where: { id: request.auth!.userId },
    include: { favoriteClub: true, fantasyTeam: { select: { id: true, name: true, budget: true } } },
  });
  if (!user) throw new ApiError(404, "Профиль не найден");
  response.json(serialize(user));
}));

router.patch("/", authenticate, upload.single("avatar"), asyncRoute(async (request, response) => {
  let uploadedAvatarUrl: string | null = null;
  try {
    const input = profileSchema.parse(request.body);
    if (input.avatarUrl && !isVercelBlobUrl(input.avatarUrl)) throw new ApiError(400, "Некорректный URL аватара");
    if (input.name === undefined && input.teamName === undefined && input.avatarUrl === undefined && !request.file && input.removeAvatar !== true) {
      throw new ApiError(400, "Нет изменений для сохранения");
    }
    uploadedAvatarUrl = request.file ? await storeAvatar(request.file) : input.avatarUrl ?? null;

    const result = await inTransaction(async (tx) => {
      const current = await tx.user.findUnique({
        where: { id: request.auth!.userId },
        include: { favoriteClub: true, fantasyTeam: true },
      });
      if (!current?.fantasyTeam) throw new ApiError(404, "Профиль не найден");

      const avatarUrl = uploadedAvatarUrl ?? (input.removeAvatar ? null : undefined);
      if (input.teamName !== undefined) {
        await tx.fantasyTeam.update({ where: { id: current.fantasyTeam.id }, data: { name: input.teamName } });
      }
      const user = await tx.user.update({
        where: { id: current.id },
        data: { ...(input.name !== undefined ? { name: input.name } : {}), ...(avatarUrl !== undefined ? { avatarUrl } : {}) },
        include: { favoriteClub: true, fantasyTeam: { select: { id: true, name: true, budget: true } } },
      });
      return { user, previousAvatarUrl: current.avatarUrl, avatarChanged: avatarUrl !== undefined && avatarUrl !== current.avatarUrl };
    });

    if (result.avatarChanged) await removeAvatar(result.previousAvatarUrl);
    response.json(serialize(result.user));
  } catch (error) {
    if (uploadedAvatarUrl) await removeAvatar(uploadedAvatarUrl);
    else if (request.file && !env.isProduction) removeLocalAvatar(`/uploads/${request.file.filename}`);
    throw error;
  }
}));

router.patch("/favorite-club", authenticate, asyncRoute(async (request, response) => {
  const { clubId } = favoriteClubSchema.parse(request.body);
  if (clubId && !(await prisma.club.findUnique({ where: { id: clubId }, select: { id: true } }))) {
    throw new ApiError(404, "Клуб не найден");
  }
  const user = await prisma.user.update({
    where: { id: request.auth!.userId },
    data: { favoriteClubId: clubId },
    include: { favoriteClub: true, fantasyTeam: { select: { id: true, name: true, budget: true } } },
  });
  response.json(serialize(user));
}));

export default router;
