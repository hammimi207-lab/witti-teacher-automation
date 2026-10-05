/* eslint-disable @typescript-eslint/no-require-imports -- Read-only deployed-site browser check. */
const { chromium } = require("playwright");

async function main() {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const page = await browser.newPage();
    const response = await page.goto("https://girok-fairy-v2.vercel.app", { waitUntil: "domcontentloaded", timeout: 30000 });
    const result = {
      status: response?.status(),
      url: page.url(),
      title: await page.title(),
      headings: await page.locator("h1,h2").allTextContents(),
      recorderEntryVisible: await page.getByRole("button", { name: /관찰 녹음/ }).count() > 0,
      playChoiceVisible: await page.getByText("다음 녹음의 놀이", { exact: true }).count() > 0,
    };
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } finally { await browser.close(); }
}
main().catch(error => { process.stderr.write(error.message + "\n"); process.exitCode = 1; });
