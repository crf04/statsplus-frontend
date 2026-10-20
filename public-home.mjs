// Signed-out public home through the helper's guarded Vite proxy: a fresh context has no Firebase session.
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire("/Users/chrisfu/.worktrees/statsplus-frontend-278/package.json");
const { chromium } = require("playwright");
const [origin, outDir, label, tickerName = "Today's games", headingName = "Tonight", games = "3"] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", args: ["--headless=new"] });
const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
const results = {};
let failed = false;
for (const [name, viewport] of [["desktop", { width: 1440, height: 900 }], ["phone", { width: 390, height: 844 }]]) {
  const context = await browser.newContext({ viewport, userAgent: ua });
  const page = await context.newPage();
  const responses = [];
  page.on("response", (r) => { const u = new URL(r.url()); if (u.pathname.startsWith("/api/")) responses.push({ method: r.request().method(), path: u.pathname, query: u.search, status: r.status() }); });
  await page.goto(origin + "/", { waitUntil: "networkidle" });
  const ticker = page.getByRole("navigation", { name: tickerName });
  await ticker.waitFor({ timeout: 30000 });
  await page.getByRole("heading", { name: headingName }).waitFor({ timeout: 30000 });
  await page.waitForTimeout(1500);
  const links = await ticker.locator("a").evaluateAll((as) => as.map((a) => ({ href: a.getAttribute("href"), text: a.textContent.trim() })));
  const signedOut = await page.getByText("Sign up", { exact: false }).count();
  const alerts = await page.getByRole("alert").allTextContents();
  const invalid = await page.getByText("invalid response", { exact: false }).count();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await page.screenshot({ path: `${outDir}/${label}-public-home-${name}.png`, fullPage: true });
  fs.writeFileSync(`${outDir}/${label}-public-home-${name}.aria.yml`, await page.locator("body").ariaSnapshot());
  const slate = responses.find((r) => r.path === "/api/games/slate");
  const pass = links.filter((l) => l.href?.startsWith("/matchups/")).length === Number(games) && invalid === 0 && alerts.length === 0 && slate?.status === 200 && overflow <= 0;
  if (!pass) failed = true;
  results[name] = { url: page.url(), viewport, tickerLinks: links, signUpMentions: signedOut, alerts, invalidResponseText: invalid, horizontalOverflowPx: overflow, responses, pass };
  await context.close();
}
await browser.close();
fs.writeFileSync(`${outDir}/${label}-public-home.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 1).slice(0, 3000));
process.exit(failed ? 1 : 0);
