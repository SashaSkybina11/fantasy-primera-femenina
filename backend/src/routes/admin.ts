import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import { asyncRoute, ApiError } from "../utils/http.js";

const router = Router();

router.use(authenticate, requireAdmin);

router.get("/users", asyncRoute(async (_request, response) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      fantasyTeam: { select: { _count: { select: { players: true } } } },
    },
  });
  response.json(users.map(({ fantasyTeam, ...user }) => ({ ...user, playerCount: fantasyTeam?._count.players ?? 0 })));
}));

router.delete("/users/:id", asyncRoute(async (request, response) => {
  const id = z.string().cuid().parse(request.params.id);
  if (id === request.auth!.userId) throw new ApiError(400, "Нельзя удалить собственный аккаунт администратора");
  const result = await prisma.user.deleteMany({ where: { id } });
  if (!result.count) throw new ApiError(404, "Пользователь не найден");
  response.status(204).send();
}));

export default router;
