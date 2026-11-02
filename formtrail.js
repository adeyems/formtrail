import { chromium } from 'playwright';
import { open } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export function validate(journey) {
  const exact = (obj, keys) => obj && typeof obj === 'object' && !Array.isArray(obj) &&
    Object.keys(obj).sort().join(',') === keys.sort().join(',');
  if (!exact(journey, ['version', 'steps']) || journey.version !== 1 ||
      !Array.isArray(journey.steps) || journey.steps.length < 1 || journey.steps.length > 50) {
    throw new Error('Invalid journey');
  }
  for (const step of journey.steps) {
    const keys = ['action', 'selector'];
    if (['fill', 'text'].includes(step?.action)) keys.push('value');
    if (!exact(step, keys) || !['fill', 'click', 'text', 'invalid'].includes(step.action) ||
        typeof step.selector !== 'string' || !step.selector || step.selector.length > 500 ||
        (keys.includes('value') && (typeof step.value !== 'string' || step.value.length > 4096))) {
      throw new Error('Invalid step');
    }
  }
}

export async function run(html, journey) {
  validate(journey);
  if (typeof html !== 'string' || Buffer.byteLength(html) > 262144) throw new Error('Invalid fixture');
  const browser = await chromium.launch();
  let context;
  const report = { version: 1, passed: false, steps: [], blockedRequests: 0 };
  try {
    context = await browser.newContext({ serviceWorkers: 'block', acceptDownloads: false });
    await context.route('**/*', async route => { report.blockedRequests++; await route.abort(); });
    await context.routeWebSocket('**/*', socket => socket.close());
    const page = await context.newPage();
    page.setDefaultTimeout(2000);
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 2000 });
    for (const [index, step] of journey.steps.entries()) {
      try {
        const locator = page.locator(step.selector);
        if (step.action === 'fill') await locator.fill(step.value);
        if (step.action === 'click') await locator.click();
        if (step.action === 'text') {
          await locator.waitFor({ state: 'visible' });
          if ((await locator.innerText()) !== step.value) throw new Error('Text mismatch');
        }
        if (step.action === 'invalid') {
          const invalid = await locator.evaluate(element =>
            typeof element.checkValidity === 'function' && !element.checkValidity());
          if (!invalid) throw new Error('Expected invalid control');
        }
        report.steps.push({ index: index + 1, action: step.action, passed: true });
      } catch {
        report.steps.push({ index: index + 1, action: step.action, passed: false });
        return report;
      }
    }
    report.passed = true;
    return report;
  } finally {
    if (context) await context.close();
    await browser.close();
  }
}

async function boundedRead(path) {
  const handle = await open(path, 'r');
  try {
    const bytes = Buffer.alloc(262145);
    let total = 0;
    while (total < bytes.length) {
      const { bytesRead } = await handle.read(bytes, total, bytes.length - total, null);
      if (!bytesRead) break;
      total += bytesRead;
    }
    if (total > 262144) throw new Error('File too large');
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, total));
  } finally { await handle.close(); }
}

async function main() {
  if (process.argv.length !== 4) {
    console.error('Usage: node formtrail.js FIXTURE.html JOURNEY.json');
    return 2;
  }
  try {
    const html = await boundedRead(process.argv[2]);
    const journey = JSON.parse(await boundedRead(process.argv[3]));
    const report = await run(html, journey);
    console.log(JSON.stringify(report));
    return report.passed ? 0 : 1;
  } catch {
    console.error(JSON.stringify({ error: 'Invalid input or browser setup failure' }));
    return 2;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main();
}
