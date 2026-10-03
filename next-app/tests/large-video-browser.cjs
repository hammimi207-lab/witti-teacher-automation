/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const ts = require('typescript'), { chromium } = require('playwright');
test('84.3MB MP4 is reduced locally to WAV and eight frames below API limit', { timeout: 90000 }, async () => {
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/features/home/prepare-observation-video.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const fixture = fs.readFileSync(path.join(__dirname, '../../outputs/observation-video-fixture.mp4'));
  const server = http.createServer((req, res) => { if (req.url === '/fixture') { res.end(fixture); } else { res.setHeader('Content-Type', 'text/html'); res.end('<script>var exports={};' + source + '</script>'); } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const result = await page.evaluate(async () => {
      const bytes = await (await fetch('/fixture')).arrayBuffer();
      const file = new File([bytes, new Uint8Array(88473624 - bytes.byteLength)], 'large.mp4', { type: 'video/mp4' });
      const form = await exports.prepareObservationVideo(file);
      const audio = form.get('audio'), frames = form.getAll('frames');
      const wav = new DataView(await audio.arrayBuffer());
      return { original: file.size, hasVideo: form.has('video'), mime: audio.type, rate: wav.getUint32(24, true), frames: frames.length, total: audio.size + frames.reduce((sum, frame) => sum + frame.size, 0) };
    });
    assert.equal(result.original, 88473624); assert.equal(result.hasVideo, false);
    assert.equal(result.mime, 'audio/wav'); assert.equal(result.rate, 16000);
    assert.equal(result.frames, 8); assert.ok(result.total < 3900000);
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
});
