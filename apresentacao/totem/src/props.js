import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export function suitcase() {
  const g = new THREE.Group();
  const shell = new THREE.MeshPhysicalMaterial({ color: 0x23324a, roughness: 0.35, metalness: 0.1, clearcoat: 0.6, clearcoatRoughness: 0.3 });
  const black = new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.6 });
  const alu = new THREE.MeshStandardMaterial({ color: 0xb9bdc3, metalness: 1, roughness: 0.3 });
  // local frame: origin at the wheel axle, body extends up (+y), front face +z
  const body = new THREE.Mesh(new RoundedBoxGeometry(0.40, 0.58, 0.24, 4, 0.05), shell); body.position.set(0, 0.34, 0.07);
  g.add(body);
  for (let i = -2; i <= 2; i++) { const rib = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.5, 0.245), shell); rib.position.set(i * 0.07, 0.34, 0.07); g.add(rib); }
  for (const x of [-0.15, 0.15]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 16), black); w.rotation.z = Math.PI / 2; w.position.set(x, 0.035, -0.02); g.add(w);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.42, 8), alu); rod.position.set(x * 0.6, 0.83, -0.03); g.add(rod);
  }
  const grip = new THREE.Mesh(new RoundedBoxGeometry(0.22, 0.03, 0.035, 2, 0.012), black); grip.position.set(0, 1.04, -0.03); g.add(grip);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.userData.gripLocal = new THREE.Vector3(0, 1.04, -0.03);
  return g;
}

export function giftBag() {
  const g = new THREE.Group();
  const c = document.createElement('canvas'); c.width = 256; c.height = 256; const q = c.getContext('2d');
  q.fillStyle = '#7a1630'; q.fillRect(0, 0, 256, 256);
  q.fillStyle = '#d8b25a'; for (let i = 0; i < 40; i++) { q.beginPath(); q.arc((i * 53) % 256, (i * 97) % 256, 5, 0, 7); q.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const paper = new THREE.MeshStandardMaterial({ map: t, roughness: 0.75 });
  // origin at the handle top, bag hangs below
  const bag = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.3, 0.12), paper); bag.position.set(0, -0.27, 0); g.add(bag);
  const rib = new THREE.MeshStandardMaterial({ color: 0xe9c46a, roughness: 0.4, metalness: 0.3 });
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.006, 6, 20, Math.PI), rib); handle.position.set(0, -0.12, 0); g.add(handle);
  // tissue paper
  const tissue = new THREE.MeshStandardMaterial({ color: 0xf2e6d0, roughness: 0.9, side: THREE.DoubleSide });
  for (let i = 0; i < 4; i++) { const p = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.09, 4, 1, true), tissue); p.position.set(-0.08 + i * 0.055, -0.1, (i % 2) * 0.02 - 0.01); p.rotation.z = (i - 1.5) * 0.3; g.add(p); }
  // small tag
  const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.03), new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide })); tag.position.set(0.1, -0.13, 0.065); tag.rotation.z = 0.4; g.add(tag);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  return g;
}

export function phone() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new RoundedBoxGeometry(0.075, 0.155, 0.009, 3, 0.006), new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.3, metalness: 0.6 }));
  g.add(body);
  const c = document.createElement('canvas'); c.width = 180; c.height = 380; const q = c.getContext('2d');
  q.fillStyle = '#0b141a'; q.fillRect(0, 0, 180, 380);
  q.fillStyle = '#1f2c34'; q.fillRect(0, 0, 180, 50);
  q.fillStyle = '#e9edef'; q.font = 'bold 20px Arial'; q.fillText('Amor ❤', 14, 32);
  q.fillStyle = '#005c4b'; q.fillRect(40, 240, 130, 50);
  q.fillStyle = '#e9edef'; q.font = '15px Arial'; q.fillText('Amor, então…', 48, 262); q.fillText('o voo vai atrasar', 48, 282);
  q.fillStyle = '#1f2c34'; q.fillRect(8, 330, 164, 40);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.068, 0.145), new THREE.MeshBasicMaterial({ map: t })); scr.position.z = 0.0047; g.add(scr);
  return g;
}

export function boardingPass() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 110; const q = c.getContext('2d');
  q.fillStyle = '#fff'; q.fillRect(0, 0, 256, 110); q.fillStyle = '#0b2a66'; q.fillRect(0, 0, 256, 26);
  q.fillStyle = '#fff'; q.font = 'bold 16px Arial'; q.fillText('BOARDING PASS', 8, 19);
  q.fillStyle = '#111'; q.font = 'bold 26px Arial'; q.fillText('DFW → LAS', 10, 62); q.font = '14px Arial'; q.fillText('AA 1455 · 13:05 · C14', 10, 90);
  for (let i = 0; i < 30; i++) { q.fillRect(180 + i * 2.2, 40, i % 3 ? 1 : 2, 50); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.07), new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide, roughness: 0.6 }));
  return m;
}

// phone screen showing a short chat (lines: [{me, text}]) — redraw with setChat
export function chatPhone() {
  const g = phone();
  const c = document.createElement('canvas'); c.width = 360; c.height = 760; const q = c.getContext('2d');
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  g.children[1].material = new THREE.MeshBasicMaterial({ map: t });
  g.setChat = (msgs) => {
    q.fillStyle = '#0b141a'; q.fillRect(0, 0, 360, 760);
    q.fillStyle = '#1f2c34'; q.fillRect(0, 0, 360, 96); q.fillStyle = '#e9edef'; q.font = 'bold 36px Arial'; q.fillText('Amor ❤', 28, 62);
    let y = 150;
    q.font = '27px Arial';
    for (const m of msgs) {
      const words = m.text.split(' '), lines = []; let cur = '';
      for (const w of words) { if (q.measureText(cur + ' ' + w).width > 250 && cur) { lines.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; }
      lines.push(cur);
      const h = lines.length * 34 + 26, x = m.me ? 70 : 18;
      q.fillStyle = m.me ? '#005c4b' : '#1f2c34'; q.beginPath(); q.roundRect(x, y, 272, h, 14); q.fill();
      q.fillStyle = '#e9edef'; lines.forEach((l, i) => q.fillText(l, x + 16, y + 40 + i * 34));
      y += h + 18;
    }
    q.fillStyle = '#1f2c34'; q.fillRect(14, 680, 332, 64);
    t.needsUpdate = true;
  };
  g.setChat([]);
  return g;
}

export function glasses() {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4, metalness: 0.3 });
  const lens = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.02, transparent: true, opacity: 0.12, depthWrite: false });
  for (const s of [-1, 1]) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.0025, 6, 24), m); r.scale.set(1.2, 0.85, 1); r.position.set(s * 0.032, 0, 0); g.add(r);
    const l = new THREE.Mesh(new THREE.CircleGeometry(0.024, 20), lens); l.scale.set(1.2, 0.85, 1); l.position.set(s * 0.032, 0, 0); g.add(l);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.003, 0.1), m); arm.position.set(s * 0.062, 0.005, -0.05); g.add(arm);
  }
  const br = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.003, 0.003), m); br.position.y = 0.006; g.add(br);
  return g;
}

export function badge() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 80; const q = c.getContext('2d');
  q.fillStyle = '#fff'; q.fillRect(0, 0, 128, 80); q.fillStyle = '#0b2a66'; q.fillRect(0, 0, 128, 22); q.fillStyle = '#fff'; q.font = 'bold 15px Arial'; q.fillText('DFW STAFF', 10, 16);
  q.fillStyle = '#333'; q.fillRect(10, 30, 32, 40);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.047), new THREE.MeshStandardMaterial({ map: t, roughness: 0.5 }));
}
