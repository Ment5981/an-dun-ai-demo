import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const output = path.join(root, "tmp", "qa");
await mkdir(output, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
});

const consoleErrors = [];
const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
desktop.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});

await desktop.goto("http://127.0.0.1:5173", { waitUntil: "networkidle" });
await desktop.waitForTimeout(450);
await desktop.screenshot({ path: path.join(output, "01-workbench.png"), fullPage: true });

await desktop.getByRole("button", { name: "AI 智能报案", exact: true }).click();
await desktop.waitForTimeout(650);
await desktop.screenshot({ path: path.join(output, "02-intake.png"), fullPage: true });
await desktop.getByRole("button", { name: "开始智能分析", exact: true }).click();
await desktop.waitForTimeout(1100);
await desktop.getByRole("button", { name: "寄件人本人", exact: true }).click();
await desktop.getByRole("button", { name: "签收后 20 分钟", exact: true }).click();
await desktop.getByRole("button", { name: "提交关键信息", exact: true }).click();
await desktop.waitForTimeout(350);
await desktop.screenshot({ path: path.join(output, "03-emergency.png"), fullPage: true });
await desktop.getByRole("button", { name: "创建案件并进入工作区", exact: true }).click();
await desktop.waitForTimeout(650);
await desktop.screenshot({ path: path.join(output, "04-case.png"), fullPage: true });
await desktop.getByRole("tab", { name: "风险", exact: true }).click();
await desktop.waitForTimeout(500);
await desktop.screenshot({ path: path.join(output, "05-risk.png"), fullPage: true });
await desktop.getByRole("tab", { name: "概览", exact: true }).click();
await desktop.waitForTimeout(500);
await desktop.getByRole("button", { name: "标记已固定", exact: true }).first().click();
await desktop.getByRole("heading", { name: "分拨中心监控已固定", exact: true }).waitFor();
await desktop.screenshot({ path: path.join(output, "05b-action-complete.png"), fullPage: true });
await desktop.getByRole("button", { name: /行动中心/ }).click();
await desktop.waitForTimeout(650);
await desktop.screenshot({ path: path.join(output, "06-actions.png"), fullPage: true });
await desktop.getByRole("button", { name: "管理驾驶舱", exact: true }).click();
await desktop.waitForTimeout(650);
await desktop.screenshot({ path: path.join(output, "07-insights.png"), fullPage: true });

const desktopMetrics = await desktop.evaluate(() => ({
  bodyWidth: document.body.scrollWidth,
  viewportWidth: document.documentElement.clientWidth,
  bodyHeight: document.body.scrollHeight,
  emptyButtons: Array.from(document.querySelectorAll("button")).filter((button) => !button.textContent?.trim() && !button.getAttribute("aria-label")).length,
  mainOpacity: getComputedStyle(document.querySelector("main > div") ?? document.body).opacity,
}));

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
mobile.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
await mobile.goto("http://127.0.0.1:5173", { waitUntil: "networkidle" });
await mobile.waitForTimeout(750);
await mobile.screenshot({ path: path.join(output, "08-mobile.png"), fullPage: true });
const mobileMetrics = await mobile.evaluate(() => ({
  bodyWidth: document.body.scrollWidth,
  viewportWidth: document.documentElement.clientWidth,
  bodyHeight: document.body.scrollHeight,
  mainOpacity: getComputedStyle(document.querySelector("main > div") ?? document.body).opacity,
}));

await browser.close();
console.log(JSON.stringify({ desktopMetrics, mobileMetrics, consoleErrors }, null, 2));
