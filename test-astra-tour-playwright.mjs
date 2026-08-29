import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
try {
  async function openFinalStep() {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.route('**/api/search?**', (route) => route.fulfill({
      json: { results: [{ url: 'https://example.com/result', title: 'Result one', description: 'A result.' }] },
    }));
    await page.route('**/api/summary?**', (route) => route.fulfill({ json: { summary: 'Inline summary.' } }));
    await page.route('**/api/suggest?**', (route) => route.fulfill({ json: [] }));
    await page.route('**/v1/chat/completions', (route) => route.fulfill({ status: 503, body: '' }));
    await page.goto('file:///C:/Users/okemo/Desktop/Projects/web%20projects/web/search/index.html');
    await page.locator('#tour-sure').click();
    await page.locator('#result-1').waitFor();
    assert.equal(await page.locator('#tour-target-action').isVisible(), false);
    await page.locator('#tour-next').click();
    assert.equal(await page.locator('#tour-target-action').isVisible(), false);
    await page.locator('#tour-next').click();
    return page;
  }

  const pointerPage = await openFinalStep();
  const action = pointerPage.getByRole('button', { name: 'Open the first result site brief' });
  assert.equal(await action.count(), 1);
  await action.click();
  assert.equal(await pointerPage.locator('#result-1 .summary-hit').getAttribute('aria-expanded'), 'true');
  assert.equal(await pointerPage.locator('#tour-next').isEnabled(), true);
  await pointerPage.close();

  const keyboardPage = await openFinalStep();
  const keyboardAction = keyboardPage.getByRole('button', { name: 'Open the first result site brief' });
  await keyboardAction.focus();
  await keyboardAction.press('Enter');
  assert.equal(await keyboardPage.locator('#result-1 .summary-hit').getAttribute('aria-expanded'), 'true');
  assert.equal(await keyboardPage.locator('#tour-next').isEnabled(), true);
  await keyboardPage.close();

  const mobilePage = await browser.newPage({ viewport: { width: 320, height: 420 } });
  await mobilePage.route('**/api/search?**', (route) => route.fulfill({
    json: { results: [{ url: 'https://example.com/result', title: 'A long result title for narrow mobile screens', description: 'A result.' }] },
  }));
  await mobilePage.route('**/api/summary?**', (route) => route.fulfill({ json: { summary: 'A longer inline summary that wraps across multiple lines on a narrow screen.' } }));
  await mobilePage.route('**/api/suggest?**', (route) => route.fulfill({ json: [] }));
  await mobilePage.route('**/v1/chat/completions', (route) => route.fulfill({ status: 503, body: '' }));
  await mobilePage.goto('file:///C:/Users/okemo/Desktop/Projects/web%20projects/web/search/index.html');
  await mobilePage.addStyleTag({ content: 'html { font-size: 150%; }' });
  await mobilePage.locator('#tour-sure').click();
  await mobilePage.locator('#result-1').waitFor();
  const tourBox = await mobilePage.locator('.tour-card').boundingBox();
  assert(tourBox && tourBox.y >= 0 && tourBox.y + tourBox.height <= 420, 'mobile tour card must fit the visual viewport');
  await mobilePage.locator('#tour-exit').click();
  await mobilePage.locator('#result-1 .summary-hit').focus();
  await mobilePage.keyboard.press('Enter');
  await mobilePage.locator('#result-1 .result-summary-body:not([hidden])').waitFor();
  const visitBox = await mobilePage.locator('#result-1 .result-summary-visit').boundingBox();
  const summaryBox = await mobilePage.locator('#result-1 .result-summary').boundingBox();
  assert(visitBox && summaryBox && visitBox.y + visitBox.height <= summaryBox.y + summaryBox.height, 'Visit website must remain inside the expanded brief');
  assert.equal(await mobilePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await mobilePage.close();
  console.log('ok - guided final action is accessible and opens the real inline summary by pointer and Enter');
} finally {
  await browser.close();
}
