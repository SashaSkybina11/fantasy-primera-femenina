import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5173';
const browser = await chromium.launch();
const user = { id: 'user', name: 'Test Player', email: 'player@example.invalid', role: 'USER', avatarUrl: null, favoriteClub: null };
try {
  for (const locale of ['uk', 'es', 'en']) for (const mode of ['register', 'login']) {
    const page = await browser.newPage({ viewport: { width: 375, height: 900 } });
    const errors = [];
    const authCalls = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(locale => {
      localStorage.setItem('fantasy-locale', locale);
      sessionStorage.setItem('pending-verification-email', 'old@example.invalid');
    }, locale);
    await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
    await page.route('**/api/**', route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/auth/register') || path.endsWith('/auth/login')) {
        authCalls.push({ path, payload: route.request().postDataJSON() });
        return route.fulfill({ status: mode === 'register' ? 201 : 200, json: { token: 'test-session', user } });
      }
      if (path.endsWith('/auth/me')) return route.fulfill({ json: { user } });
      if (path.endsWith('/gameweeks/current')) return route.fulfill({ json: null });
      if (path.endsWith('/my-team')) return route.fulfill({ json: { id: 'team', name: 'Test FC', budget: 40000, players: [] } });
      if (path.includes('/auth/')) errors.push('Unexpected email auth request: ' + path);
      return route.fulfill({ json: [] });
    });
    await page.goto(base + '/' + mode);
    await page.locator('input[type="email"]').fill(user.email);
    await page.locator('input[type="password"]').fill('Password-123');
    if (mode === 'register') await page.locator('input[autocomplete="name"]').fill(user.name);
    assert.equal(await page.locator('input[autocomplete="one-time-code"]').count(), 0);
    assert.equal(await page.locator('.auth-secondary-actions').count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.locator('.auth-form > button.button').click();
    await page.waitForURL(base + '/');
    await page.locator('.home-page').waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem('fantasy-futsal-token')), 'test-session');
    assert.deepEqual(authCalls, [{ path: '/api/auth/' + mode, payload: { ...(mode === 'register' ? { name: user.name } : {}), email: user.email, password: 'Password-123' } }]);
    await page.reload();
    await page.locator('.home-page').waitFor();
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('PASS: immediate registration and email/password login in uk/es/en; session survives reload; no verification or email requests');
} finally {
  await browser.close();
}
