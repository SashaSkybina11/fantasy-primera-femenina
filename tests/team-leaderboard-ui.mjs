import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';

mkdirSync('artifacts/team-leaderboard', { recursive: true });
const browser = await chromium.launch();
const errors = [];
try {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    localStorage.setItem('fantasy-futsal-token', 'test');
    localStorage.setItem('fantasy-locale', 'uk');
  });
  const club = { id: 'club', name: 'STV Roldán', logoUrl: null };
  const team = { id: 'team', name: 'Test team', budget: 1000, players: [1000, 1200, null, 1100].map((purchasePrice, i) => ({
    id: 'entry' + i, playerId: 'p' + i, status: i === 0 ? 'STARTER' : 'BENCH', isCaptain: false, purchasePrice,
    player: { id: 'p' + i, clubId: club.id, club, name: 'Player ' + i, number: i + 1, price: 1100, position: 'FIELD_PLAYER', role: 'ALA', age: 25, nationality: 'ES' },
  })) };
  await context.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname.replace('/api', '');
    const data = {
      '/auth/me': { user: { id: 'user', role: 'USER', name: 'Test', email: 'test@example.invalid' } },
      '/my-team': team, '/my-team/transfers': { marketIsOpen: false }, '/game-config': { initialBudget: 40000 },
      '/gameweeks/leaderboard': [2, -1, 0, null].map((rankChange, i) => ({ id: 'u' + i, name: 'Participant ' + i, rank: i + 1, rankChange, totalPoints: 72 - i, lastGameweekPoints: 37 })),
      '/gameweeks/history/me': [],
    }[path] ?? [];
    return route.fulfill({ json: data });
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('http://127.0.0.1:5173/my-team');
    for (let i = 0; i < 4; i++) {
      await page.locator('.squad-player-details').filter({ hasText: 'Player ' + i }).click();
      const prices = page.locator('.squad-price-comparison');
      await prices.waitFor();
      assert.equal(await prices.locator('.price-delta--up').count(), i === 0 ? 2 : 0);
      assert.equal(await prices.locator('.price-delta--down').count(), i === 1 ? 2 : 0);
      assert.equal(await prices.locator('.squad-price-comparison__change').count(), i === 2 ? 0 : 1);
      if (i === 2) assert.match(await prices.innerText(), /Не збережено/);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      if (i === 0) await page.screenshot({ path: `artifacts/team-leaderboard/price-${width}.png` });
      await page.keyboard.press('Escape');
    }
    await page.goto('http://127.0.0.1:5173/leaderboard');
    await page.locator('.leaderboard-row--overall').last().waitFor();
    assert.deepEqual(await page.locator('.rank-change').allTextContents(), ['↑ 2', '↓ 1', '—']);
    assert.equal(await page.locator('.leaderboard-row--overall > span').count(), 0);
    assert.equal(await page.locator('.leaderboard-row--overall em').count(), 4);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await page.screenshot({ path: `artifacts/team-leaderboard/league-${width}.png`, fullPage: true });
  }
  assert.deepEqual(errors, []);
  console.log('PASS: starter/bench prices, gain/loss/unchanged/unknown, locked-market details, league movement and single totals at 320/768/1440px');
} finally { await browser.close(); }
