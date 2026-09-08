import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const browser = await chromium.launch();
const context = await browser.newContext();
const origin = process.env.UI_BASE_URL ?? 'http://127.0.0.1:5186';
let revision = 1;
const requests = new Map();
const errors = [];
const user = { id: 'user', name: 'Participant', role: 'ADMIN', email: 'fixture@example.invalid' };
const week = { id: 'week', number: 1, status: 'CALCULATING', winners: [] };
const club = { id: 'club', name: 'Club' };
const player = () => ({ id: 'p', name: 'Player', number: 1, clubId: 'club', club, position: 'FIELD_PLAYER', role: 'ALA', price: revision === 1 ? 4100 : 4200,
  lastGameweekPoints: revision * 5, goals: revision,
  gameweekStats: [{ goals: revision, started: false, result: 'LOSS', yellowCards: 0, redCards: 0, goalsConceded: null, cleanSheet: false, adjustmentPoints: 0, totalPoints: revision * 5 }],
  priceChanges: [{ id: 'history', gameweek: week, priceBefore: 4000, priceDelta: revision * 100, priceAfter: 4000 + revision * 100 }] });
await context.addInitScript(() => { localStorage.setItem('fantasy-futsal-token', 'fixture'); localStorage.setItem('fantasy-locale', 'uk'); });
await context.route('**/api/**', async route => {
  const path = new URL(route.request().url()).pathname.replace('/api', '');
  requests.set(path, (requests.get(path) ?? 0) + 1);
  if (route.request().method() === 'PUT' && path.endsWith('/stats')) {
    assert.equal(route.request().postDataJSON().goals, 2);
    revision = 2;
    return route.fulfill({ json: {} });
  }
  const data = {
    '/auth/me': { user }, '/admin/gameweeks': [week], '/admin/player-points': [player()],
    '/player-prices': [player()], '/clubs/club': club, '/clubs/club/players': [player()],
    '/gameweeks/leaderboard': [{ id: 'participant', name: 'Participant', rank: 1, totalPoints: revision * 5, lastGameweekPoints: revision * 5 }],
    '/gameweeks/history/me': [{ id: 'points', gameweek: week, totalPoints: revision * 5, breakdown: [{ playerId: 'p', name: 'Player', points: revision * 5 }] }],
    '/private-leagues/friend': { id: 'friend', name: 'Friends', ownerId: 'participant', inviteCode: 'TEST', members: [{ id: 'participant', name: 'Participant', rank: 1, points: revision * 5 }] },
  }[path];
  assert.notEqual(data, undefined, 'Unexpected endpoint ' + path);
  return route.fulfill({ json: data });
});
const pages = {};
const navigations = {};
try {
  for (const [name, path] of Object.entries({ stats: '/admin/player-points', prices: '/player-prices', roster: '/teams/club', standings: '/leaderboard', friends: '/league/friend' })) {
    const page = await context.newPage();
    navigations[name] = 0;
    page.on('framenavigated', frame => { if (frame === page.mainFrame()) navigations[name]++; });
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.install();
    await page.goto(origin + path);
    await page.locator('h1').first().waitFor();
    pages[name] = page;
  }
  await pages.stats.locator('.admin-toolbar select').first().selectOption('week');
  await pages.stats.locator('.stats-player').click();
  await pages.prices.locator('details').click();
  await pages.standings.locator('details').click();
  await pages.roster.getByLabel('Голи: 1', { exact: true }).waitFor();
  const before = Object.fromEntries(await Promise.all(Object.entries(pages).map(async ([name, page]) => [name, await page.locator('.page').innerText()])));
  const counts = new Map(requests);
  const initialNavigations = { ...navigations };
  await pages.stats.getByLabel('Голи', { exact: true }).fill('2');
  await pages.stats.locator('.stats-form button').click();
  await pages.stats.waitForFunction(() => document.querySelector('.stats-summary')?.textContent.includes('Голи: 2'));
  assert.ok(requests.get('/admin/player-points') > counts.get('/admin/player-points'), 'Save invalidates active player stats immediately');
  for (const [name, page] of Object.entries(pages)) {
    if (name !== 'stats') await page.clock.fastForward(31000);
  }
  await pages.roster.getByLabel('Голи: 2', { exact: true }).waitFor();
  await pages.prices.waitForFunction(() => document.querySelector('details')?.textContent.replace(/\s/g, '').includes('4200'));
  await pages.standings.waitForFunction(() => document.querySelector('.leaderboard-row em')?.textContent.includes('10'));
  await pages.standings.waitForFunction(() => document.querySelector('.history-row summary b')?.textContent.includes('10'));
  await pages.friends.waitForFunction(() => document.querySelector('.leaderboard-row em')?.textContent.includes('10'));
  const after = Object.fromEntries(await Promise.all(Object.entries(pages).map(async ([name, page]) => [name, await page.locator('.page').innerText()])));
  for (const name of Object.keys(pages)) assert.notEqual(before[name], after[name], name + ' changed without reload');
  assert.deepEqual(navigations, initialNavigations, 'No navigation or reload after statistics save');
  assert.deepEqual(errors, []);
  fs.mkdirSync('artifacts/consistency', { recursive: true });
  fs.writeFileSync('artifacts/consistency/recalculation-refresh.json', JSON.stringify({ passed: true, before, after, requests: Object.fromEntries(requests), immediateStatsInvalidation: true, otherTabsPollingMs: 30000, reloads: 0, errors }, null, 2));
  console.log('PASS: stats invalidation; prices + history, roster stats, user points, general/season and Friend League standings update without reload');
} finally { await browser.close(); }
