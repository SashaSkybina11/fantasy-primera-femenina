import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import ts from 'typescript';

const base = process.argv[2] || process.env.TEST_BASE_URL || 'http://127.0.0.1:5173';
const directory = 'artifacts/email-auth';
mkdirSync(directory, { recursive: true });
const source = ts.createSourceFile('locale.tsx', readFileSync('frontend/src/contexts/LocaleContext.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const dictionaries = {};
for (const statement of source.statements) if (ts.isVariableStatement(statement)) {
  for (const declaration of statement.declarationList.declarations) {
    const locale = { spanish: 'es', ukrainian: 'uk', english: 'en' }[declaration.name.getText(source)];
    if (!locale) continue;
    const object = ts.isAsExpression(declaration.initializer) ? declaration.initializer.expression : declaration.initializer;
    dictionaries[locale] = Object.fromEntries(object.properties.map(property => [property.name.text, property.initializer.text]));
  }
}
const errors = {
  en: { code: 'The code is incorrect', reset: 'The link has expired', delivery: 'Could not send the email', limit: 'Too many attempts', expired: 'Restart registration' },
  uk: { code: 'Код неправильний', reset: 'Посилання прострочене', delivery: 'Не вдалося надіслати лист', limit: 'Забагато спроб', expired: 'Почніть реєстрацію знову' },
  es: { code: 'Código incorrecto', reset: 'El enlace ha caducado', delivery: 'No se pudo enviar el correo', limit: 'Demasiados intentos', expired: 'Vuelve a empezar el registro' },
};
const browser = await chromium.launch();
const results = [];
try {
  for (const locale of ['uk', 'es', 'en']) for (const width of [320, 1440]) for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    const runtimeErrors = [];
    page.on('pageerror', error => runtimeErrors.push(error.message));
    await page.addInitScript(({ locale, theme }) => {
      localStorage.setItem('fantasy-locale', locale);
      localStorage.setItem('fantasy-theme', theme);
    }, { locale, theme });
    await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
    const copy = dictionaries[locale];
    const button = key => page.getByRole('button', { name: copy[key], exact: true });
    const heading = key => page.getByRole('heading', { name: copy[key], exact: true }).waitFor();
    const submit = () => page.locator('.auth-form > button.button').click();
    const screenshot = async name => {
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, locale + '/' + width + '/' + theme + '/' + name + ' overflows');
      await page.screenshot({ path: directory + '/' + name + '-' + locale + '-' + theme + '-' + width + '.png', fullPage: true });
    };
    let scenario = 'normal';
    let verificationCalls = 0;
    let resetPayload;
    let releaseRegistration;
    let signalRegistration;
    const registrationStarted = new Promise(resolve => { signalRegistration = resolve; });
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      const fail = message => route.fulfill({ status: 400, json: { message } });
      if (path.endsWith('/auth/register')) {
        if (scenario === 'delivery') return fail('AUTH_EMAIL_UNAVAILABLE');
        await new Promise(resolve => { releaseRegistration = resolve; signalRegistration(); });
        return route.fulfill({ status: 202, json: { verificationRequired: true, email: 'player@example.com', retryAfterSeconds: 60 } });
      }
      if (path.endsWith('/auth/verify-email')) { verificationCalls++; return fail('AUTH_INVALID_CODE'); }
      if (path.endsWith('/auth/resend-verification')) {
        if (scenario === 'expired') return fail('AUTH_REGISTRATION_EXPIRED');
        return route.fulfill({ json: { retryAfterSeconds: 60 } });
      }
      if (path.endsWith('/auth/forgot-password')) {
        if (scenario === 'limit') return route.fulfill({ status: 429, json: { message: 'AUTH_TOO_MANY_REQUESTS' } });
        return route.fulfill({ json: { ok: true, retryAfterSeconds: 60 } });
      }
      if (path.endsWith('/auth/reset-password')) {
        if (scenario === 'expired-reset') return fail('AUTH_INVALID_RESET');
        resetPayload = route.request().postDataJSON();
        return route.fulfill({ json: { ok: true } });
      }
      if (path.endsWith('/auth/logout')) return route.fulfill({ status: 204 });
      runtimeErrors.push('Unexpected API request: ' + path);
      return route.fulfill({ status: 404, json: {} });
    });
    try {
      await page.goto(base + '/register');
      await heading('auth.createProfile');
      await page.locator('input[autocomplete="name"]').fill('Test Player');
      await page.locator('input[type="email"]').fill('player@example.com');
      await page.locator('input[autocomplete="new-password"]').fill('Password-123');
      scenario = 'delivery';
      await submit();
      await page.getByText(errors[locale].delivery, { exact: false }).waitFor();
      await heading('auth.createProfile');
      scenario = 'normal';
      await submit();
      await registrationStarted;
      assert.equal(await button('auth.wait').isDisabled(), true);
      releaseRegistration();
      await heading('auth.verifyTitle');
      assert.equal(await page.locator('input[type="password"]').count(), 0);
      assert.equal(await page.evaluate(() => localStorage.getItem('fantasy-futsal-token')), null);
      await page.getByText(copy['auth.verifyDescription'].replace('{{email}}', 'player@example.com'), { exact: true }).waitFor();
      const resend = page.locator('.auth-secondary-actions button').first();
      assert.equal(await resend.isDisabled(), true);
      await page.locator('input[autocomplete="one-time-code"]').fill('12345');
      await submit();
      assert.equal(verificationCalls, 0, 'Incomplete codes must not be submitted');
      await page.locator('input[autocomplete="one-time-code"]').fill('123456');
      await submit();
      await page.getByText(errors[locale].code, { exact: false }).waitFor();
      assert.equal(verificationCalls, 1);
      await page.reload();
      await heading('auth.verifyTitle');
      assert.equal(await resend.isDisabled(), true, 'Resend delay survives reload');
      await screenshot('verification');
      // Simulate an elapsed delay without waiting a real minute per layout.
      await page.evaluate(() => sessionStorage.setItem('pending-verification-retry-at', '0'));
      await page.reload();
      await button('auth.resendCode').click();
      await page.getByText(copy['auth.codeSent'], { exact: true }).waitFor();
      assert.equal(await resend.isDisabled(), true);
      await page.evaluate(() => sessionStorage.setItem('pending-verification-retry-at', '0'));
      await page.reload();
      scenario = 'expired';
      await button('auth.resendCode').click();
      await page.getByRole('status').filter({ hasText: errors[locale].expired }).waitFor();
      await button('auth.changeEmail').click();
      await heading('auth.createProfile');
      assert.equal(await page.evaluate(() => sessionStorage.getItem('pending-verification-email')), null);
      await page.goto(base + '/login');
      await button('auth.forgotPassword').click();
      await heading('auth.forgotTitle');
      await page.locator('input[type="email"]').fill('player@example.com');
      scenario = 'limit';
      await submit();
      await page.getByText(errors[locale].limit, { exact: false }).waitFor();
      scenario = 'normal';
      await submit();
      await page.getByRole('status').filter({ hasText: copy['auth.resetSent'] }).waitFor();
      assert.equal(await page.locator('.auth-form > button.button').isDisabled(), true);
      await screenshot('recovery');
      await page.locator('input[type="email"]').fill('other@example.com');
      assert.equal(await page.locator('.auth-notice').count(), 0, 'Changing email clears the previous notice');
      const token = 'a'.repeat(64);
      await page.goto(base + '/reset-password#' + new URLSearchParams({ email: 'player@example.com', token }));
      await heading('auth.resetTitle');
      await page.locator('input[autocomplete="new-password"]').fill('New-password-123');
      scenario = 'expired-reset';
      await submit();
      await page.getByText(errors[locale].reset, { exact: false }).waitFor();
      await screenshot('reset');
      scenario = 'normal';
      await submit();
      await page.waitForURL('**/login');
      assert.deepEqual(resetPayload, { email: 'player@example.com', token, password: 'New-password-123' });
      await page.getByText(copy['auth.resetSuccess'], { exact: true }).waitFor();
      await page.goto(base + '/reset-password');
      await page.getByRole('alert').filter({ hasText: copy['auth.invalidReset'] }).waitFor();
      assert.equal(await button('auth.savePassword').isDisabled(), true);
      await screenshot('invalid-link');
      assert.deepEqual(runtimeErrors, []);
      results.push({ locale, width, theme, passed: true });
    } catch (error) {
      await page.screenshot({ path: directory + '/failure-' + locale + '-' + theme + '-' + width + '.png', fullPage: true });
      throw error;
    } finally {
      releaseRegistration?.();
      await context.close();
    }
  }
  writeFileSync(directory + '/ui-results.json', JSON.stringify({ passed: true, scenarios: ['delivery failure', 'pending', 'code validation', 'invalid code', 'reload', 'resend', 'expired registration', 'rate limit', 'reset sent', 'expired reset', 'reset success', 'invalid link'], layouts: results }, null, 2));
  console.log('PASS: email auth states in uk/es/en, light/dark, 320/1440px (' + results.length + ' layouts); no real API calls or emails');
} finally {
  await browser.close();
}
