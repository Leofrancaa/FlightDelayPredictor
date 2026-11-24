// Offline export: drives the page frame by frame and saves JPEGs + the event log.
import puppeteer from 'puppeteer-core';
import fs from 'fs';
const [,, url, outDir = '/tmp/frames', maxFrames = '999999', w = '1280', h = '720'] = process.argv;
fs.mkdirSync(outDir, { recursive: true });
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 0,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage(); await p.setViewport({ width: +w, height: +h });
p.on('pageerror', (e) => console.log('PAGEERR', e.message));
await p.goto(url, { waitUntil: 'load', timeout: 0 });
await p.waitForFunction('window.__ready===true', { timeout: 0, polling: 500 });
let n = fs.readdirSync(outDir).filter((f) => f.endsWith('.jpg')).length; // resume support
if (n) { console.log('resuming at', n); await p.evaluate((k) => { for (let i = 0; i < k; i++) window.__frame(); }, n); }
const t0 = Date.now();
while (n < +maxFrames) {
  const [data, fin] = await p.evaluate(() => [window.__frame(), window.__finished]);
  fs.writeFileSync(`${outDir}/${String(n).padStart(5, '0')}.jpg`, Buffer.from(data.split(',')[1], 'base64'));
  n++;
  if (n % 60 === 0) { console.log(n, 'frames', ((Date.now() - t0) / 1000 / (n)).toFixed(2), 's/frame'); fs.writeFileSync(outDir + '/events.json', JSON.stringify(await p.evaluate(() => window.__events))); }
  if (fin) { console.log('finished at', fin, 'frames', n); break; }
}
fs.writeFileSync(outDir + '/events.json', JSON.stringify(await p.evaluate(() => window.__events), null, 1));
await b.close();
