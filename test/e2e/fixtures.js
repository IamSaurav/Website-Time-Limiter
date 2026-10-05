import { test as base, chromium } from '@playwright/test';
import path from 'node:path';

const EXT = path.resolve(process.cwd());

export const LIMITED = 'limited.test';
export const SAFE = 'safe.test';
export const PORT = 4610;

export const test = base.extend({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      headless: !process.env.HEADED,
      args: [
        `--disable-extensions-except=${EXT}`,
        `--load-extension=${EXT}`,
        `--host-resolver-rules=MAP *.${LIMITED} 127.0.0.1, MAP ${LIMITED} 127.0.0.1, MAP *.${SAFE} 127.0.0.1, MAP ${SAFE} 127.0.0.1`,
      ],
    });
    await use(context);
    await context.close();
  },
  // A kept-open extension page. The service worker is allowed to be terminated by
  // Chrome, so talking to it directly makes every assertion flaky.
  ext: async ({ context }, use) => {
    let [worker] = context.serviceWorkers();
    if (!worker) worker = await context.waitForEvent('serviceworker');
    // The service worker's own log is the only window into why a background task
    // did not happen, so it is forwarded into the test output.
    worker.on('console', (entry) => {
      if (entry.text().includes('[Site Limit]')) console.log('  worker:', entry.text());
    });
    const id = worker.url().split('/')[2];
    const page = await context.newPage();
    await page.goto(`chrome-extension://${id}/popup.html`);
    await use(page);
    await page.close();
  },
});

export const expect = test.expect;

export const url = (host, file = 'timewaster.html') => `http://${host}:${PORT}/${file}`;

export async function setLimit(ext, host, seconds) {
  await ext.evaluate(async ({ host, seconds }) => {
    await chrome.storage.local.set({
      websiteLimits: {
        [host]: { originalLimit: seconds, timeLeft: seconds, resetDate: new Date().toDateString() },
      },
    });
  }, { host, seconds });
}

// A day that is already over the limit, with the figures fixed so the overlay's
// copy can be asserted exactly instead of within a tolerance.
export async function setUsage(ext, host, { limit, spent, overrides }) {
  await ext.evaluate(async ({ host, limit, spent, overrides }) => {
    const today = new Date().toDateString();
    await chrome.storage.local.set({
      websiteLimits: {
        [host]: {
          originalLimit: limit,
          timeLeft: 0,
          resetDate: today,
          spentToday: spent,
          spentDate: today,
          overridesToday: overrides,
          overrideSecondsToday: overrides * 60,
          overrideDate: today,
        },
      },
    });
  }, { host, limit, spent, overrides });
}

export async function readLimit(ext, host) {
  return ext.evaluate(async (host) => {
    const { websiteLimits } = await chrome.storage.local.get('websiteLimits');
    return websiteLimits?.[host] ?? null;
  }, host);
}

// Drops the remaining time to a second so a test does not have to wait out a
// real override. The tracker is re-synced so it sees the new figure.
export async function burnDown(ext, host, seconds = 1) {
  await ext.evaluate(async ({ host, seconds }) => {
    const { websiteLimits } = await chrome.storage.local.get('websiteLimits');
    websiteLimits[host].timeLeft = seconds;
    await chrome.storage.local.set({ websiteLimits });
    for (const tab of await chrome.tabs.query({ active: true })) {
      if (tab.id !== undefined) {
        await chrome.tabs.sendMessage(tab.id, { type: 'siteLimitSync', remaining: seconds, paused: false }).catch(() => {});
      }
    }
  }, { host, seconds });
}

// page.waitForEvent('close') can miss the event when the tab goes away faster than
// the subscription is set up, which made a working close look broken.
export async function waitForClose(page, ms = 8000) {
  for (let waited = 0; waited < ms && !page.isClosed(); waited += 100) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return page.isClosed();
}

// The 15 minute override has to be held down, so a plain click must not grant it.
export async function holdFifteen(page, ms = 2000) {
  const button = page.getByRole('button', { name: /15 more mins/ });
  const box = await button.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}
