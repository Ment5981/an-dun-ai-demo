import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const output = path.join(root, 'tmp', 'qa');
const baseUrl = process.env.QA_BASE || 'http://127.0.0.1:5173';
await mkdir(output, { recursive: true });
const executablePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browser = await chromium.launch({ headless: true, executablePath });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const consoleErrors = [];
page.on('console', message => { if (message.type() === 'error' && !message.text().includes('401')) consoleErrors.push(message.text()); });

async function login() {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await Promise.race([
    page.getByRole('button', { name: '进入工作台' }).waitFor(),
    page.getByRole('heading', { name: /案件工作台|我的案件工作台|法务工作台|我的现场工作台|网点案件指挥台|法务接收与复核/ }).waitFor(),
  ]);
  if (await page.getByRole('button', { name: '进入工作台' }).count()) await page.getByRole('button', { name: '进入工作台' }).click();
  await page.getByRole('heading', { name: /案件工作台|我的案件工作台|法务工作台|我的现场工作台|网点案件指挥台|法务接收与复核/ }).waitFor();
}
function assert(condition, message) { if (!condition) throw new Error(message); }
async function metrics() { return page.evaluate(() => ({ bodyWidth: document.body.scrollWidth, viewportWidth: innerWidth })); }

await login();
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(output, '01-workbench.png'), fullPage: true });
const workbenchMetrics = await metrics();
assert(workbenchMetrics.bodyWidth <= workbenchMetrics.viewportWidth + 1, 'desktop page has horizontal overflow');

await page.getByRole('main').getByRole('button', { name: '新建纠纷案件' }).click();
await page.getByRole('heading', { name: '新建纠纷案件' }).waitFor();
await page.getByRole('button', { name: '填入演示案情' }).click();
await page.screenshot({ path: path.join(output, '02-intake.png'), fullPage: true });

  await page.getByRole('navigation').getByRole('button', { name: /案件工作台|我的现场工作台|网点案件指挥台|法务接收与复核/ }).click();
  await page.getByRole('heading', { name: /案件工作台|我的现场工作台|网点案件指挥台|法务接收与复核/ }).waitFor();
await page.locator('button.case-title').first().click();
await page.getByRole('tab', { name: /AI 固证清单/ }).waitFor();
await page.screenshot({ path: path.join(output, '03-case-evidence.png'), fullPage: true });
await page.getByRole('tab', { name: '案情与责任研判' }).click();
await page.screenshot({ path: path.join(output, '04-case-risk.png'), fullPage: true });
await page.getByRole('tab', { name: '法律文书' }).click();
await page.screenshot({ path: path.join(output, '05-case-documents.png'), fullPage: true });

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
await mobile.goto(baseUrl, { waitUntil: 'networkidle' });
await Promise.race([
  mobile.getByRole('button', { name: '进入工作台' }).waitFor(),
  mobile.getByRole('heading', { name: /案件工作台|我的案件工作台|法务工作台|我的现场工作台|网点案件指挥台|法务接收与复核/ }).waitFor(),
]);
if (await mobile.getByRole('button', { name: '进入工作台' }).count()) await mobile.getByRole('button', { name: '进入工作台' }).click();
await mobile.getByRole('heading', { name: /案件工作台|我的案件工作台|法务工作台|我的现场工作台|网点案件指挥台|法务接收与复核/ }).waitFor();
const mobileMetrics = await mobile.evaluate(() => ({ bodyWidth: document.body.scrollWidth, viewportWidth: innerWidth }));
assert(mobileMetrics.bodyWidth <= mobileMetrics.viewportWidth + 1, 'mobile page has horizontal overflow');
await mobile.screenshot({ path: path.join(output, '06-mobile.png'), fullPage: true });

await browser.close();
console.log(JSON.stringify({ workbenchMetrics, mobileMetrics, consoleErrors }, null, 2));
if (consoleErrors.length) process.exitCode = 1;
