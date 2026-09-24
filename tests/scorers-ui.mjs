import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const browser = await chromium.launch();
fs.mkdirSync('artifacts/scorers', { recursive: true });
try {
  const page = await browser.newPage();
  page.on('pageerror', error => console.error(error.message));
  await page.addInitScript(() => localStorage.setItem('fantasy-futsal-token', 'test'));
  const clubs = [{ id: 'a', name: 'Poio Pescamar', logoUrl: null }, { id: 'b', name: 'STV Roldán', logoUrl: null }];
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    let data = [];
    if (path.endsWith('/auth/me')) data = { user: { id: 'admin', role: 'ADMIN', name: 'Admin' } };
    if (path.endsWith('/scorers')) data = clubs.map((club, i) => ({ id: String(i), name: i ? 'Fernández Martín, Laura' : 'Sánchez Arcediano, Laura', club, goals: 6 - i }));
    if (path.endsWith('/player-prices')) data = clubs.map((club, i) => ({ id: String(i), name: 'Laura ' + i, club, price: 3000, priceChanges: [] }));
    if (path.endsWith('/admin/friend-leagues')) data = [{ id: 'league', name: 'Friends', owner: { name: 'Owner' }, inviteCode: 'FUT123', createdAt: '2026-09-01', _count: { members: 2 } }];
    if (path.endsWith('/private-leagues/league')) data = { id: 'league', name: 'Friends', ownerId: 'owner', startGameweek: 2, inviteCode: 'FUT123', members: [{ id: 'owner', name: 'Owner', rank: 1, points: 42 }, { id: 'member', name: 'Member', rank: 2, points: 25 }] };
    return route.fulfill({ json: data });
  });
  for (const locale of ['es', 'uk', 'en']) {
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('http://127.0.0.1:5174/login');
      await page.evaluate(locale => localStorage.setItem('fantasy-locale', locale), locale);
      await page.goto('http://127.0.0.1:5174/scorers');
      await page.locator('.scorers-table tbody tr').last().waitFor().catch(async error => { console.error(await page.locator('body').innerText()); throw error; });
      assert.equal(await page.locator('.scorers-table tbody tr').count(), 2);
      assert.equal(await page.locator('.scorers-table tbody tr').first().locator('td').last().innerText(), '6');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: `artifacts/scorers/${locale}-${width}.png`, fullPage: true });
    }
  }
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('http://127.0.0.1:5174/player-prices');
    await page.locator('.player-price-card').last().waitFor();
    await page.locator('.catalog-filters select').selectOption('a');
    assert.equal(await page.locator('.player-price-card').count(), 1);
    await page.locator('.catalog-filters input').fill('unmatched');
    assert.equal(await page.locator('.player-price-card').count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.goto('http://127.0.0.1:5174/admin/friend-leagues');
    await page.locator('a[href="/league/league"]').click();
    await page.locator('.leaderboard-row').last().waitFor();
    assert.equal(await page.locator('.leaderboard-row').count(), 2);
    assert.match(await page.locator('.leaderboard-row').first().innerText(), /42/);
    assert.equal(await page.locator('.league-danger-actions').count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  }
  console.log('PASS: scorers in 3 locales × 3 widths; combined club/search filters; admin league members and points');
} finally { await browser.close(); }
