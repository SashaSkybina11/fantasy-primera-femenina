import "dotenv/config";

function required(name: string, fallback?: string) {
  const value = process.env[name] ?? fallback;
  if (!value)
    throw new Error(`Не задана обязательная переменная окружения ${name}`);
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET"),
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:5173",
  isProduction:
    process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL),
  blobReadWriteToken: process.env.AVATAR_BLOB_READ_WRITE_TOKEN ?? process.env.BLOB_READ_WRITE_TOKEN,
};
