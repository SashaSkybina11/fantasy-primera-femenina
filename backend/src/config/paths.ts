import { fileURLToPath } from "node:url";

// Works the same from src/ in development and dist/ after TypeScript compilation.
export const uploadsDirectory = fileURLToPath(new URL("../../uploads", import.meta.url));
