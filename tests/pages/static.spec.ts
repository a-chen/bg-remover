import { expect, test } from '@playwright/test';

test('production assets work under a repository path without isolation headers', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  const response = await page.goto('./');
  expect(response?.headers()['cross-origin-opener-policy']).toBeUndefined();
  expect(await page.evaluate(() => window.crossOriginIsolated)).toBe(false);
  await expect(page.getByRole('heading', { name: 'Image background remover' })).toBeVisible();
  expect(await page.locator('#drop-zone').evaluate(el => getComputedStyle(el).display)).toBe('flex');
  const chooser = page.waitForEvent('filechooser');
  await page.locator('#drop-zone').click();
  await chooser;
  expect(errors).toEqual([]);
  expect(await page.locator('meta[name="referrer"]').getAttribute('content')).toBe('no-referrer');
  for (const file of ['LICENSE.md', 'THIRD_PARTY_NOTICES.md', 'IMG-LY-ThirdPartyLicenses.json']) {
    const notice = await page.request.get(file);
    expect(notice.ok()).toBe(true);
  }
  if (process.env.GITHUB_REPOSITORY) {
    await expect(page.getByRole('link', { name: 'Source code · AGPL-3.0' })).toHaveAttribute('href', `https://github.com/${process.env.GITHUB_REPOSITORY}`);
  }
});

test('real inference works on a Pages-like host', async ({ page }) => {
  test.skip(!process.env.RUN_MODEL_TEST, 'Opt in to the external model download with RUN_MODEL_TEST=1');
  await page.goto('./');
  await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ddd';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#18724b';
    ctx.fillRect(40, 20, 48, 88);
    const blob = await new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!)));
    const data = new DataTransfer();
    data.items.add(new File([blob], 'smoke.png', { type: 'image/png' }));
    window.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, cancelable: true }));
  });
  await expect(page.locator('#copy-button')).toBeVisible({ timeout: 150_000 });
  expect(await page.locator('#result-preview').evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(128);
});
