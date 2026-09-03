import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import multer from "multer";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function asyncRoute(
  handler: (request: Request, response: Response, next: NextFunction) => Promise<unknown>,
) {
  return (request: Request, response: Response, next: NextFunction) => {
    void handler(request, response, next).catch(next);
  };
}

export function errorHandler(
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction,
) {
  if (error instanceof multer.MulterError) {
    console.error(error);
    if (error.code === "LIMIT_FILE_SIZE") return response.status(413).json({ message: "Размер изображения не должен превышать 4 МБ" });
    return response.status(400).json({ message: error.message });
  }
  if (error instanceof ApiError) {
    return response.status(error.status).json({ message: error.message });
  }
  if (error instanceof ZodError) {
    return response.status(400).json({
      message: error.issues[0]?.message ?? "Некорректные данные",
      issues: error.flatten(),
    });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return response.status(409).json({ message: "Такая запись уже существует" });
  }
  console.error(error);
  return response.status(500).json({ message: "Внутренняя ошибка сервера" });
}
