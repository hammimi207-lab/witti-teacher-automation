/* eslint-disable @typescript-eslint/no-require-imports -- Explicit, isolated production smoke test; removes its own fixtures. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { parseEnv } = require("node:util");
const { randomUUID, randomBytes, createHmac } = require("node:crypto");
const { chromium } = require("playwright");
const { createClient } = require("@supabase/supabase-js");

const base = "https://girok-fairy-v2.vercel.app";
const env = parseEnv(fs.readFileSync(require("node:path").join(__dirname, "../.env.local"), "utf8"));
const secret = env.SUPABASE_SERVICE_ROLE_KEY || env.service_role_key;
if (!env.NEXT_PUBLIC_SUPABASE_URL || !secret) throw new Error("Production test Supabase credentials are unavailable");
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, secret);
const nonce = randomBytes(5).toString("hex");
const email = `codex-play-${nonce}@example.com`;
const password = randomBytes(24).toString("hex");
const username = `play_${nonce}`;
const receiptId = randomUUID();
let userId, browser, fragmentId, cleanupError, receiptCreated = false;

async function check(result, label) { if (result.error) throw new Error(`${label}: ${result.error.code || result.error.message}`); return result.data; }
async function main() {
  try {
    const auth = await check(await db.auth.admin.createUser({ email, password, email_confirm: true }), "create test user");
    userId = auth.user.id;
    await check(await db.from("subscribers").insert({ user_id: userId, username, platform_member_id: username, email, display_name: "Temporary play smoke test", subscriber_name: "Temporary play smoke test", role: "teacher", is_active: true, deleted: false }), "create test profile");
    const consentSource = fs.readFileSync(require("node:path").join(__dirname, "../src/lib/confidentiality-terms.ts"), "utf8");
    const version = consentSource.match(/CONSENT_VERSION = "([^"]+)"/)?.[1];
    assert.ok(version);
    await check(await db.storage.from("girok-consents").upload(`${receiptId}.json`, JSON.stringify({ id: receiptId, email, name: "Temporary play smoke test", institution: "TEST", version, ndaAccepted: true, privacyAccepted: true, acceptedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 3600000).toISOString(), nda: "AUTOMATED TEST FIXTURE - NOT A REAL AGREEMENT", privacy: "TEST FIXTURE", identityVerified: false }), { contentType: "application/json" }), "create test receipt");
    receiptCreated = true;
    const token = `${receiptId}.${createHmac("sha256", secret).update(`girok-consent|${receiptId}`).digest("hex")}`;
    browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] });
    const context = await browser.newContext({ permissions: ["microphone"] });
    await context.addCookies([{ name: "girok-consent", value: token, url: base }]);
    const login = await context.request.post(`${base}/api/auth/login`, { headers: { origin: base }, data: { identifier: username, password } });
    assert.equal(login.status(), 200, `login: ${login.status()}`);
    const page = await context.newPage();
    await page.goto(base, { waitUntil: "domcontentloaded" });
    assert.equal(new URL(page.url()).pathname, "/", "test account must reach home");
    await page.getByRole("button", { name: /관찰 녹음/ }).click();
    const next = page.getByRole("group", { name: "다음 녹음의 놀이" });
    await next.getByRole("button", { name: "새 놀이 만들기" }).click();
    await next.getByLabel("새 놀이명").fill(`QA 블록 놀이 ${nonce}`);
    await next.getByRole("button", { name: "추가하고 선택" }).click();
    await next.getByRole("radio", { name: `QA 블록 놀이 ${nonce}` }).waitFor();
    await page.getByRole("button", { name: "녹음 시작" }).click();
    await page.getByRole("button", { name: "종료", exact: true }).waitFor();
    await page.waitForTimeout(1200);
    await page.getByRole("button", { name: "종료", exact: true }).click();
    await page.getByRole("button", { name: "전사하지 않고 저장" }).click();
    const group = page.getByRole("group", { name: "이 녹음을 어떤 놀이와 연결할까요?" }).first();
    await group.getByRole("radio", { name: `QA 블록 놀이 ${nonce}` }).waitFor();
    await page.waitForFunction(() => document.querySelector('.observation-play-choice input[name^="play-"]:checked')?.parentElement?.textContent?.includes("QA 블록 놀이"));
    const fragments = await check(await db.from("record_fragments").select("fragment_id").eq("user_id", userId).eq("record_type", "voice"), "read test recording");
    assert.equal(fragments.length, 1);
    fragmentId = fragments[0].fragment_id;
    const playback = await context.request.get(`${base}/api/observations/recordings/${fragmentId}`);
    assert.equal(playback.status(), 200, "saved original audio must be readable");
    assert.match(playback.headers()["content-type"] || "", /audio\//);
    assert.ok((await playback.body()).length > 0, "saved original audio must have bytes");
    let links = await check(await db.from("play_fragment_links").select("cluster_id,link_source,confirmed_at").eq("user_id", userId).eq("fragment_id", fragmentId), "read initial link");
    assert.equal(links.length, 1);
    assert.equal(links[0].link_source, "teacher");
    assert.ok(links[0].confirmed_at);
    await page.getByRole("button", { name: "관찰 녹음 닫기" }).click();
    await page.getByRole("button", { name: /관찰 녹음/ }).click();
    await page.waitForFunction(title => [...document.querySelectorAll('.observation-play-choice input[name^="play-"]:checked')].some(input => input.parentElement?.textContent?.includes(title)), `QA 블록 놀이 ${nonce}`);
    const unlinkResponse = page.waitForResponse(response => response.url().endsWith("/api/observations/plays") && response.request().method() === "POST" && response.request().postDataJSON()?.action === "unlink");
    await group.getByRole("radio", { name: "아직 연결하지 않기" }).click();
    const unlink = await unlinkResponse;
    assert.equal(unlink.status(), 200, `unlink: ${unlink.status()} ${JSON.stringify(await unlink.json())}`);
    links = await check(await db.from("play_fragment_links").select("cluster_id").eq("user_id", userId).eq("fragment_id", fragmentId), "read removed link");
    assert.equal(links.length, 0);
    await check(await db.from("record_transcriptions").insert({ fragment_id: fragmentId, user_id: userId, raw_transcription: "블록으로 길을 만들고 자동차를 움직였어요", model: "test-fixture" }), "create test transcription");
    await page.getByRole("button", { name: "관찰 녹음 닫기" }).click();
    await page.getByRole("button", { name: /관찰 녹음/ }).click();
    const reloaded = page.getByRole("group", { name: "이 녹음을 어떤 놀이와 연결할까요?" }).first();
    await reloaded.getByRole("button", { name: "AI 놀이 후보 보기" }).waitFor();
    await reloaded.getByLabel("후보 제안에 참고할 교사 메모").fill("블록으로 길을 만든 뒤 자동차를 움직였어요");
    await reloaded.getByRole("button", { name: "AI 놀이 후보 보기" }).click();
    const candidate = reloaded.locator(".observation-play-suggestion").first();
    await candidate.waitFor({ timeout: 60000 });
    const suggestedTitle = await candidate.locator("strong").textContent();
    assert.ok(suggestedTitle?.trim());
    const chosenResponse = page.waitForResponse(response => response.url().endsWith("/api/observations/plays") && response.request().method() === "POST" && response.request().postDataJSON()?.action === "link");
    await candidate.getByRole("button", { name: "이 놀이 선택" }).click();
    const chosen = await chosenResponse;
    assert.equal(chosen.status(), 200, `AI choice: ${chosen.status()} ${JSON.stringify(await chosen.json())}`);
    links = await check(await db.from("play_fragment_links").select("cluster_id,link_source,confirmed_at").eq("user_id", userId).eq("fragment_id", fragmentId), "read teacher AI choice");
    assert.equal(links.length, 1);
    assert.equal(links[0].link_source, "teacher");
    assert.ok(links[0].confirmed_at);
    await page.getByRole("button", { name: "관찰 녹음 닫기" }).click();
    await page.getByRole("button", { name: /관찰 녹음/ }).click();
    await page.waitForFunction(title => [...document.querySelectorAll('.observation-play-choice input[name^="play-"]:checked')].some(input => input.parentElement?.textContent?.includes(title)), suggestedTitle);
    const changed = page.getByRole("group", { name: "이 녹음을 어떤 놀이와 연결할까요?" }).first();
    await changed.getByRole("button", { name: "새로운 놀이로 만들기" }).click();
    await changed.getByLabel("새 놀이명").fill(`QA 변경 놀이 ${nonce}`);
    const changeResponse = page.waitForResponse(response => response.url().endsWith("/api/observations/plays") && response.request().method() === "POST" && response.request().postDataJSON()?.action === "link");
    await changed.getByRole("button", { name: "추가하고 연결" }).click();
    assert.equal((await changeResponse).status(), 200);
    links = await check(await db.from("play_fragment_links").select("cluster_id,link_source,confirmed_at").eq("user_id", userId).eq("fragment_id", fragmentId), "read changed link");
    assert.equal(links.length, 1);
    const changedPlay = await check(await db.from("play_clusters").select("title").eq("user_id", userId).eq("cluster_id", links[0].cluster_id).single(), "read changed play");
    assert.equal(changedPlay.title, `QA 변경 놀이 ${nonce}`);
    process.stdout.write(JSON.stringify({ deployedHome: true, originalAudioReadable: true, recordingSaved: true, initialLinkPersistsAfterReopen: true, unlink: true, aiSuggestion: true, aiChoiceConfirmedByTeacher: true, choicePersistsAfterReopen: true, changedToNewPlay: true }) + "\n");
    await context.close();
  } finally {
    if (browser) await browser.close();
    if (userId) {
      const audio = await db.from("record_audio").select("storage_bucket,storage_path").eq("user_id", userId);
      if (audio.error) cleanupError = audio.error;
      for (const item of audio.data || []) { const result = await db.storage.from(item.storage_bucket).remove([item.storage_path]); if (result.error) cleanupError = result.error; }
      for (const table of ["play_fragment_links", "record_transcriptions", "record_fragments", "play_clusters", "subscribers"]) {
        const result = await db.from(table).delete().eq("user_id", userId); if (result.error) cleanupError = result.error;
      }
      const auth = await db.auth.admin.deleteUser(userId); if (auth.error) cleanupError = auth.error;
    }
    if (receiptCreated) { const receipt = await db.storage.from("girok-consents").remove([`${receiptId}.json`]); if (receipt.error) cleanupError = receipt.error; }
    if (cleanupError) process.stderr.write(`Fixture cleanup incomplete: ${cleanupError.code || cleanupError.message}\n`);
    else process.stdout.write("Temporary production fixtures cleaned\n");
  }
}
main().catch(error => { process.stderr.write(`${error.stack || error.message}\n`); process.exitCode = 1; });
