// One-off README screenshot capture. Drives the live app at http://127.0.0.1:5173
// through the real onboarding → create → brief → campaign flow and writes PNGs
// to docs/screenshots/. Uses the system Chrome via puppeteer-core. Not part of
// the app; safe to delete.
import puppeteer from "puppeteer-core";
import { fileURLToPath } from "node:url";
import path from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = "http://127.0.0.1:5173/";
const EDM = "camp_1780480854214_edm_party_for_babies";
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../docs/screenshots");

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    defaultViewport: { width: 1512, height: 945, deviceScaleFactor: 2 },
    args: ["--no-sandbox", "--force-color-profile=srgb"],
  });
  const page = await browser.newPage();
  const shot = async (name) => {
    await page.screenshot({ path: path.join(OUT, name) });
    console.log("captured", name);
  };
  const goto = async (url) => { await page.goto(url, { waitUntil: "networkidle2" }); await sleep(1200); };
  const waitFor = (sel, t = 90000) => page.waitForSelector(sel, { visible: true, timeout: t });

  // 1 — Immersive landing (default surface; note the "claude cli" pill).
  await goto(BASE);
  await waitFor(".im-input, .im-needs-key");
  await sleep(1500); // let orbit names settle
  await shot("01-immersive-landing.png");

  // 2 — Onboarding: API keys & model modal (opened from the model pill).
  await page.click(".im-model");
  await waitFor(".key-modal");
  await sleep(600);
  await shot("02-onboarding-keys.png");
  await page.click(".key-modal .modal-head .icon-btn");
  await sleep(400);

  // 3 — Immersive: type an idea, draft the brief (real Claude CLI call).
  await page.click(".im-input");
  await page.type(".im-input",
    "i keep hearing indie game studios waste weeks scheduling playtesters and the feedback comes back messy and unstructured");
  await sleep(300);
  await page.keyboard.press("Enter");
  await waitFor(".im-begin", 120000); // brief_review phase
  await sleep(1600); // let fields fade in
  await shot("03-immersive-brief.png");

  // 4 — Normal mode: project (campaign) list. Reload to reset to immersive
  // idle, then exit immersive (idle exit → campaign list).
  await goto(BASE);
  await waitFor(".im-input, .im-needs-key");
  await page.click(".im-exit");
  await waitFor(".home-shell");
  await sleep(800);
  await shot("04-campaign-list.png");

  // 5 — Normal mode: create new campaign (conversation step).
  await page.click(".home-primary");
  await waitFor(".campaign-start .cos-mini-thread textarea");
  await sleep(700);
  await shot("05-new-campaign.png");

  // 6 — Normal mode: brief generated from notes (real Claude CLI call).
  await page.type(".cos-mini-thread textarea",
    "freelance designers tell me they lose hours every week writing client proposals from scratch. they copy old ones and tweak. some use google docs, some notion. they hate pricing themselves.");
  await sleep(300);
  await page.click(".cos-mini-thread .btn.primary");
  await waitFor(".translation-note", 120000);
  await sleep(1200);
  await shot("06-brief-normal.png");

  // 7 — Immersive mode: a live campaign (orbit of items around the ledger).
  await goto(BASE + "?campaign=" + EDM);
  await waitFor(".im-orbit-item, .im-ledger", 60000);
  await sleep(2000); // orbit settle
  await shot("07-campaign-immersive.png");

  // 8 — Normal/cockpit mode: the same campaign's main page.
  await page.click(".im-view-details");
  await waitFor(".app-shell");
  await sleep(2500); // canvas render
  await shot("08-campaign-cockpit.png");

  await browser.close();
  console.log("done");
}

main().catch(e => { console.error(e); process.exit(1); });
