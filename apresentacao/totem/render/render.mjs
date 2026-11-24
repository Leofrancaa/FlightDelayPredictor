// Renderiza a animação do totem em MP4 (vídeo + áudio + legendas) usando a GPU deste PC.
//
//   cd apresentacao/totem/render
//   npm install
//   node render.mjs                 # 1080p, 30 fps
//   node render.mjs --res 720       # 720p
//   node render.mjs --sem-legenda   # sem legendas queimadas
//
// Saída: apresentacao/totem/render/saida/totem.mp4
import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer-core';
import ffmpegPath from 'ffmpeg-static';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.resolve(AQUI, '../../../web/public/totem');
const SAIDA = path.join(AQUI, 'saida');
const FRAMES = path.join(SAIDA, 'frames');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
const RES = +arg('--res', 1080), FPS = +arg('--fps', 30), W = Math.round(RES * 16 / 9), H = RES;
const LEGENDA = !process.argv.includes('--sem-legenda'), CPU = process.argv.includes('--cpu');
const MAX = +arg('--max', 1e9);

// ---------- navegador (Chrome ou Edge instalados)
const candidatos = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  path.join(os.homedir(), 'AppData/Local/Google/Chrome/Application/chrome.exe'),
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].filter(Boolean);
const browserPath = candidatos.find((p) => fs.existsSync(p));
if (!browserPath) { console.error('Não achei Chrome/Edge. Defina CHROME_PATH com o caminho do executável.'); process.exit(1); }

// ---------- servidor local dos arquivos da animação
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.glb': 'model/gltf-binary', '.txt': 'text/plain' };
const server = http.createServer((req, res) => {
  const p = path.join(SITE, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
  if (!p.startsWith(SITE) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
}).listen(0);
const PORT = server.address().port;

// ---------- frames
fs.rmSync(FRAMES, { recursive: true, force: true }); fs.mkdirSync(FRAMES, { recursive: true });
const flags = ['--autoplay-policy=no-user-gesture-required', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'];
if (CPU) flags.push('--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox');
const browser = await puppeteer.launch({ executablePath: browserPath, headless: 'new', protocolTimeout: 0, args: flags });
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('ERRO NA PÁGINA:', e.message));
console.log('navegador:', browserPath);
await page.goto(`http://localhost:${PORT}/index.html?export=1&q=high&fps=${FPS}`, { waitUntil: 'load', timeout: 0 });
await page.waitForFunction('window.__ready===true', { timeout: 0, polling: 300 });
const gpu = await page.evaluate(() => { const g = document.createElement('canvas').getContext('webgl2'); const d = g?.getExtension('WEBGL_debug_renderer_info'); return d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : '?'; });
console.log('GPU:', gpu, `| ${W}x${H} @ ${FPS} fps`);
if (/swiftshader|llvmpipe|software/i.test(gpu) && !CPU) console.log('AVISO: o navegador está renderizando sem GPU; vai demorar bem mais.');

const t0 = Date.now(); let n = 0;
for (;;) {
  const [data, fim] = await page.evaluate(() => [window.__frame(), window.__finished]);
  fs.writeFileSync(path.join(FRAMES, String(n).padStart(5, '0') + '.jpg'), Buffer.from(data.split(',')[1], 'base64'));
  n++;
  if (n % (FPS * 5) === 0) process.stdout.write(`\r${(n / FPS).toFixed(0)} s de vídeo · ${((Date.now() - t0) / n).toFixed(0)} ms/frame   `);
  if (fim || n >= MAX) break;
}
const events = await page.evaluate(() => window.__events);
await browser.close(); server.close();
const DUR = n / FPS;
console.log(`\n${n} frames (${DUR.toFixed(1)} s)`);
fs.writeFileSync(path.join(SAIDA, 'events.json'), JSON.stringify(events, null, 1));

// ---------- áudio: falas + ambiente + trovões, nos tempos registrados
const run = (args) => { const r = spawnSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { cwd: SAIDA, stdio: 'inherit' }); if (r.status) throw new Error('ffmpeg falhou'); };
run(['-f', 'lavfi', '-i', 'anoisesrc=color=brown:amplitude=0.9:duration=5', '-af', 'lowpass=f=220,afade=t=in:d=0.12,afade=t=out:st=0.6:d=4.2,volume=3', 'trovao.wav']);
const ins = [], fil = [];
const add = (inputArgs, filter) => { ins.push(...inputArgs); fil.push(`[${fil.length}:a]${filter}[a${fil.length}]`); };
add(['-stream_loop', '-1', '-i', path.join(SITE, 'audio/murmur.mp3')], `atrim=0:${DUR},volume=0.22`);
add(['-f', 'lavfi', '-i', `anoisesrc=color=white:amplitude=1:duration=${DUR}`], 'lowpass=f=1400,volume=0.012');
for (const e of events.filter((e) => e.type === 'line' && e.file && e.t < DUR)) {
  const ms = Math.round(e.t * 1000);
  add(['-i', path.join(SITE, 'audio', e.file)], `adelay=${ms}|${ms},volume=1.0`);
}
for (const e of events.filter((e) => e.type === 'thunder' && e.t < DUR)) {
  const ms = Math.round(e.t * 1000);
  add(['-i', 'trovao.wav'], `adelay=${ms}|${ms},volume=0.05`);
}
const k = fil.length;
run([...ins, '-filter_complex', `${fil.join(';')};${Array.from({ length: k }, (_, i) => `[a${i}]`).join('')}amix=inputs=${k}:normalize=0:duration=longest,atrim=0:${DUR},alimiter=limit=0.95[out]`, '-map', '[out]', '-ar', '48000', '-ac', '2', 'audio.wav']);

// ---------- legendas (ASS)
const ts = (s) => { const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = (s % 60).toFixed(2).padStart(5, '0'); return `${h}:${String(m).padStart(2, '0')}:${x}`; };
const fs_ = Math.round(H / 22);
let ass = `[Script Info]\nScriptType: v4.00+\nPlayResX: ${W}\nPlayResY: ${H}\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n`;
ass += `Style: Fala,Segoe UI,${fs_},&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,${Math.max(2, fs_ / 14)},1,2,${W * 0.14},${W * 0.14},${H * 0.05},1\n`;
ass += `Style: Titulo,Segoe UI Light,${Math.round(H / 11)},&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,5,10,10,0,1\n`;
ass += `Style: Sub,Segoe UI,${Math.round(H / 34)},&H00D9B39F,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,8,10,10,${H * 0.58},1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
if (LEGENDA) for (const e of events.filter((e) => e.type === 'line')) {
  const quem = e.who === 'prof' ? 'SOUSSA' : 'GUIS';
  ass += `Dialogue: 0,${ts(e.t)},${ts(Math.min(DUR, e.t + e.dur + 0.2))},Fala,,0,0,0,,{\\fs${Math.round(fs_ * 0.55)}\\c&HFFD39F&}${quem}\\N{\\fs${fs_}\\c&HFFFFFF&}${e.text}\n`;
}
const fim = events.find((e) => e.type === 'end');
if (fim) {
  ass += `Dialogue: 1,${ts(fim.t + 0.4)},${ts(DUR)},Titulo,,0,0,0,,{\\fad(1000,0)}${fim.title}\n`;
  ass += `Dialogue: 1,${ts(fim.t + 1.6)},${ts(DUR)},Sub,,0,0,0,,{\\fad(1000,0)}${fim.sub.join('\\N')}\n`;
}
fs.writeFileSync(path.join(SAIDA, 'legendas.ass'), ass);

// ---------- MP4
run(['-framerate', String(FPS), '-i', 'frames/%05d.jpg', '-i', 'audio.wav', '-vf', 'subtitles=legendas.ass,format=yuv420p',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', 'totem.mp4']);
console.log('pronto:', path.join(SAIDA, 'totem.mp4'));
