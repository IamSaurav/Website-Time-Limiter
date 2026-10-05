import { LIMITED, SAFE, burnDown, expect, holdFifteen, readLimit, setLimit, test, url, waitForClose } from './fixtures.js';

const overlay = (page) => page.locator('#timeBlockerOverlay');

test('the overlay appears when the limit runs out', async ({ context, ext }) => {
  await setLimit(ext, LIMITED, 3);
  const page = await context.newPage();
  await page.goto(url(LIMITED));
  await page.bringToFront();
  await expect(overlay(page)).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole('heading', { name: "Time's up" })).toBeVisible();
  await expect(overlay(page)).toContainText(LIMITED);
  await expect(page.locator('#timeBlockerOverlay')).toHaveJSProperty('open', true);
  expect((await readLimit(ext, LIMITED)).timeLeft).toBe(0);
});

test('time is spent while the page is in front', async ({ context, ext }) => {
  await setLimit(ext, LIMITED, 600);
  const page = await context.newPage();
  await page.goto(url(LIMITED));
  await page.bringToFront();
  await page.waitForTimeout(6000);
  const site = await readLimit(ext, LIMITED);
  expect(site.timeLeft).toBeLessThanOrEqual(598);
  expect(site.timeLeft).toBeGreaterThanOrEqual(592);
});

test('no time is spent on a site without a limit', async ({ context, ext }) => {
  await setLimit(ext, LIMITED, 600);
  const page = await context.newPage();
  await page.goto(url(SAFE));
  await page.bringToFront();
  await page.waitForTimeout(6000);
  expect((await readLimit(ext, LIMITED)).timeLeft).toBe(600);
});

test('a limited tab left in the background does not spend time', async ({ context, ext }) => {
  await setLimit(ext, LIMITED, 600);
  const limited = await context.newPage();
  await limited.goto(url(LIMITED));
  await limited.bringToFront();
  await limited.waitForTimeout(3000);

  const other = await context.newPage();
  await other.goto(url(SAFE));
  await other.bringToFront();
  await other.waitForTimeout(1000);
  const parked = (await readLimit(ext, LIMITED)).timeLeft;

  await other.waitForTimeout(8000);
  expect((await readLimit(ext, LIMITED)).timeLeft).toBe(parked);
});

test('a subdomain counts against the parent limit', async ({ context, ext }) => {
  await setLimit(ext, LIMITED, 600);
  const page = await context.newPage();
  await page.goto(url(`news.${LIMITED}`));
  await page.bringToFront();
  await page.waitForTimeout(6000);
  const site = await readLimit(ext, LIMITED);
  expect(site.timeLeft).toBeLessThanOrEqual(598);
  expect(site.timeLeft).toBeGreaterThanOrEqual(592);
});

test('an unrelated host does not count against a limit', async ({ context, ext }) => {
  await setLimit(ext, LIMITED, 600);
  const page = await context.newPage();
  await page.goto(url(SAFE));
  await page.bringToFront();
  await page.waitForTimeout(6000);
  expect((await readLimit(ext, LIMITED)).timeLeft).toBe(600);
});

test('an override adds time instead of replacing what is left', async ({ context, ext }) => {
  await setLimit(ext, LIMITED, 3);
  const page = await context.newPage();
  await page.goto(url(LIMITED));
  await page.bringToFront();
  await expect(overlay(page)).toBeVisible({ timeout: 20000 });

  await holdFifteen(page);
  await expect(overlay(page)).toHaveCount(0);

  const site = await readLimit(ext, LIMITED);
  expect(site.timeLeft).toBeGreaterThanOrEqual(898);
  expect(site.overridesToday).toBe(1);
  expect(site.overrideSecondsToday).toBe(900);
});

test('a second override stacks on the first', async ({ context, ext }) => {
  await setLimit(ext, LIMITED, 2);
  const page = await context.newPage();
  await page.goto(url(LIMITED));
  await page.bringToFront();
  await expect(overlay(page)).toBeVisible({ timeout: 20000 });
  await page.getByRole('button', { name: '1 more min' }).click();
  await expect(overlay(page)).toHaveCount(0);

  await burnDown(ext, LIMITED);
  await expect(overlay(page)).toBeVisible({ timeout: 20000 });
  await page.getByRole('button', { name: '1 more min' }).click();
  await expect(overlay(page)).toHaveCount(0);

  const site = await readLimit(ext, LIMITED);
  expect(site.overridesToday).toBe(2);
  expect(site.overrideSecondsToday).toBe(120);
  expect(site.timeLeft).toBeGreaterThan(55);
});

test('video is paused but not destroyed by the overlay', async ({ context, ext }) => {
  await setLimit(ext, LIMITED, 3);
  const page = await context.newPage();
  await page.goto(url(LIMITED));
  await page.bringToFront();
  await page.evaluate(() => {
    document.getElementById('clip').src = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDE=';
  });
  await expect(overlay(page)).toBeVisible({ timeout: 20000 });
  expect(await page.evaluate(() => document.getElementById('clip').getAttribute('src'))).toContain('data:video/mp4');
  expect(await page.evaluate(() => document.getElementById('clip').paused)).toBe(true);
});

test('spent time is recorded for the day', async ({ context, ext }) => {
  await setLimit(ext, LIMITED, 600);
  const page = await context.newPage();
  await page.goto(url(LIMITED));
  await page.bringToFront();
  await page.waitForTimeout(7000);
  const site = await readLimit(ext, LIMITED);
  expect(site.spentToday).toBeGreaterThanOrEqual(4);
  expect(site.spentToday + site.timeLeft).toBe(600);
});

test('the overlay sits above a page that pins its own header on top', async ({ context, ext }) => {
  await setLimit(ext, LIMITED, 2);
  const page = await context.newPage();
  await page.goto(url(LIMITED, 'stubborn.html'));
  await page.bringToFront();
  await expect(overlay(page)).toBeVisible({ timeout: 20000 });

  const box = await page.locator('#timeBlockerOverlay').boundingBox();
  // The page pins its own bar at the maximum z-index; the overlay still has to win.
  const topOfPage = await page.evaluate(() => {
    const el = document.elementFromPoint(window.innerWidth / 2, 30);
    return el?.closest('#timeBlockerOverlay') ? 'overlay' : el?.id || el?.tagName || 'nothing';
  });
  expect(topOfPage).toBe('overlay');
  expect(box.height).toBeGreaterThan(300);
});

test('a plain click does not buy fifteen minutes', async ({ context, ext }) => {
  await setLimit(ext, LIMITED, 2);
  const page = await context.newPage();
  await page.goto(url(LIMITED));
  await page.bringToFront();
  await expect(overlay(page)).toBeVisible({ timeout: 20000 });

  await page.getByRole('button', { name: /15 more mins/ }).click();
  await page.waitForTimeout(400);
  await expect(overlay(page)).toBeVisible();
  expect((await readLimit(ext, LIMITED)).overridesToday ?? 0).toBe(0);

  await holdFifteen(page);
  await expect(overlay(page)).toHaveCount(0);
  const site = await readLimit(ext, LIMITED);
  expect(site.overridesToday).toBe(1);
  expect(site.overrideSecondsToday).toBe(900);
});

test('close tab actually closes the tab', async ({ context, ext }) => {
  await setLimit(ext, LIMITED, 2);
  const page = await context.newPage();
  await page.goto(url(LIMITED));
  await page.bringToFront();
  await expect(overlay(page)).toBeVisible({ timeout: 20000 });

  await page.getByRole('button', { name: 'Close tab' }).click();
  expect(await waitForClose(page)).toBe(true);
});

test('closing the last tab leaves the browser with one open', async ({ context, ext }) => {
  await setLimit(ext, LIMITED, 2);
  for (const open of context.pages()) {
    if (!open.url().startsWith('chrome-extension://')) await open.close();
  }
  const page = await context.newPage();
  await page.goto(url(LIMITED));
  await page.bringToFront();
  await expect(overlay(page)).toBeVisible({ timeout: 20000 });

  await page.getByRole('button', { name: 'Close tab' }).click();
  expect(await waitForClose(page)).toBe(true);
  expect(context.pages().length).toBeGreaterThan(0);
});

test('closing the tab does not spend an override', async ({ context, ext }) => {
  await setLimit(ext, LIMITED, 2);
  const page = await context.newPage();
  await page.goto(url(LIMITED));
  await page.bringToFront();
  await expect(overlay(page)).toBeVisible({ timeout: 20000 });

  await page.getByRole('button', { name: 'Close tab' }).click();
  expect(await waitForClose(page)).toBe(true);
  expect((await readLimit(ext, LIMITED)).overridesToday ?? 0).toBe(0);
});

test('closing the tab never reports a failure', async ({ context, ext }) => {
  await setLimit(ext, LIMITED, 2);
  const page = await context.newPage();
  await page.goto(url(LIMITED));
  await page.bringToFront();
  await expect(overlay(page)).toBeVisible({ timeout: 20000 });

  // A refused close is the only thing that writes to the page console, and it is
  // the only thing that puts an error on the screen. A clean close says nothing.
  const complaints = [];
  page.on('console', (entry) => {
    if (entry.text().includes('[Site Limit]')) complaints.push(entry.text());
  });

  await page.getByRole('button', { name: 'Close tab' }).click();
  expect(await waitForClose(page)).toBe(true);
  expect(complaints).toEqual([]);
});

test('a failed override says something a reader can act on', async ({ context, ext }) => {
  await setLimit(ext, LIMITED, 2);
  const page = await context.newPage();
  await page.goto(url(LIMITED));
  await page.bringToFront();
  await expect(overlay(page)).toBeVisible({ timeout: 20000 });

  // The limit disappears underneath the overlay, so the override cannot be applied.
  await ext.evaluate(() => chrome.storage.local.set({ websiteLimits: {} }));
  await page.getByRole('button', { name: '1 more min' }).click();

  await expect(page.locator('#fb-error')).toHaveText('This site does not have a limit.');
  await expect(page.getByRole('button', { name: '1 more min' })).toBeEnabled();
});

test('a page that asks you to confirm before leaving cannot keep the tab', async ({ context, ext }) => {
  await setLimit(ext, LIMITED, 2);
  const page = await context.newPage();
  await page.goto(url(LIMITED, 'clingy.html'));
  await page.bringToFront();
  // A beforeunload handler only counts once the page has been interacted with.
  await page.locator('h1').click();
  await expect(overlay(page)).toBeVisible({ timeout: 20000 });

  await page.getByRole('button', { name: 'Close tab' }).click();
  expect(await waitForClose(page)).toBe(true);
});
