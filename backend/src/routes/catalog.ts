import { PlayerPosition } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { asyncRoute, ApiError } from "../utils/http.js";
import { withDisplayNumbers } from "../utils/players.js";

const router = Router();

router.get("/clubs", asyncRoute(async (_request, response) => {
  response.json(await prisma.club.findMany({ orderBy: { name: "asc" } }));
}));

router.get("/clubs/:id", asyncRoute(async (request, response) => {
  const id = z.string().cuid().parse(request.params.id);
  const club = await prisma.club.findUnique({ where: { id } });
  if (!club) throw new ApiError(404, "Команда не найдена");
  response.json(club);
}));

router.get("/clubs/:id/players", asyncRoute(async (request, response) => {
  const id = z.string().cuid().parse(request.params.id);
  const club = await prisma.club.findUnique({ where: { id } });
  if (!club) throw new ApiError(404, "Команда не найдена");
  const players = await prisma.player.findMany({ where: { clubId: club.id }, orderBy: [{ role: "asc" }, { number: "asc" }] });
  response.json(withDisplayNumbers(players));
}));

router.get("/players", asyncRoute(async (request, response) => {
  const query = z.object({
    clubId: z.string().cuid().optional(),
    position: z.nativeEnum(PlayerPosition).optional(),
    role: z.enum(["PORTERA", "CIERRE", "ALA", "PIVOT"]).optional(),
    search: z.string().trim().max(80).optional(),
  }).parse(request.query);

  if (query.clubId && !(await prisma.club.findUnique({ where: { id: query.clubId }, select: { id: true } }))) {
    throw new ApiError(404, "Команда не найдена");
  }
  const players = await prisma.player.findMany({
    where: {
      clubId: query.clubId,
      position: query.position,
      role: query.role,
      name: query.search ? { contains: query.search, mode: "insensitive" } : undefined,
    },
    include: { club: true },
    orderBy: [{ club: { name: "asc" } }, { role: "asc" }, { number: "asc" }],
  });
  response.json(withDisplayNumbers(players));
}));

export default router;
