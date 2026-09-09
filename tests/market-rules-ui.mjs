import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const browser = await chromium.launch();
const errors = [];
await mkdir('artifacts/market-rules', { recursive: true });
try {
  for (const [locale, title] of [['uk', 'Зміна ринкової вартості гравчині'], ['es', 'Cambio del valor de mercado de la jugadora'], ['en', 'Player Market Value Changes']]) {
    const context = await browser.newContext();
    await context.addInitScript(locale => {
      localStorage.setItem('fantasy-locale', locale);
      localStorage.setItem('fantasy-futsal-token', 'fixture');
    }, locale);
    await context.route('**/api/**', route => {
      const path = new URL(route.request().url()).pathname;
      return route.fulfill({ json: path.endsWith('/auth/me') ? { user: { id: 'fixture', name: 'Test', role: 'ADMIN' } }
        : path.endsWith('/scoring-rules') ? { started: 2, win: 2, draw: 1, fieldGoal: 5, goalkeeperGoal: 8, goalkeeperCleanSheet: 5, hatTrickBonus: 3, yellowCard: -1, redCard: -4 }
        : path.endsWith('/game-config') ? { initialBudget: 50000 } : [] });
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    for (const width of [320, 375, 390, 430, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('http://127.0.0.1:5173/rules', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.getByRole('heading', { name: title, exact: true }).waitFor();
      assert.equal(await page.locator('.rules-market-value tbody tr').count(), 9);
      assert.equal(await page.locator('.rules-market-value li').count(), 6);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      if (width <= 760) {
        await page.locator('.menu-toggle').click();
        const links = page.locator('.mobile-menu .nav-link');
        await links.first().waitFor();
        for (const link of await links.all()) {
          assert.ok(await link.evaluate(el => el.scrollWidth <= el.clientWidth + 1));
          assert.ok((await link.boundingBox()).height >= 44);
          assert.equal(await link.evaluate(el => getComputedStyle(el).fontSize), '16.8px');
        }
        await page.screenshot({ path: `artifacts/market-rules/${locale}-${width}-menu.png` });
        await page.locator('.mobile-menu__head button').click();
      }
      await page.screenshot({ path: `artifacts/market-rules/${locale}-${width}-rules.png`, fullPage: true });
    }
    await context.close();
  }
  assert.deepEqual(errors, []);
  console.log('PASS: rules in three languages; menu at 320/375/390/430; tablet/desktop layouts; no console errors');
} finally { await browser.close(); }
