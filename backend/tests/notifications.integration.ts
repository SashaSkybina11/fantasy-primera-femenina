import "dotenv/config";
import assert from "node:assert/strict";
import { once } from "node:events";
import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";

const databaseUrl = new URL(process.env.DATABASE_URL!);
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(databaseUrl.hostname), "Notification integration tests require local PostgreSQL");
const setup = new PrismaClient();
const database = `notifications_test_${Date.now()}`;
await setup.$executeRawUnsafe(`CREATE DATABASE "${database}"`);
databaseUrl.pathname = `/${database}`;
process.env.DATABASE_URL = databaseUrl.toString();
process.env.DIRECT_URL = databaseUrl.toString();
const migration = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy", "--schema", "backend/prisma/schema.prisma"], { env: process.env, encoding: "utf8" });
assert.equal(migration.status, 0, migration.stderr);
const { app } = await import("../src/app.js");
const { prisma } = await import("../src/lib/prisma.js");
const server = app.listen(0, "127.0.0.1");
await once(server, "listening");
const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`;
const users = await Promise.all([0, 1, 2].map(index => prisma.user.create({ data: { name: `Notice ${index}`, email: `notice${index}@example.invalid`, passwordHash: "unused", ...(index === 0 ? { role: "ADMIN" as const } : {}) } })));
const club = await prisma.club.create({ data: { name: "Notification test club" } });
const players = await Promise.all(Array.from({ length: 10 }, (_, index) => prisma.player.create({ data: { clubId: club.id, name: `Test player ${index}`, number: index + 1, position: index < 2 ? "GOALKEEPER" : "FIELD_PLAYER", role: index < 2 ? "PORTERA" : "ALA", price: 1000 } })));
const completeTeam = await prisma.fantasyTeam.create({ data: { userId: users[2]!.id, name: "Complete roster", players: { create: players.map((player, index) => ({ playerId: player.id, status: index === 0 || (index >= 2 && index < 6) ? "STARTER" : "BENCH", isCaptain: index === 2 })) } } });
assert.ok(completeTeam.id);
const tokens = users.map(user => jwt.sign({ sub: user.id }, process.env.JWT_SECRET!));
async function api(path: string, user: number, method = "GET", body?: unknown, language = "en") {
  const response = await fetch(origin + path, { method, headers: { Authorization: `Bearer ${tokens[user]}`, "Accept-Language": language, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const data = response.status === 204 ? null : await response.json();
  return { response, data };
}
try {
  const unauthorizedSend = await api("/admin/notifications/send", 1, "POST", { type: "GENERAL_ANNOUNCEMENT", audience: "ALL" });
  assert.equal(unauthorizedSend.response.status, 403);
  const localizedContents = {
    es: { title: "Aviso", message: "Hola", action: "Abrir", url: "/notifications" },
    uk: { title: "Оголошення", message: "Вітаю", action: "Відкрити", url: "/notifications" },
    en: { title: "Notice", message: "Hello", action: "Open", url: "/notifications" },
    pt: { title: "Aviso", message: "Olá", action: "Abrir", url: "/notifications" },
  };
  const allSent = await api("/admin/notifications/send", 0, "POST", { type: "GENERAL_ANNOUNCEMENT", audience: "ALL", contents: localizedContents });
  assert.equal(allSent.response.status, 201);
  const userUk = await api("/notifications", 1, "GET", undefined, "uk");
  const userEn = await api("/notifications", 2, "GET", undefined, "en");
  assert.equal(userUk.data.items[0].title, "Оголошення");
  assert.equal(userUk.data.items[0].message, "Вітаю");
  assert.equal(userEn.data.items[0].message, "Hello");
  assert.equal(userUk.data.unreadCount, 1);
  const markRead = await api(`/notifications/${userUk.data.items[0].id}/read`, 1, "POST");
  assert.equal(markRead.response.status, 200);
  const readAcrossSessions = await api("/notifications/unread-count", 1);
  assert.equal(readAcrossSessions.data.unreadCount, 0);
  assert.equal((await api("/notifications/unread-count", 2)).data.unreadCount, 1);

  const incompletePreview = await api("/admin/notifications/preview", 0, "POST", { audience: "INCOMPLETE_TEAM" });
  assert.equal(incompletePreview.data.count, 1);
  const incompleteSend = await api("/admin/notifications/send", 0, "POST", { type: "INCOMPLETE_TEAM", audience: "INCOMPLETE_TEAM", contents: localizedContents });
  assert.equal(incompleteSend.response.status, 201);
  assert.equal((await api("/notifications", 1, "GET", undefined, "en")).data.items.filter((item: { id: string }) => item.id === incompleteSend.data.id).length, 1);
  assert.equal((await api("/notifications", 2, "GET", undefined, "en")).data.items.filter((item: { id: string }) => item.id === incompleteSend.data.id).length, 0);

  const captainPreview = await api("/admin/notifications/preview", 0, "POST", { audience: "CAPTAIN_MISSING" });
  assert.equal(captainPreview.data.count, 1);
  assert.ok(players.length === 10);

  const privateSend = await api("/admin/notifications/send", 0, "POST", { type: "GENERAL_ANNOUNCEMENT", audience: "USERS", userIds: [users[1]!.id], contents: localizedContents });
  assert.equal(privateSend.response.status, 201);
  const outsiderRead = await api(`/notifications/${privateSend.data.id}/read`, 2, "POST");
  assert.equal(outsiderRead.response.status, 404);
  const history = await api("/admin/notifications/history", 0);
  assert.equal(history.response.status, 200);
  assert.equal(history.data.length, 3);
  assert.ok(history.data.some((entry: { recipientCount: number }) => entry.recipientCount === 2));
  console.log("PASS: admin authorization, recipient targeting, per-user read persistence, language selection, and send history");
} finally {
  server.close();
  await prisma.$disconnect();
  await setup.$executeRawUnsafe(`DROP DATABASE "${database}" WITH (FORCE)`);
  await setup.$disconnect();
}
