import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/http.js";

export async function authenticate(request: Request, _response: Response, next: NextFunction) {
  const token = request.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return next(new ApiError(401, "Требуется авторизация"));

  let payload: string | jwt.JwtPayload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
    if (typeof payload !== "object" || !payload.sub) {
      return next(new ApiError(401, "Недействительный токен"));
    }
  } catch {
    return next(new ApiError(401, "Сессия истекла. Войдите снова."));
  }
  try {
    const user = await prisma.user.findUnique({ where: { id: String(payload.sub) }, select: { sessionVersion: true } });
    if (!user || (payload.sessionVersion ?? 0) !== user.sessionVersion) return next(new ApiError(401, "Сессия истекла. Войдите снова."));
    request.auth = { userId: String(payload.sub) };
    return next();
  } catch (error) {
    return next(error);
  }
}

export async function requireAdmin(request: Request, _response: Response, next: NextFunction) {
  if (!request.auth?.userId) return next(new ApiError(401, "Требуется авторизация"));
  try {
    const user = await prisma.user.findUnique({
      where: { id: request.auth.userId },
      select: { role: true },
    });
    if (user?.role !== "ADMIN") return next(new ApiError(403, "Недостаточно прав администратора"));
    return next();
  } catch (error) {
    return next(error);
  }
}
