import { del, get, put } from "@vercel/blob";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { basename, extname, join } from "node:path";
import { Readable } from "node:stream";
import multer from "multer";
import { env } from "../config/env.js";
import { supportUploadsDirectory } from "../config/paths.js";
import { ApiError } from "../utils/http.js";

const allowedTypes: Record<string, string> = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif", ".avif": "image/avif", ".heic": "image/heic", ".heif": "image/heif",
  ".pdf": "application/pdf", ".txt": "text/plain", ".csv": "text/csv", ".doc": "application/msword", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".xls": "application/vnd.ms-excel", ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".odt": "application/vnd.oasis.opendocument.text", ".ods": "application/vnd.oasis.opendocument.spreadsheet",
};
const allowedImageTypes = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "image/heic", "image/heif",
]);
const imageExtensionByType: Record<string, string> = {
  "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif",
  "image/avif": ".avif", "image/heic": ".heic", "image/heif": ".heif",
};
const maxFileSize = 10 * 1024 * 1024;
export const supportUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: maxFileSize, files: 5 }, fileFilter: (_request, file, callback) => {
  const extension = extname(basename(file.originalname)).toLowerCase();
  if (!allowedTypes[extension] && !allowedImageTypes.has(file.mimetype.toLowerCase())) return callback(new ApiError(400, "Unsupported support attachment format"));
  callback(null, true);
} });

export function safeSupportFileName(name: string) {
  const leaf = basename(name).replace(/[\u0000-\u001f\u007f]/g, "").replace(/[\\/]/g, "_").trim();
  return (leaf || "file").slice(-160);
}

export async function storeSupportFile(file: Express.Multer.File, conversationId: string) {
  const fileName = safeSupportFileName(file.originalname);
  const extension = extname(fileName).toLowerCase();
  const mimeType = file.mimetype.toLowerCase();
  const contentType = allowedTypes[extension] ?? (allowedImageTypes.has(mimeType) ? mimeType : undefined);
  if (!contentType) throw new ApiError(400, "Unsupported support attachment format");
  const storageExtension = extension || imageExtensionByType[contentType] || "";
  const storageKey = `support/${conversationId}/${randomUUID()}${storageExtension}`;
  if (env.isProduction) {
    if (!env.supportBlobReadWriteToken) throw new ApiError(503, "Configure SUPPORT_BLOB_READ_WRITE_TOKEN for support attachments");
    await put(storageKey, file.buffer, { access: "private", addRandomSuffix: false, contentType, token: env.supportBlobReadWriteToken });
  } else {
    await mkdir(supportUploadsDirectory, { recursive: true });
    await writeFile(join(supportUploadsDirectory, storageKey.replaceAll("/", "_")), file.buffer, { flag: "wx" });
  }
  return { storageKey, fileName, contentType, size: file.size };
}

export async function deleteSupportFile(storageKey: string) {
  try {
    if (storageKey.startsWith("support/")) {
      if (env.isProduction && env.supportBlobReadWriteToken) await del(storageKey, { token: env.supportBlobReadWriteToken });
      else await unlink(join(supportUploadsDirectory, storageKey.replaceAll("/", "_")));
    }
  } catch (error) { console.warn("Could not delete support attachment", error); }
}

export async function sendSupportFile(storageKey: string, response: import("express").Response) {
  if (!storageKey.startsWith("support/")) throw new ApiError(404, "Support attachment not found");
  if (env.isProduction) {
    if (!env.supportBlobReadWriteToken) throw new ApiError(503, "Configure SUPPORT_BLOB_READ_WRITE_TOKEN for support attachments");
    const blob = await get(storageKey, { access: "private", token: env.supportBlobReadWriteToken });
    if (!blob) throw new ApiError(404, "Support attachment not found");
    return Readable.fromWeb(blob.stream as import("node:stream/web").ReadableStream).pipe(response);
  }
  const file = join(supportUploadsDirectory, storageKey.replaceAll("/", "_"));
  response.end(await readFile(file));
}
