import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { ApiError } from "../utils/http.js";

export function authenticate(request: Request, _response: Response, next: NextFunction) {
  const token = request.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return next(new ApiError(401, "Требуется авторизация"));

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    if (typeof payload !== "object" || !payload.sub) {
      return next(new ApiError(401, "Недействительный токен"));
    }
    request.auth = { userId: String(payload.sub) };
    return next();
  } catch {
    return next(new ApiError(401, "Сессия истекла. Войдите снова."));
  }
}

