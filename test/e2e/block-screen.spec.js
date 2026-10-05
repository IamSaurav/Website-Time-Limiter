import { LIMITED, expect, setUsage, test, url } from './fixtures.js';

const overlay = (page) => page.locator('#timeBlockerOverlay');

// One hour set, one hour seventeen spent, time added three times already.
const DAY = { limit: 3600, spent: 4620, overrides: 3 };

test('the block screen reads the day back exactly', async ({ context, ext }) => {
  await setUsage(ext, LIMITED, DAY);
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 760 });
  await page.goto(url(LIMITED));
  await page.bringToFront();
  await expect(overlay(page)).toBeVisible({ timeout: 20000 });

  await expect(page.getByText('1 hour 17 mins', { exact: true })).toBeVisible();
  await expect(page.getByText('17 mins over', { exact: true })).toBeVisible();
  await expect(overlay(page)).toContainText('Ignored 3 times today.');
  // Near midnight there is no hour part left, so both shapes have to pass.
  await expect(overlay(page)).toContainText(/Resets in \d+ (hours?|mins?)/);
  await expect(page.getByRole('heading', { name: "Time's up" })).toBeVisible();
  await expect(page.getByRole('button', { name: '1 more min' })).toBeVisible();
  await expect(page.getByRole('button', { name: '15 more mins' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close tab' })).toBeVisible();

  await page.waitForTimeout(400);
  await page.screenshot({ path: 'screenshots/block-screen.png' });
});

test('the block screen holds together in a narrow window', async ({ context, ext }) => {
  await setUsage(ext, LIMITED, DAY);
  const page = await context.newPage();
  await page.setViewportSize({ width: 420, height: 720 });
  await page.goto(url(LIMITED));
  await page.bringToFront();
  await expect(overlay(page)).toBeVisible({ timeout: 20000 });

  // Every control has to stay reachable and nothing may run off the side.
  for (const name of ['1 more min', '15 more mins', 'Close tab']) {
    const box = await page.getByRole('button', { name }).boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(420);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }

  await page.waitForTimeout(400);
  await page.screenshot({ path: 'screenshots/block-screen-narrow.png' });
});
