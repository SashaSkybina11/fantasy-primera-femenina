import { del, put } from "@vercel/blob";
import { existsSync, unlinkSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { basename, join } from "node:path";
import multer from "multer";
import { uploadsDirectory } from "../config/paths.js";
import { env } from "../config/env.js";
import { ApiError } from "../utils/http.js";

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
export const upload = multer({
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
export function removeLocalAvatar(avatarUrl: string | null) {
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

export async function removeAvatar(avatarUrl: string | null) {
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

export async function storeAvatar(file: Express.Multer.File) {
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

