import { expect, test, type Page } from '@playwright/test';

const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const fixture = { name: 'portrait.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') };

async function mockRemoval(page: Page) {
  await page.route(/\/node_modules\/.*(?:@imgly_background-removal|@imgly\/background-removal).*\.js/, route => route.fulfill({
    contentType: 'application/javascript',
    body: `export async function removeBackground(file, config) {
      window.__jobs = (window.__jobs || 0) + 1;
      config.progress('compute:inference', 0, 1);
      await new Promise(r => setTimeout(r, 200));
      if (window.__fail) throw new Error('Inference error');
      return new Blob([Uint8Array.from(atob('${png}'), c => c.charCodeAt(0))], {type: 'image/png'});
    }
    export default removeBackground;`,
  }));
}

async function pasteImage(page: Page) {
  await page.evaluate((base64) => {
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const data = new DataTransfer();
    data.items.add(new File([bytes], 'pasted.png', { type: 'image/png' }));
    window.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, cancelable: true }));
  }, png);
}

test.beforeEach(async ({ page }) => { await mockRemoval(page); await page.goto('/'); });

test('paste starts processing immediately and result can be copied as PNG', async ({ page }) => {
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      write: async (items: ClipboardItem[]) => {
        const blob = await items[0].getType('image/png');
        (window as any).__copiedType = blob.type;
      },
    } });
  });
  await pasteImage(page);
  await expect(page.locator('#copy-button')).toBeVisible();
  expect(await page.evaluate(() => (window as any).__jobs)).toBe(1);
  await page.locator('#copy-button').click();
  await expect(page.locator('#editor-status')).toContainText('copied');
  expect(await page.evaluate(() => (window as any).__copiedType)).toBe('image/png');
});

test('upload, compare, download and reset work', async ({ page }) => {
  await page.locator('#file-input').setInputFiles(fixture);
  await expect(page.locator('#result-preview')).toBeVisible();
  await page.locator('#show-original').click();
  await expect(page.locator('#original-preview')).toBeVisible();
  await page.locator('#show-result').click();
  await expect(page.locator('#result-preview')).toBeVisible();
  const download = page.waitForEvent('download');
  await page.locator('#download-button').click();
  expect((await download).suggestedFilename()).toBe('portrait-transparent.png');
  await page.locator('#reset-button').click();
  await expect(page.locator('#upload-view')).toBeVisible();
});

test('clicking empty space in the box opens the file picker', async ({ page }) => {
  const chooser = page.waitForEvent('filechooser');
  await page.locator('#drop-zone').click({ position: { x: 15, y: 15 } });
  await (await chooser).setFiles(fixture);
  await expect(page.locator('#copy-button')).toBeVisible();
});

test('invalid input shows actionable feedback', async ({ page }) => {
  await page.locator('#file-input').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image') });
  await expect(page.locator('#upload-feedback')).toContainText('PNG, JPEG, or WebP');
});

test('failed inference can be retried', async ({ page }) => {
  await page.evaluate(() => { (window as any).__fail = true; });
  await pasteImage(page);
  await expect(page.locator('#error-panel')).toBeVisible();
  await page.evaluate(() => { (window as any).__fail = false; });
  await page.locator('#retry-button').click();
  await expect(page.locator('#copy-button')).toBeVisible();
});

test('reset discards a pending result', async ({ page }) => {
  await pasteImage(page);
  await page.locator('#reset-button').click();
  await page.waitForTimeout(400);
  await expect(page.locator('#upload-view')).toBeVisible();
  await expect(page.locator('#result-actions')).toBeHidden();
});

test('blocked copy keeps the result available and offers download', async ({ page }) => {
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      write: async () => { throw new DOMException('Denied', 'NotAllowedError'); },
    } });
  });
  await pasteImage(page);
  await page.locator('#copy-button').click();
  await expect(page.locator('#editor-status')).toContainText('Use Download PNG');
  await expect(page.locator('#download-button')).toBeVisible();
});

test('drop also starts processing immediately', async ({ page }) => {
  await page.evaluate((base64) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([Uint8Array.from(atob(base64), c => c.charCodeAt(0))], 'dropped.png', { type: 'image/png' }));
    window.dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, cancelable: true }));
  }, png);
  await expect(page.locator('#copy-button')).toBeVisible();
  await expect(page.locator('#file-name')).toHaveText('dropped.png');
});

test('paste-first box offers upload from computer', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Image background remover' })).toBeVisible();
  await expect(page.locator('#drop-zone')).toContainText('Directly paste image here');
  const chooser = page.waitForEvent('filechooser');
  await page.locator('#drop-zone .drop-copy').click();
  await (await chooser).setFiles(fixture);
  await expect(page.locator('#copy-button')).toBeVisible();
});

for (const key of ['Escape', 'r']) {
  test(`${key} resets the result and focuses paste`, async ({ page }) => {
    await pasteImage(page);
    await expect(page.locator('#copy-button')).toBeVisible();
    await expect(page.locator('#reset-button')).toContainText('Esc / R');
    await page.keyboard.press(key);
    await expect(page.locator('#upload-view')).toBeVisible();
    await expect(page.locator('#drop-zone')).toBeFocused();
  });
}

test('reset shortcut ignores editable fields and modified keys', async ({ page }) => {
  await pasteImage(page);
  await expect(page.locator('#copy-button')).toBeVisible();
  await page.keyboard.press('Control+r');
  await expect(page.locator('#editor-view')).toBeVisible();
  await page.evaluate(() => {
    const input = document.createElement('input');
    input.id = 'typing-test';
    document.body.append(input);
    input.focus();
  });
  await page.keyboard.press('r');
  await expect(page.locator('#typing-test')).toHaveValue('r');
  await expect(page.locator('#editor-view')).toBeVisible();
});

test('additional details and inspiration credit sit below the main tool', async ({ page }) => {
  const about = page.getByRole('region', { name: 'A little more about this tool' });
  const bounds = await about.boundingBox();
  expect(bounds!.y).toBeGreaterThanOrEqual(page.viewportSize()!.height);
  await about.scrollIntoViewIfNeeded();
  await expect(about).toContainText('Background removal runs entirely in your browser');
  await expect(about).toContainText('Free, with no account or usage limits');
  await expect(about.getByRole('link', { name: 'LoneTools’ background remover' })).toHaveAttribute('href', 'https://lonetools.com/remove-background');
});

test('mobile layout fits and isolation headers are active', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => window.crossOriginIsolated)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await pasteImage(page);
  await expect(page.locator('#copy-button')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
