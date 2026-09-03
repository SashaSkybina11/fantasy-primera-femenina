import { del, put } from "@vercel/blob";
import { existsSync, unlinkSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { basename, join } from "node:path";
import { Router } from "express";
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
const imageMimeTypesByExtension: Record<string, string> = {
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};
const maxAvatarSize = 10 * 1024 * 1024;

function imageMetadata(file: Pick<Express.Multer.File, "mimetype" | "originalname">) {
  const mimeType = file.mimetype === "image/jpg" ? "image/jpeg" : file.mimetype;
  if (imageExtensions[mimeType]) return { mimeType, extension: imageExtensions[mimeType] };
  const extension = file.originalname.match(/(\.[a-z0-9]+)$/i)?.[1]?.toLowerCase();
  const detectedMimeType = extension ? imageMimeTypesByExtension[extension] : undefined;
  return detectedMimeType && extension ? { mimeType: detectedMimeType, extension } : null;
}

const localStorage = multer.diskStorage({
  destination: uploadsDirectory,
  filename: (_request, file, callback) => {
    const metadata = imageMetadata(file);
    callback(null, `${randomUUID()}${metadata?.extension ?? ".img"}`);
  },
});
const upload = multer({
  // Serverless files disappear after a function invocation. Production uploads
  // are buffered and written to Vercel Blob below; local development retains its
  // current disk-based workflow.
  storage: env.isProduction ? multer.memoryStorage() : localStorage,
  limits: { fileSize: maxAvatarSize },
  fileFilter: (_request, file, callback) => {
    const metadata = imageMetadata(file);
    if (!metadata) return callback(new ApiError(400, "Unsupported image format", "UNSUPPORTED_IMAGE_FORMAT"));
    file.mimetype = metadata.mimeType;
    callback(null, true);
  },
});
const router = Router();
const profileSchema = z.object({
  name: z.string().trim().min(2, "Введите имя").max(50).optional(),
  teamName: z
    .string()
    .trim()
    .min(2, "Введите название команды")
    .max(60)
    .optional(),
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

function serialize(user: {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  favoriteClub: { id: string; name: string; logoUrl: string | null } | null;
  fantasyTeam: { id: string; name: string; budget: number } | null;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    favoriteClub: user.favoriteClub,
    fantasyTeam: user.fantasyTeam,
  };
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
    throw new ApiError(
      503,
      "Для загрузки аватаров в production настройте BLOB_READ_WRITE_TOKEN",
    );
  }
  const metadata = imageMetadata(file);
  if (!metadata) throw new ApiError(400, "Unsupported image format", "UNSUPPORTED_IMAGE_FORMAT");
  const blob = await put(
    `avatars/${randomUUID()}${metadata.extension}`,
    file.buffer,
    {
      access: "public",
      addRandomSuffix: false,
      contentType: metadata.mimeType,
      token: env.blobReadWriteToken,
    },
  );
  return blob.url;
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
