import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import multer from "multer";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: "UNSUPPORTED_IMAGE_FORMAT") {
    super(message);
  }
}

function localMessage(request: Request, spanish: string, ukrainian: string) {
  return request.header("accept-language")?.toLowerCase().startsWith("uk") ? ukrainian : spanish;
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
  request: Request,
  response: Response,
  _next: NextFunction,
) {
  if (error instanceof multer.MulterError) {
    console.error(error);
    if (error.code === "LIMIT_FILE_SIZE") {
      return response.status(400).json({ message: localMessage(request, "El tamaño de la imagen no debe superar los 10 MB", "Розмір зображення не повинен перевищувати 10 МБ") });
    }
    return response.status(400).json({ message: localMessage(request, "No se pudo procesar el archivo", "Не вдалося обробити файл") });
  }
  if (error instanceof ApiError) {
    if (error.code === "UNSUPPORTED_IMAGE_FORMAT") {
      return response.status(400).json({ message: localMessage(request, "Formato no compatible. Usa JPEG, PNG, WebP, AVIF, GIF, HEIC o HEIF", "Непідтримуваний формат. Використовуйте JPEG, PNG, WebP, AVIF, GIF, HEIC або HEIF") });
    }
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

