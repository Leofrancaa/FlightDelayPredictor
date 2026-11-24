import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const W = 1080, H = 1920;
const C = { bg0: '#081227', bg1: '#0f2348', card: '#13284f', line: '#24427a', text: '#ffffff', dim: '#93a8d0', cyan: '#36c5ff', green: '#2fd27a', amber: '#ffb020', red: '#ff5a5f' };
const FONT = '"Segoe UI", "Inter", "Helvetica Neue", Arial, sans-serif';
const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const clamp01 = (x) => Math.min(1, Math.max(0, x));

function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

function icon(g, kind, x, y, s, color) {
  g.save(); g.translate(x, y); g.scale(s / 100, s / 100); g.strokeStyle = color; g.fillStyle = color; g.lineWidth = 7; g.lineCap = 'round'; g.lineJoin = 'round';
  if (kind === 'storm') {
    g.beginPath(); g.arc(-15, -5, 24, Math.PI * 0.9, Math.PI * 1.9); g.arc(15, -12, 28, Math.PI * 1.15, Math.PI * 0.1); g.lineTo(38, 18); g.lineTo(-38, 18); g.arc(-38, -2, 20, Math.PI * 0.5, Math.PI * 1.4); g.stroke();
    g.beginPath(); g.moveTo(4, 22); g.lineTo(-8, 44); g.lineTo(6, 44); g.lineTo(-4, 66); g.stroke();
  } else if (kind === 'plane') {
    g.rotate(-Math.PI / 4);
    g.beginPath(); g.moveTo(0, -46); g.quadraticCurveTo(8, -40, 7, -20); g.lineTo(44, 4); g.lineTo(44, 14); g.lineTo(7, 4); g.lineTo(6, 30); g.lineTo(18, 40); g.lineTo(18, 46); g.lineTo(0, 40); g.lineTo(-18, 46); g.lineTo(-18, 40); g.lineTo(-6, 30); g.lineTo(-7, 4); g.lineTo(-44, 14); g.lineTo(-44, 4); g.lineTo(-7, -20); g.quadraticCurveTo(-8, -40, 0, -46); g.fill();
  } else if (kind === 'chart') {
    g.beginPath(); g.moveTo(-40, 40); g.lineTo(-40, -40); g.moveTo(-40, 40); g.lineTo(42, 40); g.stroke();
    g.beginPath(); g.moveTo(-30, 22); g.lineTo(-8, 0); g.lineTo(8, 12); g.lineTo(36, -26); g.stroke();
    g.beginPath(); g.moveTo(22, -28); g.lineTo(37, -27); g.lineTo(36, -12); g.stroke();
  } else if (kind === 'clock') {
    g.beginPath(); g.arc(0, 0, 40, 0, 7); g.stroke(); g.beginPath(); g.moveTo(0, -24); g.lineTo(0, 0); g.lineTo(18, 10); g.stroke();
  }
  g.restore();
}

export function createTotem(cfg) {
  const group = new THREE.Group();
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;

  // ---------- 3D body
  const shell = new THREE.MeshPhysicalMaterial({ color: 0xf4f5f7, roughness: 0.28, metalness: 0.0, clearcoat: 0.8, clearcoatRoughness: 0.15 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.4, metalness: 0.3 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xc4c8ce, roughness: 0.25, metalness: 1 });
  const led = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 0.75, 1).multiplyScalar(4) });
  const mk = (geo, mat, x, y, z, rx = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.x = rx; m.castShadow = m.receiveShadow = true; group.add(m); return m; };
  mk(new RoundedBoxGeometry(0.7, 0.04, 0.5, 3, 0.015), steel, 0, 0.02, 0);
  mk(new RoundedBoxGeometry(0.5, 1.0, 0.3, 4, 0.06), shell, 0, 0.54, -0.02);
  // head (tilted back)
  const head = new THREE.Group(); head.position.set(0, 1.5, 0.0); head.rotation.x = -0.12; group.add(head);
  const hm = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; head.add(m); return m; };
  hm(new RoundedBoxGeometry(0.64, 1.08, 0.12, 4, 0.04), shell, 0, 0, -0.02);
  hm(new THREE.PlaneGeometry(0.58, 1.0), dark, 0, 0, 0.041);
  const screenMat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: true }); screenMat.color.setScalar(1.0);
  const screen = hm(new THREE.PlaneGeometry(0.54, 0.96), screenMat, 0, 0, 0.043); screen.castShadow = false;
  const cover = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.02, metalness: 0, transparent: true, opacity: 0.06, clearcoat: 1, envMapIntensity: 1.5, depthWrite: false });
  // header lightbox
  const hdr = document.createElement('canvas'); hdr.width = 1024; hdr.height = 220; const hg = hdr.getContext('2d');
  hg.fillStyle = '#0b1a3a'; hg.fillRect(0, 0, 1024, 220);
  icon(hg, 'plane', 110, 110, 120, '#36c5ff');
  hg.fillStyle = '#fff'; hg.font = `bold 78px ${FONT}`; hg.textBaseline = 'middle'; hg.fillText(cfg.brand.title, 200, 88);
  hg.fillStyle = '#93c9ff'; hg.font = `46px ${FONT}`; hg.fillText(cfg.brand.subtitle, 202, 160);
  const hTex = new THREE.CanvasTexture(hdr); hTex.colorSpace = THREE.SRGBColorSpace;
  const hMat = new THREE.MeshBasicMaterial({ map: hTex }); hMat.color.setScalar(1.6);
  hm(new RoundedBoxGeometry(0.64, 0.16, 0.12, 3, 0.03), shell, 0, 0.64, -0.02);
  hm(new THREE.PlaneGeometry(0.6, 0.13), hMat, 0, 0.64, 0.041);
  // side LED strips
  for (const sx of [-0.325, 0.325]) mk(new THREE.BoxGeometry(0.008, 1.0, 0.02), led, sx * 0.79, 0.54, 0.13);
  // card reader / printer
  mk(new RoundedBoxGeometry(0.22, 0.09, 0.08, 2, 0.02), dark, 0.0, 0.88, 0.15);
  mk(new THREE.BoxGeometry(0.16, 0.006, 0.01), led, 0.0, 0.86, 0.195);
  mk(new RoundedBoxGeometry(0.28, 0.03, 0.06, 2, 0.01), dark, 0.0, 0.72, 0.13);
  // screen glow onto the people
  const glow = new THREE.PointLight(0x5fb6ff, 1.0, 2.5, 2); glow.position.set(0, 1.25, 0.75); group.add(glow);

  // ---------- 2D screen UI
  const ui = { state: 'idle', t: 0, f: cfg.flight };
  function bg() {
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, C.bg1); gr.addColorStop(1, C.bg0);
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // top bar
    g.fillStyle = 'rgba(255,255,255,0.04)'; g.fillRect(0, 0, W, 130);
    icon(g, 'plane', 80, 65, 70, C.cyan);
    g.fillStyle = C.text; g.font = `600 44px ${FONT}`; g.textBaseline = 'middle'; g.fillText(cfg.brand.title, 140, 65);
    g.fillStyle = C.dim; g.font = `38px ${FONT}`; g.textAlign = 'right'; g.fillText(cfg.flight.clock, W - 50, 65); g.textAlign = 'left';
  }
  function footer(txt) { g.fillStyle = C.dim; g.font = `30px ${FONT}`; g.textAlign = 'center'; g.fillText(txt, W / 2, H - 60); g.textAlign = 'left'; }

  function field(y, label, value, typed, active) {
    rr(g, 60, y, W - 120, 150, 22); g.fillStyle = C.card; g.fill();
    g.lineWidth = active ? 4 : 2; g.strokeStyle = active ? C.cyan : C.line; g.stroke();
    g.fillStyle = C.dim; g.font = `32px ${FONT}`; g.fillText(label, 95, y + 45);
    const shown = value.slice(0, Math.round(value.length * typed));
    g.fillStyle = C.text; g.font = `600 54px ${FONT}`; g.fillText(shown, 95, y + 105);
    if (active && Math.floor(ui.t * 2.5) % 2 === 0) { const w = g.measureText(shown).width; g.fillRect(100 + w, y + 78, 4, 52); }
  }

  const DRAW = {
    idle() {
      bg();
      const p = 0.5 + 0.5 * Math.sin(ui.t * 2.2);
      g.save(); g.globalAlpha = 0.15 + 0.1 * p; g.beginPath(); g.arc(W / 2, 640, 260 + 20 * p, 0, 7); g.fillStyle = C.cyan; g.fill(); g.restore();
      g.beginPath(); g.arc(W / 2, 640, 200, 0, 7); g.fillStyle = '#123a6e'; g.fill();
      icon(g, 'plane', W / 2, 640, 230, '#ffffff');
      g.fillStyle = C.text; g.textAlign = 'center'; g.font = `700 92px ${FONT}`; g.fillText('Seu voo vai', W / 2, 1060); g.fillText('atrasar?', W / 2, 1170);
      g.fillStyle = C.dim; g.font = `44px ${FONT}`; g.fillText('Previsão com inteligência artificial', W / 2, 1270);
      rr(g, 190, 1420, W - 380, 140, 70); g.fillStyle = C.cyan; g.fill();
      g.fillStyle = '#04122b'; g.font = `700 54px ${FONT}`; g.fillText('Toque para começar', W / 2, 1492);
      g.textAlign = 'left'; footer(cfg.brand.footer);
    },
    form() {
      bg();
      g.fillStyle = C.text; g.font = `700 64px ${FONT}`; g.fillText('Dados do voo', 60, 230);
      g.fillStyle = C.dim; g.font = `36px ${FONT}`; g.fillText('Cartão de embarque lido', 60, 290);
      const f = ui.f, rows = [['Companhia', f.airline], ['Voo', f.code], ['Origem → Destino', `${f.origin} → ${f.dest}`], ['Data / horário', f.when]];
      const per = 0.9;
      rows.forEach((r, i) => {
        const tt = (ui.t - 0.3 - i * per) / (per * 0.8);
        if (ui.t < 0.3 + i * per - 0.25) return;
        field(360 + i * 190, r[0], r[1], clamp01(tt), tt > 0 && tt < 1.05);
      });
      const done = ui.t > 0.3 + rows.length * per;
      rr(g, 60, 1220, W - 120, 140, 70); g.fillStyle = done ? C.cyan : '#1d3561'; g.fill();
      g.fillStyle = done ? '#04122b' : C.dim; g.textAlign = 'center'; g.font = `700 52px ${FONT}`; g.fillText('Consultar previsão', W / 2, 1292); g.textAlign = 'left';
      footer(cfg.brand.footer);
    },
    auto() {
      bg();
      const f = ui.f;
      rr(g, 60, 170, W - 120, 200, 24); g.fillStyle = C.card; g.fill(); g.strokeStyle = C.line; g.lineWidth = 2; g.stroke();
      g.fillStyle = C.text; g.font = `700 64px ${FONT}`; g.fillText(`${f.origin}  →  ${f.dest}`, 100, 250);
      g.fillStyle = C.dim; g.font = `38px ${FONT}`; g.fillText(`${f.code} · ${f.airline} · ${f.when}`, 100, 320);
      g.fillStyle = C.text; g.font = `700 52px ${FONT}`; g.fillText('Dados em tempo real', 60, 470);
      g.fillStyle = C.dim; g.font = `34px ${FONT}`; g.fillText('Buscados automaticamente', 60, 525);
      cfg.auto.forEach((a, i) => {
        const k = ease((ui.t - 0.3 - i * 0.8) / 0.6); if (k <= 0) return;
        const y = 590 + i * 260, x = 60 + (1 - k) * 120;
        g.save(); g.globalAlpha = k;
        rr(g, x, y, W - 120, 230, 24); g.fillStyle = C.card; g.fill(); g.strokeStyle = a.color; g.lineWidth = 3; g.stroke();
        g.beginPath(); g.arc(x + 110, y + 115, 70, 0, 7); g.fillStyle = 'rgba(255,255,255,0.06)'; g.fill();
        icon(g, a.icon, x + 110, y + 112, 80, a.color);
        g.fillStyle = C.dim; g.font = `34px ${FONT}`; g.fillText(a.title, x + 215, y + 80);
        g.fillStyle = C.text; g.font = `700 50px ${FONT}`; g.fillText(a.value, x + 215, y + 145);
        if (a.detail) { g.fillStyle = a.color; g.font = `32px ${FONT}`; g.fillText(a.detail, x + 215, y + 195); }
        g.restore();
      });
      footer(cfg.brand.footer);
    },
    analyzing() {
      bg();
      const p = clamp01(ui.t / 2.6);
      g.save(); g.translate(W / 2, 760); g.rotate(ui.t * 4);
      g.lineWidth = 22; g.lineCap = 'round'; g.strokeStyle = 'rgba(54,197,255,0.15)'; g.beginPath(); g.arc(0, 0, 170, 0, 7); g.stroke();
      g.strokeStyle = C.cyan; g.beginPath(); g.arc(0, 0, 170, 0, 1.6); g.stroke(); g.restore();
      icon(g, 'plane', W / 2, 760, 140, '#fff');
      g.fillStyle = C.text; g.textAlign = 'center'; g.font = `700 66px ${FONT}`; g.fillText('Analisando seu voo…', W / 2, 1080);
      const msgs = cfg.analyzingMsgs; g.fillStyle = C.dim; g.font = `40px ${FONT}`;
      g.fillText(msgs[Math.min(msgs.length - 1, Math.floor(p * msgs.length))], W / 2, 1160);
      rr(g, 120, 1260, W - 240, 26, 13); g.fillStyle = '#1d3561'; g.fill();
      rr(g, 120, 1260, (W - 240) * ease(p), 26, 13); g.fillStyle = C.cyan; g.fill();
      g.fillStyle = C.dim; g.font = `36px ${FONT}`; g.fillText(`${Math.round(p * 100)}%`, W / 2, 1350);
      g.textAlign = 'left'; footer(cfg.brand.footer);
    },
    result() {
      bg();
      const f = ui.f;
      g.fillStyle = C.dim; g.font = `36px ${FONT}`; g.fillText(`${f.code} · ${f.origin} → ${f.dest} · ${f.when}`, 60, 205);
      g.fillStyle = C.text; g.font = `700 70px ${FONT}`; g.fillText('Previsão de atraso', 60, 290);
      const best = cfg.probs.reduce((a, b) => (b.p > a.p ? b : a));
      cfg.probs.forEach((pr, i) => {
        const y = 370 + i * 230, k = ease((ui.t - 0.2 - i * 0.25) / 1.1);
        const isBest = pr === best;
        rr(g, 60, y, W - 120, 200, 24); g.fillStyle = isBest ? '#1a2f5c' : C.card; g.fill();
        g.lineWidth = isBest ? 5 : 2; g.strokeStyle = isBest ? pr.color : C.line; g.stroke();
        g.fillStyle = C.text; g.font = `700 50px ${FONT}`; g.fillText(pr.label, 100, y + 70);
        g.fillStyle = C.dim; g.font = `36px ${FONT}`; g.fillText(pr.sub, 100, y + 120);
        g.fillStyle = pr.color; g.font = `800 90px ${FONT}`; g.textAlign = 'right'; g.fillText(`${Math.round(pr.p * 100 * k)}%`, W - 100, y + 100); g.textAlign = 'left';
        rr(g, 100, y + 150, W - 200, 22, 11); g.fillStyle = '#0c1b38'; g.fill();
        rr(g, 100, y + 150, Math.max(22, (W - 200) * pr.p * k), 22, 11); g.fillStyle = pr.color; g.fill();
        if (isBest && k > 0.95) { rr(g, W - 430, y - 22, 300, 52, 26); g.fillStyle = pr.color; g.fill(); g.fillStyle = '#1a0c00'; g.font = `700 30px ${FONT}`; g.textAlign = 'center'; g.fillText('MAIS PROVÁVEL', W - 280, y + 5); g.textAlign = 'left'; }
      });
      const k2 = ease((ui.t - 1.6) / 0.8);
      if (k2 > 0) {
        g.save(); g.globalAlpha = k2;
        g.fillStyle = C.text; g.font = `700 50px ${FONT}`; g.fillText('Principais fatores', 60, 1110);
        const maxw = Math.max(...cfg.reasons.map((r) => r.w));
        cfg.reasons.forEach((r, i) => {
          const y = 1160 + i * 150;
          rr(g, 60, y, W - 120, 130, 20); g.fillStyle = C.card; g.fill();
          g.fillStyle = C.text; g.font = `600 40px ${FONT}`; g.fillText(r.label, 95, y + 55);
          rr(g, 95, y + 82, (W - 400) * (r.w / maxw) * ease((ui.t - 1.8 - i * 0.2) / 0.8), 18, 9); g.fillStyle = C.red; g.fill();
          g.fillStyle = C.red; g.font = `700 38px ${FONT}`; g.textAlign = 'right'; g.fillText(`+${Math.round(r.w * 100)} pts`, W - 95, y + 100); g.textAlign = 'left';
        });
        g.fillStyle = C.dim; g.font = `30px ${FONT}`; g.textAlign = 'center'; g.fillText(cfg.brand.modelNote, W / 2, H - 120); g.textAlign = 'left';
        g.restore();
      }
      footer(cfg.brand.footer);
    },
  };

  function redraw() { DRAW[ui.state](); tex.needsUpdate = true; }
  redraw();
  return {
    group, screen, head,
    setState(s, t0 = 0) { ui.state = s; ui.t = t0; redraw(); },
    get state() { return ui.state; },
    update(dt) { ui.t += dt; redraw(); },
    // world position of the screen centre (for cameras)
    screenWorld(v = new THREE.Vector3()) { return screen.getWorldPosition(v); },
  };
}
