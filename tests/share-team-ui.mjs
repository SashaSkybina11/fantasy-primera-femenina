import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "vite";
import { chromium } from "playwright";

const club = { id: "club", name: "Club de prueba", logoUrl: null, coach: null, president: null };
const players = Array.from({ length: 10 }, (_, index) => ({
  id: `entry-${index}`, playerId: `player-${index}`, status: index < 5 ? "STARTER" : "BENCH",
  fieldSlot: index > 0 && index < 5 ? index - 1 : null, isCaptain: index === 1,
  player: { id: `player-${index}`, name: index === 1 ? "María Nombre Largo Apellido" : `Jugadora ${index}`, number: index + 1,
    displayNumber: String(index + 1), position: index === 0 || index === 5 ? "GOALKEEPER" : "FIELD_PLAYER",
    role: index === 0 || index === 5 ? "PORTERA" : "ALA", price: 3000, age: 24, nationality: "ES", photoUrl: null, club },
}));
const team = { id: "team", name: "Equipo de prueba", budget: 18000, players };
const server = await createServer({ root: "frontend", configFile: false, server: { host: "127.0.0.1", port: 5176 }, esbuild: { jsx: "automatic" } });
await server.listen();
const localChrome = [process.env.CHROME_PATH, "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"].find(path => path && existsSync(path));
const browser = await chromium.launch(localChrome ? { executablePath: localChrome } : {});
try {
  const page = await browser.newPage({ acceptDownloads: true });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => { localStorage.setItem("fantasy-futsal-token", "fixture"); localStorage.setItem("fantasy-locale", "uk"); });
  await page.route("**/api/**", route => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, "");
    const payload = path === "/auth/me" ? { user: { id: "user", name: "Test", role: "USER", avatarUrl: null } }
      : path === "/my-team" ? team
      : path === "/my-team/transfers" ? { marketIsOpen: true, bought: 0, sold: 0, limit: 2 }
      : [];
    return route.fulfill({ json: payload });
  });

  await page.goto("http://127.0.0.1:5176/my-team");
  await page.getByRole("button", { name: /Поділитися командою/ }).click();
  const canvas = page.locator(".share-team-card canvas");
  await canvas.waitFor();
  const downloadButton = page.getByRole("button", { name: "Завантажити зображення" });
  await downloadButton.waitFor({ state: "visible" });
  await page.waitForFunction(() => document.querySelector(".share-team-actions button")?.disabled === false);
  assert.deepEqual(await canvas.evaluate(node => [node.width, node.height]), [1080, 1920]);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    downloadButton.click(),
  ]);
  assert.equal(download.suggestedFilename(), "fantasy-mi-equipo.png");
  const filePath = await download.path();
  assert.ok(filePath);
  const png = await readFile(filePath);
  assert.equal(png.toString("hex", 0, 8), "89504e470d0a1a0a");
  assert.equal(png.readUInt32BE(16), 1080);
  assert.equal(png.readUInt32BE(20), 1920);

  await page.goto("http://127.0.0.1:5176/");
  await page.getByRole("button", { name: /Поділитися командою/ }).waitFor();
  assert.deepEqual(errors, []);
  console.log("PASS: share buttons on both pages; Ukrainian poster download is a 1080×1920 PNG.");
} finally {
  await browser.close();
  await server.close();
}
