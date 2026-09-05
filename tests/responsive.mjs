import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

// Isolated UI fixtures; no production API or account is touched.
const out = new URL("../artifacts/responsive/", import.meta.url);
await mkdir(out, { recursive: true });
const clubs = Array.from({ length: 16 }, (_, i) => ({ id: `club${i}`, name: i === 0 ? "Melilla ClubDeNombreMuyLargoSinEspaciosTorreblanca" : `Club femenino de fútbol sala ${i}`, logoUrl: null }));
const stat = { started: false, goals: 2, yellowCards: 0, redCards: 0, goalsConceded: null, cleanSheet: false, result: "WIN", adjustmentPoints: 0, adjustmentReason: "" };
const players = Array.from({ length: 32 }, (_, i) => ({ id: `player${i}`, clubId: clubs[i % 16].id, club: clubs[i % 16], number: i % 30 + 1, name: i === 0 ? "Amandinha NombreMuyLargoSinEspaciosParaComprobarElDiseño" : `Jugadora de prueba ${i}`, position: i % 12 === 0 ? "GOALKEEPER" : "FIELD_PLAYER", role: i % 12 === 0 ? "PORTERA" : "ALA", price: 3000, lastPriceDelta: 230, lastGameweekPoints: 12, totalFantasyPoints: 12, gameweekStats: [stat] }));
const week = { id: "week1", number: 1, name: "Jornada 1", status: "COMPLETED", marketIsOpen: false, marketOpenAt: "2026-09-01T08:00:00Z", deadlineAt: "2026-09-04T10:00:00Z", endsAt: "2026-09-06T21:59:59Z", winners: [] };
const team = { id: "team", name: "Fantasy Test", budget: 20000, players: players.slice(0, 10).map((player, i) => ({ id: `entry${i}`, playerId: player.id, player, status: i < 5 ? "STARTER" : "BENCH", isCaptain: i === 0 })) };
const preview = { gameweekId: week.id, revision: "a".repeat(64), teamWin: null, rows: players.map(player => ({ playerId: player.id, number: player.number, name: player.name, clubId: player.clubId, club: player.club.name, position: player.position, currentPrice: 3000, lastDelta: 230, priceBefore: 3000, priceDelta: 230, priceAfter: 3230, newCurrentPrice: 3230, teamResultDelta: 0, goalsDelta: 200, startedDelta: 30, yellowCardsDelta: 0, redCardsDelta: 0, goalkeeperDelta: 0, applied: false, missingStats: false })) };
const browser = await chromium.launch();
const results = [];
const failures = [];
for (const locale of ["es", "uk"]) for (const theme of ["light", "dark"]) {
  const context = await browser.newContext();
  await context.addInitScript(({ locale, theme }) => { localStorage.setItem("fantasy-futsal-token", "ui-test"); localStorage.setItem("fantasy-locale", locale); localStorage.setItem("fantasy-theme", theme); }, { locale, theme });
  await context.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, "");
    const data = path === "/auth/me" ? { user: { id: "admin", name: "Admin", email: "test@example.invalid", role: "ADMIN", avatarUrl: null } }
      : path === "/admin/gameweeks" ? [week]
      : path === "/admin/player-points" ? players
      : path === "/admin/price-settings" ? { teamWin: null }
      : path.endsWith("/player-prices") ? preview
      : path === "/my-team/popular-player" ? { player: players[0], ownerCount: 8, totalUsers: 23, percentage: 35 }
      : path === "/players" ? players.slice(0, 12)
      : path === "/clubs" ? clubs
      : path === "/gameweeks/current" ? week
      : path === "/my-team" ? team
      : path === "/my-team/transfers" ? { gameweek: week, marketIsOpen: false, bought: 0, sold: 0, limit: 2, initialSquad: false }
      : path === "/gameweeks/scoring-rules" ? { started: 2, win: 2, draw: 1, fieldGoal: 5, goalkeeperGoal: 8, goalkeeperCleanSheet: 5, hatTrickBonus: 3, yellowCard: -1, redCard: -4 }
      : [];
    await route.fulfill({ json: data });
  });
  const page = await context.newPage();
  page.on("pageerror", error => { failures.push(error.message); console.error(error.message); });
  for (const width of [320, 360, 375, 390, 430, 768, 1024, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/rules", "/admin/player-points", "/admin/player-prices", "/my-team", "/purchase-players", "/friend-leagues"]) {
      console.log(`${locale}/${theme}/${width}${path}`);
      await page.goto(`http://127.0.0.1:5173${path}`);
      await page.locator("h1").waitFor().catch(async error => { console.error(await page.locator("body").innerText()); throw error; });
      if (path.startsWith("/admin/player-")) {
        await page.locator(".admin-toolbar select").first().selectOption(week.id);
        if (path.endsWith("prices")) {
          await page.getByRole("button", { name: locale === "es" ? "Calcular cambios" : "Розрахувати зміни", exact: true }).click();
          await page.locator(".price-preview-grid article").first().waitFor();
          await page.locator(".admin-toolbar input").fill("Amandinha");
          assert.equal(await page.locator(".price-preview-grid article").count(), 1);
        } else {
          await page.locator(".admin-toolbar input").fill("Amandinha");
          await page.locator(".stats-player").first().click();
          await page.locator(".stats-form").waitFor();
        }
      }
      if (path === "/my-team") {
        const buttons = page.locator(".squad-actions button");
        assert.ok(await buttons.count() > 0);
        for (const button of await buttons.all()) assert.equal(await button.isDisabled(), true);
      }
      if (path === "/purchase-players") {
        await page.locator(".popular-player h3").waitFor();
        assert.match(await page.locator(".popular-player").innerText(), /35%/);
        assert.equal(await page.locator(".price-change-notice + .popular-player").count(), 1);
      }
      if (path === "/friend-leagues") {
        await page.locator(".friend-league-actions button").first().click();
        await page.locator(".compact-modal input").fill("Una liga de prueba");
        assert.equal(await page.locator(".compact-modal").evaluate(el => el.scrollWidth <= el.clientWidth + 1), true);
        await page.locator(".compact-modal__close").click();
        await page.reload();
        await page.locator(".friend-league-actions").waitFor();
        const toggle = page.locator(".menu-toggle");
        if (await toggle.isVisible()) await toggle.click();
        const link = page.locator('a[href="/friend-leagues"]:visible');
        assert.equal(await link.getAttribute("aria-current"), "page");
        if (await toggle.isVisible()) await page.locator(".mobile-menu__head button").click();
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      if (overflow) failures.push(`Horizontal overflow ${locale}/${theme}/${width}${path}`);
      if ([320, 768, 1280].includes(width) && locale === "uk") await page.screenshot({ path: fileURLToPath(new URL(`${theme}-${width}-${path.replaceAll("/", "_")}.png`, out)), fullPage: false });
      if (path === "/rules") {
        const menu = page.locator(".menu-toggle");
        if (await menu.isVisible()) await menu.click();
        const rules = page.locator(".nav-link--rules:visible").first();
        await rules.scrollIntoViewIfNeeded();
        const style = await rules.evaluate(el => ({ background: getComputedStyle(el).backgroundColor, color: getComputedStyle(el).color, margin: getComputedStyle(el).marginBottom }));
        assert.equal(style.background, "rgb(255, 196, 0)");
        assert.equal(style.color, "rgb(11, 31, 58)");
        assert.equal(style.margin, width <= 1024 ? "8px" : "12px");
        await rules.hover();
        assert.equal(await rules.evaluate(el => getComputedStyle(el).backgroundColor), style.background);
      }
      results.push({ locale, theme, width, path, overflow });
    }
  }
  await context.close();
}
await browser.close();
await writeFile(new URL("results.json", out), JSON.stringify({ results, failures }, null, 2));
console.log(`${results.length} responsive route checks; failures: ${failures.length}`);
assert.deepEqual(failures, []);
