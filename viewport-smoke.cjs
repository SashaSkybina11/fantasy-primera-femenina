const { chromium } = require("playwright");

const user = { id: "ckx0000000000000000000001", email: "test@example.com", name: "Responsive Test", avatarUrl: null };
const team = { id: "ckx0000000000000000000002", name: "Test Team", budget: 50000, players: [] };
const widths = [320, 360, 375, 390, 430, 600, 768, 820, 1024, 1280, 1440, 1920, 2560];

async function mockApi(route) {
  const url = new URL(route.request().url());
  const body = url.pathname.endsWith("/auth/me") ? { user } : url.pathname.endsWith("/my-team") ? team : [];
  await route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
}

async function run() {
const browser = await chromium.launch({ headless: true });
try {
  for (const width of widths) {
    const page = await browser.newPage({ viewport: { width, height: 820 } });
    await page.route("**/api/**", mockApi);
    await page.addInitScript(() => localStorage.setItem("fantasy-futsal-token", "test-token"));
    await page.goto("http://127.0.0.1:4174/", { waitUntil: "networkidle" });
    await page.waitForSelector(".home-hero");
    const pageMetrics = await page.evaluate(() => ({ viewport: window.innerWidth, scrollWidth: document.documentElement.scrollWidth }));
    let logoutVisible = null;
    if (width <= 1024 && await page.locator(".menu-toggle").count()) {
      await page.locator(".menu-toggle").click();
      const box = await page.locator(".mobile-menu .logout-button").boundingBox();
      logoutVisible = Boolean(box && box.y >= 0 && box.y + box.height <= 820);
    }
    console.log(JSON.stringify({ width, ...pageMetrics, logoutVisible }));
    await page.close();
  }
} finally {
  await browser.close();
}
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
