import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Vercel's deploy filesystem is read-only. Local development retains the existing
// uploads folder, while temporary local storage is used only as a fallback there.
export const uploadsDirectory = process.env.VERCEL
  ? join(tmpdir(), "fantasy-futsal-uploads")
  : fileURLToPath(new URL("../../uploads", import.meta.url));
