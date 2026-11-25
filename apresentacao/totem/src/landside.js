import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as T from './textures.js';
import { HALL, ENT } from './airport.js';

// Landside: entrance glass + sliding doors, covered curb with a taxi, rain, info desk, wet-floor sign, footprints.
const M = (o) => new THREE.MeshStandardMaterial(o);
function add(parent, geo, mat, x = 0, y = 0, z = 0, o = {}) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
  if (o.rx) m.rotation.x = o.rx; if (o.ry) m.rotation.y = o.ry; if (o.rz) m.rotation.z = o.rz;
  m.castShadow = o.cast ?? true; m.receiveShadow = o.receive ?? true; parent.add(m); return m;
}
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }

export const CURB = { z: 21.6, taxi: new THREE.Vector3(8.6, 0, 22.95), canopyEdge: 19.6 };
export const DESK = new THREE.Vector3(-0.5, 0, 11.6);

export function buildLandside(scene, { quality = 'high' } = {}) {
  const root = new THREE.Group(); scene.add(root);
  const out = { root, update: () => {} };
  const zf = HALL.z1, cxE = (ENT.x0 + ENT.x1) / 2;
  const frame = M({ color: 0x2a2d32, metalness: 0.8, roughness: 0.4 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xa9bccb, roughness: 0.05, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.2 });
  const wet = new THREE.MeshPhysicalMaterial({ color: 0xa9bccb, roughness: 0.15, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false });

  // ---------- entrance façade: fixed panes + one pair of sliding doors
  const dW = 1.25, dH = 2.6;
  add(root, new THREE.BoxGeometry(ENT.x1 - ENT.x0, 0.14, 0.2), frame, cxE, ENT.h - 0.07, zf, { receive: false });
  add(root, new THREE.BoxGeometry(ENT.x1 - ENT.x0, 0.16, 0.22), frame, cxE, dH + 0.08, zf, { receive: false });
  for (const x of [ENT.x0, cxE - dW - 0.05, cxE + dW + 0.05, ENT.x1]) add(root, new THREE.BoxGeometry(0.1, ENT.h, 0.2), frame, x, ENT.h / 2, zf, { receive: false });
  const fixedW = cxE - dW - 0.05 - ENT.x0;
  for (const x of [ENT.x0 + fixedW / 2, ENT.x1 - fixedW / 2]) add(root, new THREE.PlaneGeometry(fixedW, ENT.h), wet, x, ENT.h / 2, zf + 0.03, { cast: false, receive: false });
  add(root, new THREE.PlaneGeometry(2 * dW + 0.1, ENT.h - dH - 0.16), glass, cxE, dH + 0.16 + (ENT.h - dH - 0.16) / 2, zf, { cast: false, receive: false });
  const leaves = [-1, 1].map((s) => {
    const g = new THREE.Group(); g.position.set(cxE + s * dW / 2, 0, zf - 0.06); root.add(g);
    add(g, new THREE.PlaneGeometry(dW - 0.06, dH), wet, 0, dH / 2, 0, { cast: false, receive: false });
    for (const sx of [-1, 1]) add(g, new THREE.BoxGeometry(0.05, dH, 0.05), frame, sx * (dW / 2 - 0.03), dH / 2, 0, { receive: false });
    add(g, new THREE.BoxGeometry(dW, 0.05, 0.05), frame, 0, 0.03, 0, { receive: false });
    add(g, new THREE.BoxGeometry(dW, 0.05, 0.05), frame, 0, dH - 0.03, 0, { receive: false });
    return { g, s, x0: cxE + s * dW / 2 };
  });
  let doorOpen = 0, doorGoal = 0;
  out.doors = (open) => { doorGoal = open ? 1 : 0; };
  // entrance mat + sign over the door
  add(root, new THREE.PlaneGeometry(3.2, 2.2), M({ color: 0x232527, roughness: 0.95 }), cxE, 0.004, zf - 1.3, { rx: -Math.PI / 2, cast: false });
  const depTex = T.signTex(['Departures'], { w: 1536, h: 256, bg: '#1d1f22', fg: '#ffffff', font: 'bold 130px "Segoe UI", Arial, sans-serif' });
  add(root, new THREE.PlaneGeometry(5.2, 0.87), new THREE.MeshBasicMaterial({ map: depTex, color: new THREE.Color(1.2, 1.2, 1.2) }), cxE, 4.65, zf + 0.12, { cast: false });

  // ---------- outside ground: sidewalk, curb, road (wet)
  const conc = canvasTex(512, 512, (g, w, h) => { g.fillStyle = '#5d5f61'; g.fillRect(0, 0, w, h); for (let i = 0; i < 9000; i++) { const v = 70 + Math.random() * 40; g.fillStyle = `rgb(${v},${v + 2},${v + 4})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } g.strokeStyle = '#3b3d40'; g.lineWidth = 4; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * w / 4, 0); g.lineTo(i * w / 4, h); g.stroke(); g.beginPath(); g.moveTo(0, i * h / 4); g.lineTo(w, i * h / 4); g.stroke(); } });
  conc.wrapS = conc.wrapT = THREE.RepeatWrapping; conc.repeat.set(12, 2.5);
  add(root, new THREE.PlaneGeometry(48, CURB.z - zf), M({ map: conc, roughness: 0.35, metalness: 0.05, color: 0xb0b0b0 }), 8, 0.015, (zf + CURB.z) / 2, { rx: -Math.PI / 2, cast: false });
  add(root, new THREE.BoxGeometry(48, 0.14, 0.25), M({ color: 0x8c8c88, roughness: 0.6 }), 8, 0.06, CURB.z, { cast: false });
  const road = canvasTex(1024, 512, (g, w, h) => {
    g.fillStyle = '#1c1d1f'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 20000; i++) { const v = 22 + Math.random() * 26; g.fillStyle = `rgb(${v},${v},${v + 2})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    g.fillStyle = 'rgba(210,210,200,0.85)'; for (let x = 0; x < w; x += 128) g.fillRect(x, h * 0.48, 70, 8);
    for (let i = 0; i < 26; i++) { g.fillStyle = 'rgba(8,9,11,0.55)'; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 30 + Math.random() * 70, 10 + Math.random() * 22, 0, 0, 7); g.fill(); }
  });
  road.wrapS = road.wrapT = THREE.RepeatWrapping; road.repeat.set(3, 1);
  add(root, new THREE.PlaneGeometry(60, 26), M({ map: road, roughness: 0.12, metalness: 0.35, color: 0x9a9a9a }), 8, 0, CURB.z + 13, { rx: -Math.PI / 2, cast: false });
  // island + canopy columns
  add(root, new THREE.BoxGeometry(48, 0.15, 1.2), M({ map: conc, roughness: 0.4, color: 0xa8a8a8 }), 8, 0.075, 26.8, { cast: false });
  const colM = M({ color: 0xdcdcd8, roughness: 0.5 });
  for (const x of [-6, 2, 14.5, 22]) add(root, new THREE.CylinderGeometry(0.28, 0.28, 5.2, 24), colM, x, 2.6, 19.3);
  // canopy slab with light strips
  add(root, new THREE.BoxGeometry(34, 0.45, CURB.canopyEdge - zf), M({ color: 0xd8d8d4, roughness: 0.6 }), 8, 5.25, (zf + CURB.canopyEdge) / 2, { cast: false });
  const strip = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.3, 1.3, 1.25) });
  for (let z = zf + 1.5; z < CURB.canopyEdge; z += 2.5) add(root, new THREE.BoxGeometry(30, 0.03, 0.18), strip, 8, 5.02, z, { cast: false, receive: false });
  for (const x of [3, 9, 15]) { const p = new THREE.PointLight(0xf2f4ff, 3, 12, 1.6); p.position.set(x, 4.8, 17.8); root.add(p); }
  const under = new THREE.SpotLight(0xeef2ff, 28, 16, 0.8, 0.6, 1.5); under.position.set(8.5, 5, 18.6); under.target.position.set(8.5, 0, 22.5);
  if (quality === 'high') { under.castShadow = true; under.shadow.mapSize.set(1024, 1024); under.shadow.bias = -0.0003; }
  root.add(under, under.target);

  // ---------- backdrop: parking garage + storm sky
  const garage = canvasTex(1024, 256, (g, w, h) => {
    g.fillStyle = '#4a4c50'; g.fillRect(0, 0, w, h);
    for (let f = 0; f < 4; f++) { g.fillStyle = '#141519'; g.fillRect(0, 20 + f * 60, w, 30); for (let i = 0; i < 30; i++) { g.fillStyle = Math.random() < 0.3 ? 'rgba(255,230,180,0.9)' : 'rgba(40,42,46,1)'; g.fillRect(i * 36 + 10, 30 + f * 60, 14, 6); } }
  });
  add(root, new THREE.PlaneGeometry(80, 16), new THREE.MeshBasicMaterial({ map: garage, color: new THREE.Color(0.55, 0.57, 0.62), fog: true }), 8, 8, 52, { ry: Math.PI, cast: false, receive: false });
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(420, 170), new THREE.MeshBasicMaterial({ map: T.stormSky(), fog: false, color: new THREE.Color(0.75, 0.78, 0.85) }));
  sky.position.set(8, 60, 110); sky.rotation.y = Math.PI; root.add(sky);

  // ---------- rain beyond the canopy + drip curtain at its edge
  const r = T.rng(21), N = quality === 'low' ? 2000 : 6000, ND = 900;
  const rp = new Float32Array((N + ND) * 6), sp = new Float32Array(N + ND), y0 = new Float32Array(N + ND), y1 = new Float32Array(N + ND);
  for (let i = 0; i < N + ND; i++) {
    const drip = i >= N;
    const x = drip ? -9 + r() * 34 : -22 + r() * 60, z = drip ? CURB.canopyEdge + 0.05 + r() * 0.15 : CURB.canopyEdge + 0.3 + r() * 30;
    y0[i] = drip ? 5.0 : 26; y1[i] = 0; const y = r() * y0[i];
    rp.set([x, y, z, x - 0.04, y - (drip ? 0.5 : 0.8), z], i * 6); sp[i] = drip ? 9 + r() * 4 : 20 + r() * 9;
  }
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
  const rm = new THREE.LineBasicMaterial({ color: 0xb4c4d8, transparent: true, opacity: 0.4 });
  const rain = new THREE.LineSegments(rg, rm); rain.frustumCulled = false; root.add(rain);
  // splash dots on the road
  const splash = new THREE.InstancedMesh(new THREE.RingGeometry(0.02, 0.05, 10), new THREE.MeshBasicMaterial({ color: 0xc8d4e0, transparent: true, opacity: 0.35, side: THREE.DoubleSide }), 220);
  const sm = new THREE.Object3D(), sl = [];
  for (let i = 0; i < 220; i++) { sl.push({ x: -10 + r() * 40, z: CURB.canopyEdge + 0.2 + r() * 12, t: r() }); }
  root.add(splash);

  // ---------- taxi
  out.taxi = buildTaxi(root, CURB.taxi);

  // ---------- info desk
  const desk = new THREE.Group(); desk.position.copy(DESK); root.add(desk);
  const deskM = M({ color: 0xeeeeea, roughness: 0.35 }), topM = M({ color: 0x252629, roughness: 0.25, metalness: 0.15 });
  add(desk, new RoundedBoxGeometry(0.75, 1.05, 2.6, 3, 0.04), deskM, 0, 0.525, 0);
  add(desk, new THREE.BoxGeometry(0.85, 0.04, 2.7), topM, 0, 1.07, 0);
  add(desk, new THREE.BoxGeometry(0.02, 0.05, 2.5), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.1, 0.45, 1).multiplyScalar(3) }), 0.385, 0.2, 0, { cast: false });
  add(desk, new THREE.BoxGeometry(0.05, 0.36, 0.5), M({ color: 0x1a1b1e, metalness: 0.6, roughness: 0.4 }), -0.15, 1.3, -1.05);
  const info = canvasTex(1024, 256, (g, w, h) => { g.fillStyle = '#0b2a66'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.beginPath(); g.arc(120, 128, 70, 0, 7); g.fill(); g.fillStyle = '#0b2a66'; g.font = 'bold 120px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('i', 120, 134); g.fillStyle = '#fff'; g.textAlign = 'left'; g.font = 'bold 84px "Segoe UI", Arial'; g.fillText('Informações', 230, 100); g.font = '58px "Segoe UI", Arial'; g.fillStyle = '#b9c8e6'; g.fillText('Information', 230, 180); });
  const sg = new THREE.Group(); sg.position.set(0.1, 2.75, 0); sg.rotation.y = Math.PI / 2; desk.add(sg);
  add(sg, new THREE.BoxGeometry(2.1, 0.55, 0.08), M({ color: 0x1d1f22 }), 0, 0, -0.05);
  add(sg, new THREE.PlaneGeometry(2.0, 0.5), new THREE.MeshBasicMaterial({ map: info, color: new THREE.Color(1.3, 1.3, 1.3) }), 0, 0, 0.0, { cast: false });
  add(sg, new THREE.CylinderGeometry(0.012, 0.012, HALL.h - 2.75, 6), M({ color: 0x9aa0a6, metalness: 0.9, roughness: 0.3 }), 0, (HALL.h - 2.75) / 2, -0.05);

  // ---------- welcome lightbox behind the information desk
  const wel = canvasTex(2048, 640, (q, w, h) => {
    const gr = q.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#0b2a66'); gr.addColorStop(0.55, '#1d4fa3'); gr.addColorStop(1, '#f08a24'); q.fillStyle = gr; q.fillRect(0, 0, w, h);
    q.fillStyle = 'rgba(255,255,255,0.08)'; for (let i = 0; i < 14; i++) { q.beginPath(); q.arc(1500 + i * 30, 900, 300 + i * 60, Math.PI, 1.5 * Math.PI); q.lineWidth = 6; q.strokeStyle = 'rgba(255,255,255,0.07)'; q.stroke(); }
    q.fillStyle = '#fff'; q.font = '300 120px "Segoe UI", Arial'; q.fillText('Welcome to', 110, 250); q.font = 'bold 170px "Segoe UI", Arial'; q.fillText('Dallas Fort Worth', 100, 430);
    q.font = '60px "Segoe UI", Arial'; q.fillStyle = 'rgba(255,255,255,0.8)'; q.fillText('DFW International Airport', 110, 540);
  });
  const lb = new THREE.Group(); lb.position.set(-4.6, 2.6, HALL.z1 - 0.12); lb.rotation.y = Math.PI; root.add(lb);
  add(lb, new THREE.BoxGeometry(6.6, 2.15, 0.12), M({ color: 0x1b1c1f, metalness: 0.5, roughness: 0.4 }), 0, 0, 0.04);
  add(lb, new THREE.PlaneGeometry(6.4, 2.0), new THREE.MeshBasicMaterial({ map: wel, color: new THREE.Color(1.05, 1.05, 1.05) }), 0, 0, 0.11, { cast: false });
  for (const x of [-3.6, 2.4]) { add(root, new RoundedBoxGeometry(0.9, 0.7, 0.9, 3, 0.05), M({ color: 0x3b3b3b, roughness: 0.6 }), x, 0.35, 14.9); for (let k = 0; k < 14; k++) { const lf = add(root, new THREE.ConeGeometry(0.1, 1.1, 4), M({ color: 0x2f5a2a, roughness: 0.7, side: THREE.DoubleSide }), x + (Math.sin(k * 2.1) * 0.35), 1.0 + (k % 3) * 0.12, 14.9 + Math.cos(k * 1.7) * 0.35); lf.rotation.set(Math.sin(k) * 0.5, k, Math.cos(k * 1.3) * 0.5); } }

  // ---------- wet-floor sign (A-frame)
  out.wetSign = wetFloorSign(root, new THREE.Vector3(1.55, 0, 5.2));

  // ---------- footprints from the door to the board
  const fp = canvasTex(64, 128, (g) => { g.fillStyle = 'rgba(0,0,0,0.55)'; g.beginPath(); g.ellipse(32, 40, 18, 30, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(32, 100, 14, 18, 0, 0, 7); g.fill(); });
  const fpm = new THREE.MeshBasicMaterial({ map: fp, transparent: true, depthWrite: false, opacity: 0.35, color: 0x223344 });
  const steps = [[8.2, 15.2], [8.5, 14.6], [8.8, 14.0], [9.1, 13.4], [9.45, 12.85], [9.8, 12.35]];
  steps.forEach(([x, z], i) => { const m = add(root, new THREE.PlaneGeometry(0.11, 0.26), fpm, x + (i % 2 ? 0.1 : -0.1), 0.006, z, { rx: -Math.PI / 2, cast: false, receive: false }); m.rotation.z = -0.5; m.renderOrder = 2; });

  out.update = (dt) => {
    doorOpen += (doorGoal - doorOpen) * Math.min(1, dt * 3.2);
    leaves.forEach((l) => (l.g.position.x = l.x0 + l.s * doorOpen * (dW - 0.05)));
    const p = rg.attributes.position.array;
    for (let i = 0; i < N + ND; i++) { const o = i * 6; let y = p[o + 1] - sp[i] * dt; const len = i >= N ? 0.5 : 0.8; if (y < len) y += y0[i]; p[o + 1] = y; p[o + 4] = y - len; }
    rg.attributes.position.needsUpdate = true;
    sl.forEach((s, i) => { s.t += dt * 2.5; if (s.t > 1) { s.t = 0; s.x = -10 + r() * 40; s.z = CURB.canopyEdge + 0.2 + r() * 12; } const k = 0.3 + s.t * 2.2; sm.position.set(s.x, 0.01, s.z); sm.rotation.set(-Math.PI / 2, 0, 0); sm.scale.setScalar(k); sm.updateMatrix(); splash.setMatrixAt(i, sm.matrix); });
    splash.instanceMatrix.needsUpdate = true;
    out.taxi.update(dt);
  };
  out.setLightning = (L) => { rm.opacity = 0.35 + L * 0.5; sky.material.color.setRGB(0.75 + L * 3, 0.78 + L * 3, 0.85 + L * 3); };
  return out;
}

function buildTaxi(root, at) {
  // sedan built from a side profile. heading -x (group rotated π); local +x = front, -z = left (driver), +z = right (curb)
  const g = new THREE.Group(); g.position.copy(at); g.rotation.y = Math.PI; root.add(g);
  const paint = new THREE.MeshPhysicalMaterial({ color: 0xd9a010, roughness: 0.4, metalness: 0.05, clearcoat: 0.5, clearcoatRoughness: 0.2, envMapIntensity: 0.7 });
  const black = M({ color: 0x0f1012, roughness: 0.6 });
  const trim = M({ color: 0x1b1c1f, roughness: 0.45, metalness: 0.4 });
  const chrome = M({ color: 0xcfd3d8, metalness: 1, roughness: 0.22 });
  const tint = new THREE.MeshPhysicalMaterial({ color: 0x1a2129, roughness: 0.12, transparent: true, opacity: 0.24, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 0.35 });
  const L = 4.75, Wd = 1.84, BELT = 0.97, ROOF = 1.46;
  const xs = (x) => x;   // profile coordinates already local
  // --- side profile (with wheel arches)
  const side = new THREE.Shape();
  side.moveTo(-L / 2, 0.36);
  side.lineTo(-1.9, 0.3); side.absarc(-1.45, 0.34, 0.44, Math.PI, 0, true);
  side.lineTo(0.98, 0.3); side.absarc(1.45, 0.34, 0.44, Math.PI, 0, true);
  side.lineTo(L / 2, 0.36); side.lineTo(L / 2 + 0.02, 0.62); side.lineTo(L / 2 - 0.15, 0.8); side.lineTo(1.95, 0.86);
  side.lineTo(0.95, BELT); side.lineTo(-1.35, BELT); side.lineTo(-1.95, 0.94); side.lineTo(-L / 2 + 0.05, 0.86); side.lineTo(-L / 2, 0.36);
  const ext = (shape, depth, bevel = 0.03) => { const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 16 }); geo.translate(0, 0, -depth / 2); return geo; };
  for (const sz of [1, -1]) add(g, ext(side, 0.05), paint, 0, 0, sz * (Wd / 2 - 0.05));
  // hood block and trunk block between the side panels
  const hood = new THREE.Shape(); hood.moveTo(0.95, 0.45); hood.lineTo(L / 2 - 0.02, 0.45); hood.lineTo(L / 2, 0.62); hood.lineTo(L / 2 - 0.15, 0.8); hood.lineTo(1.95, 0.86); hood.lineTo(0.95, BELT - 0.01); hood.closePath();
  add(g, ext(hood, Wd - 0.14, 0.02), paint, 0, 0, 0);
  const trunk = new THREE.Shape(); trunk.moveTo(-1.35, 0.45); trunk.lineTo(-1.35, BELT - 0.01); trunk.lineTo(-1.95, 0.94); trunk.lineTo(-L / 2 + 0.05, 0.86); trunk.lineTo(-L / 2 + 0.02, 0.45); trunk.closePath();
  add(g, ext(trunk, Wd - 0.14, 0.02), paint, 0, 0, 0);
  // floor, seats, dash, wheel (hollow cabin so the driver reads through the windows)
  add(g, new THREE.BoxGeometry(2.3, 0.05, Wd - 0.12), M({ color: 0x151618, roughness: 0.9 }), -0.2, 0.32, 0);
  const seatM = M({ color: 0x24252a, roughness: 0.85 });
  for (const z of [0.42, -0.42]) { add(g, new RoundedBoxGeometry(0.55, 0.14, 0.52, 2, 0.04), seatM, 0.05, 0.5, z); add(g, new RoundedBoxGeometry(0.13, 0.66, 0.5, 2, 0.04), seatM, -0.28, 0.86, z, { rz: 0.12 }); }
  add(g, new RoundedBoxGeometry(0.55, 0.14, Wd - 0.2, 2, 0.04), seatM, -0.95, 0.5, 0); add(g, new RoundedBoxGeometry(0.13, 0.6, Wd - 0.2, 2, 0.04), seatM, -1.25, 0.84, 0, { rz: 0.1 });
  add(g, new RoundedBoxGeometry(0.35, 0.2, Wd - 0.16, 2, 0.05), trim, 0.82, 0.92, 0);
  const wheel = add(g, new THREE.TorusGeometry(0.17, 0.022, 8, 28), black, 0.6, 1.0, -0.42, { ry: Math.PI / 2 }); wheel.rotateX(0.45);
  // greenhouse: pillars + roof + glass
  const pill = (x0, y0, x1, y1, z) => { const len = Math.hypot(x1 - x0, y1 - y0); const m = add(g, new RoundedBoxGeometry(0.08, len, 0.07, 2, 0.02), paint, (x0 + x1) / 2, (y0 + y1) / 2, z); m.rotation.z = -Math.atan2(x1 - x0, y1 - y0); return m; };
  for (const sz of [1, -1]) { const z = sz * (Wd / 2 - 0.07); pill(0.95, BELT, 0.42, ROOF, z); pill(-0.25, BELT, -0.3, ROOF, z); pill(-1.38, BELT, -1.02, ROOF, z); }
  add(g, new RoundedBoxGeometry(1.5, 0.07, Wd - 0.1, 3, 0.03), paint, -0.3, ROOF, 0);
  const pane = (pts, z) => { const sh = new THREE.Shape(); sh.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach((p) => sh.lineTo(p[0], p[1])); const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), tint); m.position.z = z; g.add(m); return m; };
  const zL = -(Wd / 2 - 0.06), zR = Wd / 2 - 0.06;
  pane([[0.9, BELT], [0.42, ROOF - 0.02], [-0.26, ROOF - 0.02], [-0.21, BELT]], zL);          // front-left
  pane([[-0.3, BELT], [-0.34, ROOF - 0.02], [-1.03, ROOF - 0.02], [-1.33, BELT]], zL);        // rear-left
  pane([[-0.3, BELT], [-0.34, ROOF - 0.02], [-1.03, ROOF - 0.02], [-1.33, BELT]], zR);        // rear-right (front-right is open)
  const ws = new THREE.Mesh(new THREE.PlaneGeometry(Wd - 0.18, Math.hypot(0.53, ROOF - BELT)), tint); ws.position.set(0.685, (BELT + ROOF) / 2, 0); ws.rotateY(Math.PI / 2); ws.rotateX(-Math.atan2(0.53, ROOF - BELT)); g.add(ws);
  const rw = new THREE.Mesh(new THREE.PlaneGeometry(Wd - 0.18, Math.hypot(0.36, ROOF - BELT)), tint); rw.position.set(-1.2, (BELT + ROOF) / 2, 0); rw.rotateY(-Math.PI / 2); rw.rotateX(-Math.atan2(0.36, ROOF - BELT)); g.add(rw);
  // wheels
  for (const [x, z] of [[1.45, 0.8], [1.45, -0.8], [-1.45, 0.8], [-1.45, -0.8]]) {
    add(g, new THREE.CylinderGeometry(0.34, 0.34, 0.22, 28), black, x, 0.34, z, { rx: Math.PI / 2 });
    add(g, new THREE.CylinderGeometry(0.21, 0.21, 0.23, 20), chrome, x, 0.34, z, { rx: Math.PI / 2 });
  }
  // bumpers, lights, mirrors, handles
  for (const x of [L / 2 + 0.02, -L / 2 - 0.02]) add(g, new RoundedBoxGeometry(0.1, 0.16, Wd - 0.04, 2, 0.04), trim, x, 0.42, 0);
  const head = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.2, 1.9) }), tail = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 0.1, 0.08) });
  for (const sz of [1, -1]) {
    add(g, new RoundedBoxGeometry(0.06, 0.1, 0.34, 2, 0.02), head, L / 2 + 0.01, 0.68, sz * 0.62, { cast: false });
    add(g, new RoundedBoxGeometry(0.06, 0.1, 0.3, 2, 0.02), tail, -L / 2 + 0.03, 0.76, sz * 0.64, { cast: false });
    add(g, new RoundedBoxGeometry(0.1, 0.09, 0.16, 2, 0.03), trim, 0.9, 1.05, sz * (Wd / 2 + 0.07));
    for (const x of [0.45, -0.7]) add(g, new RoundedBoxGeometry(0.16, 0.03, 0.02, 2, 0.01), chrome, x, 0.86, sz * (Wd / 2 + 0.005));
    add(g, new THREE.BoxGeometry(0.012, 0.5, 0.008), M({ color: 0x5a3f06 }), -0.27, 0.68, sz * (Wd / 2 + 0.002), { cast: false });
  }
  // roof sign + checker stripe
  const ts = canvasTex(256, 64, (q) => { q.fillStyle = '#fff6cc'; q.fillRect(0, 0, 256, 64); q.fillStyle = '#111'; q.font = 'bold 50px Arial'; q.textAlign = 'center'; q.textBaseline = 'middle'; q.fillText('TAXI', 128, 34); });
  add(g, new RoundedBoxGeometry(0.2, 0.18, 0.62, 2, 0.04), new THREE.MeshBasicMaterial({ map: ts, color: new THREE.Color(1.2, 1.2, 1.1) }), -0.3, ROOF + 0.12, 0, { ry: Math.PI / 2 });
  const ck = canvasTex(512, 32, (q) => { for (let i = 0; i < 32; i++) for (let j = 0; j < 2; j++) { q.fillStyle = (i + j) % 2 ? '#111' : '#e9ad12'; q.fillRect(i * 16, j * 16, 16, 16); } });
  for (const sz of [1, -1]) add(g, new THREE.PlaneGeometry(2.4, 0.06), new THREE.MeshStandardMaterial({ map: ck, roughness: 0.4 }), -0.2, 0.74, sz * (Wd / 2 + 0.006), { ry: sz > 0 ? 0 : Math.PI, cast: false });
  // rear-right door (curb side), hinged at its front edge
  const hinge = new THREE.Group(); hinge.position.set(-0.26, 0, Wd / 2 + 0.01); g.add(hinge);
  add(hinge, new RoundedBoxGeometry(1.08, 0.6, 0.05, 2, 0.02), paint, -0.54, 0.66, 0);
  let dOpen = 0, dGoal = 0;
  const out = { group: g, setDoor: (o) => (dGoal = o ? 1 : 0), update: (dt) => { dOpen += (dGoal - dOpen) * Math.min(1, dt * 4); hinge.rotation.y = dOpen * 1.05; hinge.visible = dOpen > 0.02; } };
  g.updateMatrixWorld(true);
  out.driverSeat = new THREE.Vector3(0.05, 0, -0.42).applyMatrix4(g.matrixWorld);
  out.rearDoor = new THREE.Vector3(-0.75, 0, Wd / 2 + 0.55).applyMatrix4(g.matrixWorld);
  out.passWindow = new THREE.Vector3(0.3, 1.15, Wd / 2).applyMatrix4(g.matrixWorld);
  return out;
}

function wetFloorSign(root, at) {
  const g = new THREE.Group(); g.position.copy(at); g.rotation.y = 0.7; root.add(g);
  const t = canvasTex(256, 512, (q) => {
    q.fillStyle = '#ffd21f'; q.fillRect(0, 0, 256, 512);
    q.fillStyle = '#111'; q.beginPath(); q.moveTo(128, 40); q.lineTo(220, 200); q.lineTo(36, 200); q.closePath(); q.fill();
    q.fillStyle = '#ffd21f'; q.font = 'bold 120px Arial'; q.textAlign = 'center'; q.fillText('!', 128, 190);
    q.fillStyle = '#111'; q.font = 'bold 46px Arial'; q.fillText('CUIDADO', 128, 290); q.font = 'bold 40px Arial'; q.fillText('PISO', 128, 360); q.fillText('MOLHADO', 128, 410);
  });
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.5 });
  for (const s of [1, -1]) { const geo = new THREE.PlaneGeometry(0.32, 0.62); geo.translate(0, -0.31, 0); const p = new THREE.Mesh(geo, m); p.position.set(0, 0.62, 0); p.rotation.x = s * 0.26; p.castShadow = true; g.add(p); const back = new THREE.Mesh(geo, m); back.rotation.y = Math.PI; p.add(back); }
  return g;
}
