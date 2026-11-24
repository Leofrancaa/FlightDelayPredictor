import * as THREE from 'three';

// Deterministic PRNG so the scene looks the same every run
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

function tex(c, { repeat = [1, 1], srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = aniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Polished terrazzo floor with large tiles: color + roughness
export function terrazzo() {
  const S = 1024, r = rng(7);
  const c = canvas(S, S), g = c.getContext('2d');
  g.fillStyle = '#c9c4bb'; g.fillRect(0, 0, S, S);
  // soft mottling
  for (let i = 0; i < 260; i++) {
    const x = r() * S, y = r() * S, rad = 40 + r() * 140;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    const v = 190 + (r() * 30 - 15) | 0;
    gr.addColorStop(0, `rgba(${v},${v - 4},${v - 10},0.25)`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // chips
  const cols = ['#8d8a85', '#f2efe9', '#5d5b58', '#a89f92', '#2f2e2c', '#d9d2c4', '#7a7f86'];
  for (let i = 0; i < 26000; i++) {
    g.fillStyle = cols[(r() * cols.length) | 0];
    const x = r() * S, y = r() * S, s = 0.6 + r() * r() * 5;
    g.beginPath();
    g.ellipse(x, y, s, s * (0.5 + r() * 0.6), r() * 3.14, 0, 6.283);
    g.fill();
  }
  // tile joints (texture spans 2 tiles)
  g.strokeStyle = 'rgba(90,86,80,0.55)'; g.lineWidth = 2;
  for (let k = 0; k <= 2; k++) {
    g.beginPath(); g.moveTo(k * S / 2, 0); g.lineTo(k * S / 2, S); g.stroke();
    g.beginPath(); g.moveTo(0, k * S / 2); g.lineTo(S, k * S / 2); g.stroke();
  }
  // roughness map
  const rc = canvas(512, 512), rg = rc.getContext('2d');
  rg.fillStyle = 'rgb(46,46,46)'; rg.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 400; i++) {
    const x = r() * 512, y = r() * 512, rad = 10 + r() * 70, v = 30 + r() * 60 | 0;
    const gr = rg.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, `rgba(${v},${v},${v},0.5)`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    rg.fillStyle = gr; rg.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // scuffs
  rg.strokeStyle = 'rgba(120,120,120,0.25)';
  for (let i = 0; i < 300; i++) { rg.lineWidth = r() * 2; rg.beginPath(); const x = r() * 512, y = r() * 512; rg.moveTo(x, y); rg.lineTo(x + r() * 40 - 20, y + r() * 8 - 4); rg.stroke(); }
  rg.strokeStyle = 'rgb(140,140,140)'; rg.lineWidth = 2;
  for (let k = 0; k <= 2; k++) { rg.beginPath(); rg.moveTo(k * 256, 0); rg.lineTo(k * 256, 512); rg.stroke(); rg.beginPath(); rg.moveTo(0, k * 256); rg.lineTo(512, k * 256); rg.stroke(); }
  return { map: tex(c, { repeat: [24, 24] }), rough: tex(rc, { repeat: [24, 24], srgb: false }) };
}

// Fine brushed metal
export function brushed() {
  const c = canvas(512, 512), g = c.getContext('2d'), r = rng(3);
  g.fillStyle = '#808080'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 4000; i++) { const v = 100 + r() * 70 | 0; g.fillStyle = `rgba(${v},${v},${v},0.35)`; g.fillRect(0, r() * 512, 512, r() * 1.4); }
  return tex(c, { srgb: false });
}

// Ceiling acoustic panels
export function ceiling() {
  const c = canvas(512, 512), g = c.getContext('2d'), r = rng(11);
  g.fillStyle = '#d8d8d6'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) { g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'; g.fillRect(r() * 512, r() * 512, 2, 2); }
  g.strokeStyle = '#9a9a98'; g.lineWidth = 3; g.strokeRect(0, 0, 512, 512);
  return tex(c, { repeat: [40, 20] });
}

// Night storm sky with clouds
export function stormSky() {
  const W = 2048, H = 768, c = canvas(W, H), g = c.getContext('2d'), r = rng(21);
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#05070c'); grad.addColorStop(0.55, '#121a26'); grad.addColorStop(0.85, '#2a2f37'); grad.addColorStop(1, '#3a342c');
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 900; i++) {
    const x = r() * W, y = r() * H * 0.8, rx = 60 + r() * 260, ry = 20 + r() * 70;
    const gr = g.createRadialGradient(x, y, 0, x, y, rx);
    const v = 30 + r() * 40 | 0;
    gr.addColorStop(0, `rgba(${v},${v + 6},${v + 14},0.18)`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.save(); g.translate(x, y); g.scale(1, ry / rx); g.translate(-x, -y);
    g.fillStyle = gr; g.fillRect(x - rx, y - rx, rx * 2, rx * 2); g.restore();
  }
  // city glow on horizon
  for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(255,${170 + r() * 60 | 0},90,${0.2 + r() * 0.6})`; g.fillRect(r() * W, H * 0.9 + r() * H * 0.08, 1 + r() * 2, 1 + r() * 2); }
  const t = tex(c); t.wrapS = THREE.ClampToEdgeWrapping; return t;
}

// Wet tarmac
export function tarmac() {
  const c = canvas(512, 512), g = c.getContext('2d'), r = rng(5);
  g.fillStyle = '#1b1c1e'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 20000; i++) { const v = 20 + r() * 30 | 0; g.fillStyle = `rgb(${v},${v},${v + 2})`; g.fillRect(r() * 512, r() * 512, 1.5, 1.5); }
  g.strokeStyle = 'rgba(220,180,40,0.9)'; g.lineWidth = 6; g.beginPath(); g.moveTo(256, 0); g.lineTo(256, 512); g.stroke();
  return tex(c, { repeat: [20, 20] });
}

// Generic text sign
export function signTex(lines, { w = 1024, h = 256, bg = '#111', fg = '#ffd200', font = 'bold 120px "Segoe UI", Arial, sans-serif', align = 'left', pad = 50, arrow = null } = {}) {
  const c = canvas(w, h), g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.fillStyle = fg; g.font = font; g.textBaseline = 'middle'; g.textAlign = align;
  const step = h / lines.length;
  lines.forEach((l, i) => g.fillText(l, align === 'center' ? w / 2 : pad, step * (i + 0.5)));
  if (arrow) {
    g.save(); g.translate(arrow === 'right' ? w - 120 : 120, h / 2); if (arrow === 'left') g.scale(-1, 1);
    g.beginPath(); g.moveTo(-50, -18); g.lineTo(10, -18); g.lineTo(10, -45); g.lineTo(60, 0); g.lineTo(10, 45); g.lineTo(10, 18); g.lineTo(-50, 18); g.closePath(); g.fill(); g.restore();
  }
  const t = tex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
}

// Departures board (split-flap look)
export function departuresBoard(flights) {
  const W = 2048, H = 1152, c = canvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#050608'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#0d1a33'; g.fillRect(0, 0, W, 150);
  g.fillStyle = '#ffffff'; g.font = 'bold 90px "Segoe UI", Arial, sans-serif'; g.textBaseline = 'middle';
  g.fillText('✈  DEPARTURES', 50, 78);
  g.font = '60px "Segoe UI", Arial, sans-serif'; g.fillStyle = '#9fb3d9'; g.textAlign = 'right'; g.fillText('SAT  12:05', W - 50, 78); g.textAlign = 'left';
  const cols = [50, 330, 640, 1290, 1520];
  g.font = 'bold 44px "Segoe UI", Arial, sans-serif'; g.fillStyle = '#7f8ba3';
  ['TIME', 'FLIGHT', 'DESTINATION', 'GATE', 'STATUS'].forEach((t, i) => g.fillText(t, cols[i], 200));
  const rowH = 82;
  flights.forEach((f, i) => {
    const y = 270 + i * rowH;
    if (i % 2 === 0) { g.fillStyle = '#0b0d12'; g.fillRect(0, y - rowH / 2, W, rowH); }
    g.font = 'bold 54px "Consolas", "DejaVu Sans Mono", monospace';
    // split flap cells
    const cell = (txt, x, color, n) => {
      for (let k = 0; k < n; k++) {
        g.fillStyle = '#16181d'; g.fillRect(x + k * 38, y - 32, 34, 64);
        g.fillStyle = '#000'; g.fillRect(x + k * 38, y - 1, 34, 2);
        g.fillStyle = color; g.textAlign = 'center'; g.fillText(txt[k] || ' ', x + k * 38 + 17, y + 2);
      }
      g.textAlign = 'left';
    };
    cell(f[0], cols[0], '#f5d76e', 5);
    cell(f[1], cols[1], '#f5d76e', 7);
    cell(f[2].toUpperCase(), cols[2], '#ffffff', 16);
    cell(f[3], cols[3], '#f5d76e', 3);
    const st = f[4], color = st.startsWith('DELAY') ? '#ffb020' : st.startsWith('CANC') ? '#ff4d4d' : st.startsWith('BOARD') ? '#5cd6ff' : '#3ee07a';
    cell(st, cols[4], color, 12);
  });
  const t = tex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
}
