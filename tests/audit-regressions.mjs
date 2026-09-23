import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:5173/login');
  const result = await page.evaluate(async () => {
    const { api, authToken, authRequiredEvent, imageUrl } = await import('/src/services/api.ts');
    const originalFetch = window.fetch;
    let resolve;
    let events = 0;
    const handler = () => { events++; };
    window.addEventListener(authRequiredEvent, handler);
    try {
      window.fetch = () => new Promise(done => { resolve = done; });
      authToken.set('old-session');
      const pending = api.me().catch(() => {});
      authToken.set('new-session');
      resolve(new Response('{}', { status: 401 }));
      await pending;
      const preserved = authToken.get();
      const staleEvents = events;
      const current = api.me().catch(() => {});
      resolve(new Response('{}', { status: 401 }));
      await current;
      return { preserved, staleEvents, cleared: authToken.get(), events,
        photo: imageUrl('/photos/alcorcón/ari.png'), upload: imageUrl('/uploads/avatar.png') };
    } finally {
      window.fetch = originalFetch;
      window.removeEventListener(authRequiredEvent, handler);
      authToken.clear();
    }
  });
  assert.equal(result.preserved, 'new-session');
  assert.equal(result.staleEvents, 0);
  assert.equal(result.cleared, null);
  assert.equal(result.events, 1);
  assert.equal(result.photo, '/photos/alcorc%C3%B3n/ari.png');
  assert.equal(result.upload, 'http://localhost:4000/uploads/avatar.png');
  const profile = { id: 'user', name: 'Initial user', email: 'test@example.invalid', role: 'USER',
    avatarUrl: null, createdAt: '2026-01-01', contactConsent: false,
    fantasyTeam: { id: 'team', name: 'Initial team', budget: 40000, players: [] } };
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({ json: path === '/api/auth/me' ? { user: profile } : profile });
  });
  await page.evaluate(() => localStorage.setItem('fantasy-futsal-token', 'profile-session'));
  await page.goto('http://127.0.0.1:5173/profile');
  await page.getByRole('button', { name: 'Editar perfil', exact: true }).click();
  const name = page.getByRole('textbox').filter({ visible: true }).first();
  await name.fill('Unsaved user');
  profile.name = 'Background update';
  const refreshed = page.waitForResponse(response => response.url().endsWith('/api/profile'));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await refreshed;
  await page.waitForTimeout(100);
  assert.equal(await name.inputValue(), 'Unsaved user');
  console.log('PASS: stale 401 isolation, active 401 logout, frontend photos and backend uploads');
  console.log('PASS: profile edits survive a background refetch');
} finally {
  await browser.close();
}
