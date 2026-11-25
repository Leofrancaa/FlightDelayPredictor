// Narrow-body cabin for the post-credits scene (AA 1455, night, rain on the windows).
// Local frame: aisle along z, front (door, galley) at +z, passengers face +z; floor at y = 0.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries as mergeRaw } from 'three/addons/utils/BufferGeometryUtils.js';
const mergeGeometries = (list) => mergeRaw(list.map((g) => (g.index ? g.toNonIndexed() : g)));

export const CAB = new THREE.Vector3(0, 0, -200);    // world origin of the cabin
export const ROWS = 14, PITCH = 0.84, ROW1 = -0.9;
export const rowZ = (r) => ROW1 - (r - 1) * PITCH;     // z of a row's seat pan centre (local)
export const SEAT_X = { A: -1.56, B: -1.06, C: -0.55, D: 0.55, E: 1.06, F: 1.56 };
const R = 1.98, CY = 0.95, LEN = 16, Z_FRONT = 2.4, Z_BACK = Z_FRONT - LEN;

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}

export function buildCabin(scene) {
  const root = new THREE.Group(); root.position.copy(CAB); scene.add(root); root.visible = false;
  const M = (o) => new THREE.MeshStandardMaterial(o);
  const add = (geo, mat, x, y, z, rot) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (rot) m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0); root.add(m); m.receiveShadow = true; return m; };

  // ---------- shell
  const wallTex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#d9d6cf'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.03})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    g.strokeStyle = 'rgba(0,0,0,0.10)'; g.lineWidth = 2; for (let x = 0; x < w; x += 128) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  }, [LEN / 2, 3]);
  const wallM = M({ map: wallTex, color: 0xc4c1ba, roughness: 0.7, side: THREE.BackSide });
  const shell = add(new THREE.CylinderGeometry(R, R, LEN, 72, 1, true), wallM, 0, CY, (Z_FRONT + Z_BACK) / 2, [Math.PI / 2, 0, 0]);
  shell.receiveShadow = false;
  // carpet: deep blue with a small woven pattern; lighter runner down the aisle
  const carpet = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#1d2a44'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) for (let x = 0; x < w; x += 16) { g.fillStyle = (x + y) % 32 ? '#22314f' : '#19243a'; g.fillRect(x + 2, y + 2, 12, 12); }
    for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.04})`; g.fillRect(Math.random() * w, Math.random() * h, 1, 1); }
  }, [8, 36]);
  add(new THREE.PlaneGeometry(3.6, LEN), M({ map: carpet, roughness: 0.95 }), 0, 0.001, (Z_FRONT + Z_BACK) / 2, [-Math.PI / 2, 0, 0]);
  const runner = canvasTex(64, 256, (g, w, h) => { g.fillStyle = '#2b3b5e'; g.fillRect(0, 0, w, h); g.fillStyle = '#8a98b8'; g.fillRect(0, 0, 3, h); g.fillRect(w - 3, 0, 3, h); for (let y = 0; y < h; y += 32) { g.fillStyle = '#34476f'; g.fillRect(8, y, w - 16, 14); } }, [1, 30]);
  add(new THREE.PlaneGeometry(0.62, LEN - 0.4), M({ map: runner, roughness: 0.9 }), 0, 0.003, (Z_FRONT + Z_BACK) / 2, [-Math.PI / 2, 0, 0]);
  // floor path lights (emissive dots each side of the aisle)
  const pathM = M({ color: 0x000000, emissive: 0xfff0d0, emissiveIntensity: 1.2 });
  for (let r = 1; r <= ROWS; r++) for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.03, 0.01, 0.12), pathM, s * 0.33, 0.012, rowZ(r) + 0.3);

  // ---------- ceiling and overhead bins (extruded cross-section along z)
  const binM = M({ color: 0xcfccc6, roughness: 0.55 });
  const binShape = new THREE.Shape([new THREE.Vector2(1.08, 1.86), new THREE.Vector2(1.84, 1.62), new THREE.Vector2(1.84, 2.4), new THREE.Vector2(1.1, 2.28)]);
  const binGeo = new THREE.ExtrudeGeometry(binShape, { depth: LEN - 1.2, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 });
  for (const s of [-1, 1]) { const b = add(binGeo, binM, 0, 0, Z_BACK + 0.4); if (s < 0) b.scale.x = -1; }
  // bin door seams + handles, one door per two rows
  const seamM = M({ color: 0x8f8d88, roughness: 0.5 });
  for (let z = Z_BACK + 0.4; z < Z_FRONT - 0.8; z += PITCH * 2) for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(0.012, 0.42, 0.012), seamM, s * 1.1, 2.06, z, [0, 0, s * 0.03]);
    add(new RoundedBoxGeometry(0.2, 0.03, 0.04, 2, 0.01), seamM, s * 1.09, 1.92, z + PITCH, [0, 0, -s * 0.3]);
  }
  // ceiling panel and the cove light strips (mood lighting, recoloured by setMood)
  add(new THREE.PlaneGeometry(2.25, LEN - 1.2), M({ color: 0xb9b7b2, roughness: 0.8 }), 0, 2.34, (Z_FRONT + Z_BACK) / 2 + 0.2, [Math.PI / 2, 0, 0]);
  const coveM = M({ color: 0x000000, emissive: 0xffe2bd, emissiveIntensity: 2.2 });
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.05, 0.02, LEN - 1.4), coveM, s * 1.08, 2.32, (Z_FRONT + Z_BACK) / 2 + 0.2);
  // passenger service units under the bins: reading lights, seat-belt signs, a warm strip
  const psuM = M({ color: 0xd2d0ca, roughness: 0.5 }), readM = M({ color: 0x111111, emissive: 0xfff3dc, emissiveIntensity: 0 });
  const signM = M({ color: 0x111111, emissive: 0xffffff, emissiveIntensity: 0.9, map: canvasTex(128, 64, (g) => { g.fillStyle = '#0d0f13'; g.fillRect(0, 0, 128, 64); g.fillStyle = '#fff'; g.font = 'bold 34px sans-serif'; g.textAlign = 'center'; g.fillText('🚭  ⛓', 64, 44); }) });
  const readLights = [];
  for (let r = 1; r <= ROWS; r++) for (const s of [-1, 1]) {
    const z = rowZ(r) + 0.1;
    for (const k of [0, 1, 2]) { const x = 1.2 + k * 0.15, y = 1.86 - (x - 1.08) * 0.316 - 0.012; const l = add(new THREE.CylinderGeometry(0.02, 0.02, 0.01, 12), readM, s * x, y, z); l.rotation.z = s * 0.306; readLights.push(l); }
    add(new THREE.BoxGeometry(0.1, 0.008, 0.05), signM, s * 1.66, 1.86 - (1.66 - 1.08) * 0.316 - 0.012, z - 0.18, [0, 0, s * 0.306]);
  }

  // ---------- windows: night apron, rain streaks
  const night = canvasTex(256, 384, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#0b1424'); gr.addColorStop(0.62, '#152238'); gr.addColorStop(0.64, '#0a0d14'); gr.addColorStop(1, '#06080c');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9; i++) { g.fillStyle = ['#ffb36b', '#ffd9a0', '#9fc3ff'][i % 3]; g.beginPath(); g.arc(Math.random() * w, h * 0.6 + Math.random() * 14, 2 + Math.random() * 2.5, 0, 7); g.fill(); }
    g.strokeStyle = 'rgba(190,210,240,0.25)'; g.lineWidth = 1.5;
    for (let i = 0; i < 40; i++) { const x = Math.random() * w, y = Math.random() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 3, y + 20 + Math.random() * 30); g.stroke(); }
  });
  const glassM = M({ map: night, emissive: 0xffffff, emissiveMap: night, emissiveIntensity: 0.55, roughness: 0.15 });
  const frameM = M({ color: 0xcfccc5, roughness: 0.5 }), shadeM = M({ color: 0xf1f0ec, roughness: 0.8 });
  const winGeo = new RoundedBoxGeometry(0.27, 0.38, 0.02, 3, 0.09), frameGeo = new RoundedBoxGeometry(0.36, 0.48, 0.03, 3, 0.12);
  for (let r = 1; r <= ROWS; r++) for (const s of [-1, 1]) {
    const y = 1.18, dx = Math.sqrt(R * R - (y - CY) ** 2) - 0.04, z = rowZ(r) + 0.12;
    const tilt = Math.asin((y - CY) / R);
    add(frameGeo, frameM, s * dx, y, z, [0, s * Math.PI / 2, -s * tilt]);
    add(winGeo, glassM, s * (dx - 0.012), y, z, [0, -s * Math.PI / 2, s * tilt]);
    if ((r * 7 + (s > 0 ? 3 : 0)) % 5 === 0) add(new THREE.BoxGeometry(0.02, 0.18, 0.27), shadeM, s * (dx - 0.02), y + 0.1, z, [0, 0, -s * tilt]);
  }

  // ---------- seats (instanced: 6 per row)
  const leather = M({ color: 0x1c2638, roughness: 0.55 }), cover = M({ color: 0xcfcbc0, roughness: 0.9 }), shellM = M({ color: 0x4a4f58, roughness: 0.4 }), armM = M({ color: 0x2c3038, roughness: 0.5 });
  const screenTex = canvasTex(128, 80, (g) => { const gr = g.createLinearGradient(0, 0, 128, 80); gr.addColorStop(0, '#0e2f5c'); gr.addColorStop(1, '#0a1630'); g.fillStyle = gr; g.fillRect(0, 0, 128, 80); g.strokeStyle = '#6fa8ff'; g.lineWidth = 2; g.beginPath(); g.moveTo(14, 60); g.quadraticCurveTo(64, 10, 114, 40); g.stroke(); g.fillStyle = '#fff'; g.font = '10px sans-serif'; g.fillText('DFW → LAS', 40, 74); });
  const screenM = M({ color: 0x000000, emissive: 0xffffff, emissiveMap: screenTex, emissiveIntensity: 0.9 });
  const parts = {
    cushion: [mergeGeometries([new RoundedBoxGeometry(0.46, 0.13, 0.48, 2, 0.05).translate(0, 0.43, 0.02), new RoundedBoxGeometry(0.46, 0.68, 0.12, 2, 0.05).rotateX(-0.16).translate(0, 0.82, -0.25)]), leather],
    cover: [new RoundedBoxGeometry(0.3, 0.13, 0.015, 2, 0.006).rotateX(-0.16).translate(0, 1.08, -0.185), cover],
    shell: [mergeGeometries([new RoundedBoxGeometry(0.47, 0.74, 0.06, 2, 0.025).rotateX(-0.16).translate(0, 0.8, -0.33), new THREE.BoxGeometry(0.05, 0.36, 0.05).translate(0, 0.18, -0.05), new THREE.BoxGeometry(0.4, 0.04, 0.5).translate(0, 0.33, 0)]), shellM],
    arm: [new RoundedBoxGeometry(0.05, 0.05, 0.42, 2, 0.02).translate(0.25, 0.62, -0.02), armM],
    screen: [new THREE.PlaneGeometry(0.2, 0.125).rotateY(Math.PI).rotateX(0.16).translate(0, 0.95, -0.37), screenM],
  };
  const seatList = [];
  for (let r = 1; r <= ROWS; r++) for (const k of Object.keys(SEAT_X)) seatList.push(new THREE.Vector3(SEAT_X[k], 0, rowZ(r)));
  const mtx = new THREE.Matrix4();
  for (const [geo, mat] of Object.values(parts)) {
    const im = new THREE.InstancedMesh(geo, mat, seatList.length);
    seatList.forEach((p, i) => im.setMatrixAt(i, mtx.makeTranslation(p.x, p.y, p.z)));
    im.receiveShadow = true; root.add(im);
  }
  // outer armrests by the aisle and the windows
  const outer = new THREE.InstancedMesh(parts.arm[0].clone().translate(-0.5, 0, 0), armM, ROWS * 2);
  for (let r = 1; r <= ROWS; r++) { outer.setMatrixAt((r - 1) * 2, mtx.makeTranslation(SEAT_X.D, 0, rowZ(r))); outer.setMatrixAt((r - 1) * 2 + 1, mtx.makeTranslation(SEAT_X.A, 0, rowZ(r))); }
  root.add(outer);

  // ---------- front: galley wall, door with the jet bridge behind it, rear bulkhead
  const galleyM = M({ color: 0xc9c6bf, roughness: 0.4, metalness: 0.15 });
  add(new THREE.BoxGeometry(2.4, 2.3, 0.08), galleyM, 0.5, 1.15, Z_FRONT - 0.05);
  add(new THREE.BoxGeometry(3.6, 2.4, 0.1), M({ color: 0xdedbd4, roughness: 0.6 }), 0, 1.2, Z_BACK + 0.05);
  const curtain = canvasTex(64, 128, (g) => { g.fillStyle = '#29395c'; g.fillRect(0, 0, 64, 128); for (let x = 0; x < 64; x += 8) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x, 0, 3, 128); } });
  add(new THREE.PlaneGeometry(1.1, 1.9), M({ map: curtain, roughness: 0.9, side: THREE.DoubleSide }), 0.15, 1.0, Z_BACK + 0.3);
  // door opening on the left, front: jet-bridge tunnel (dim, warm) seen through the frame
  const doorZ = 1.35, doorX = -Math.sqrt(R * R - 0.15) + 0.02;
  add(new THREE.BoxGeometry(0.06, 1.95, 1.0), M({ color: 0x0d0f12, emissive: 0x3a2a18, emissiveIntensity: 0.6 }), doorX - 0.05, 0.98, doorZ);
  for (const dz of [-0.53, 0.53]) add(new THREE.BoxGeometry(0.14, 2.0, 0.06), frameM, doorX + 0.05, 1.0, doorZ + dz);
  add(new THREE.BoxGeometry(0.14, 0.08, 1.12), frameM, doorX + 0.05, 2.0, doorZ);
  // the door itself (slides open/closed along the wall)
  const door = add(new RoundedBoxGeometry(0.1, 1.9, 1.02, 3, 0.06), M({ color: 0xd8d5ce, roughness: 0.45 }), doorX + 0.1, 0.98, doorZ + 1.05);
  const doorWin = add(new THREE.CircleGeometry(0.11, 24), glassM, doorX + 0.16, 1.35, doorZ + 1.05, [0, Math.PI / 2, 0]);
  door.add(doorWin); doorWin.position.set(0.06, 0.37, 0); doorWin.rotation.set(0, Math.PI / 2, 0);
  let doorOpen = 1, doorGoal = 1;

  // ---------- lights (warm cabin, kept short-range)
  const lights = [];
  for (const z of [1.2, -2.2, -5.6, -9.0]) { const L = new THREE.PointLight(0xffe6c8, 1.1, 5, 1.8); L.position.set(0, 2.1, z); root.add(L); lights.push(L); }
  const doorL = new THREE.PointLight(0xffc27a, 2.2, 3.5, 1.8); doorL.position.set(doorX + 0.3, 1.7, doorZ); root.add(doorL);

  // ---------- mood: 0 = normal warm; party = beat-driven colour sweeps (magenta/cyan/amber)
  const base = new THREE.Color(0xffe6c8), baseCove = new THREE.Color(0xffe2bd), tmp = new THREE.Color();
  const party = [new THREE.Color(0xff3cc8), new THREE.Color(0x35d0ff), new THREE.Color(0xffb020), new THREE.Color(0x8c5cff)];
  let partyK = 0;
  const out = {
    root, lights,
    toWorld: (x, y, z) => new THREE.Vector3(x, y, z).add(CAB),
    seat: (row, letter) => new THREE.Vector3(SEAT_X[letter], 0, rowZ(row)).add(CAB),
    aisle: (z) => new THREE.Vector3(0, 0, z).add(CAB),
    door: { pos: new THREE.Vector3(doorX + 0.25, 0, doorZ).add(CAB), set: (o) => (doorGoal = o ? 1 : 0) },
    setParty: (k) => { partyK = k; },
    setReading: (on) => { readM.emissiveIntensity = on ? 1.4 : 0; },
    update: (dt, beat) => {
      doorOpen += (doorGoal - doorOpen) * Math.min(1, dt * 3);
      door.position.z = doorZ + 1.05 * doorOpen + 0.0;
      // beat: phase in beats (float); flash at each beat, colour steps every bar
      const b = beat ?? 0, flash = Math.exp(-((b % 1) * 6)), bar = Math.floor(b / 2) % party.length;
      tmp.copy(baseCove).lerp(party[bar], partyK);
      coveM.emissive.copy(tmp); coveM.emissiveIntensity = 0.9 + partyK * (0.8 + 2.2 * flash);
      for (const [i, L] of lights.entries()) { L.color.copy(base).lerp(party[(bar + i) % party.length], partyK * 0.75); L.intensity = 1.1 * (1 - partyK * 0.35) + partyK * 1.6 * flash; }
    },
  };
  return out;
}

// ---------- props for the post-credits scene
export function laptop() {
  const g = new THREE.Group();
  const alu = new THREE.MeshStandardMaterial({ color: 0x9da2a8, metalness: 0.8, roughness: 0.35 });
  const key = new THREE.MeshStandardMaterial({ color: 0x1a1b1e, roughness: 0.7 });
  const base = new THREE.Mesh(new RoundedBoxGeometry(0.32, 0.016, 0.22, 2, 0.006), alu); base.position.y = 0.008; g.add(base);
  const kb = new THREE.Mesh(new THREE.PlaneGeometry(0.27, 0.1), key); kb.rotation.x = -Math.PI / 2; kb.position.set(0, 0.0165, -0.025); g.add(kb);
  const c = document.createElement('canvas'); c.width = 512; c.height = 330; const q = c.getContext('2d');
  q.fillStyle = '#0d1117'; q.fillRect(0, 0, 512, 330);
  q.fillStyle = '#161b22'; q.fillRect(0, 0, 512, 34); q.fillStyle = '#f0b429'; q.font = 'bold 20px sans-serif'; q.fillText('🪙 $SOUSSA — lançamento', 14, 24);
  q.strokeStyle = '#3fb950'; q.lineWidth = 4; q.beginPath(); q.moveTo(20, 230); for (let i = 1; i <= 12; i++) q.lineTo(20 + i * 22, 230 - i * i * 1.2 + (i % 3) * 10); q.stroke();
  q.fillStyle = '#3fb950'; q.font = 'bold 26px monospace'; q.fillText('+4.200%', 30, 280);
  q.fillStyle = '#c9d1d9'; q.font = '17px sans-serif'; q.fillText('Cadastro do investidor', 316, 80);
  ['Nome: Prof. Soussa', 'CPF: ___.___.___-__', 'Chave Pix: _________'].forEach((t, i) => { q.fillStyle = '#21262d'; q.fillRect(310, 98 + i * 50, 186, 36); q.fillStyle = '#c9d1d9'; q.font = '15px monospace'; q.fillText(t, 318, 121 + i * 50); });
  q.fillStyle = '#f0b429'; q.fillRect(310, 255, 186, 40); q.fillStyle = '#111'; q.font = 'bold 17px sans-serif'; q.fillText('CRIAR MOEDA', 345, 281);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const hinge = new THREE.Group(); hinge.position.set(0, 0.016, -0.11); hinge.rotation.x = -0.32; g.add(hinge);
  const lid = new THREE.Mesh(new RoundedBoxGeometry(0.32, 0.21, 0.008, 2, 0.004), alu); lid.position.set(0, 0.105, -0.004); hinge.add(lid);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.19), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 1.1 })); scr.position.set(0, 0.105, 0.0005); hinge.add(scr);
  const glow = new THREE.PointLight(0x9fc0ff, 0.25, 0.9, 2); glow.position.set(0, 0.12, 0.08); hinge.add(glow);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export function djDeck() {
  const g = new THREE.Group();
  const black = new THREE.MeshStandardMaterial({ color: 0x141518, roughness: 0.45, metalness: 0.2 });
  const silver = new THREE.MeshStandardMaterial({ color: 0xc8ccd2, metalness: 0.9, roughness: 0.25 });
  const vinyl = new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.3, metalness: 0.4 });
  const body = new THREE.Mesh(new RoundedBoxGeometry(0.56, 0.05, 0.3, 3, 0.015), black); body.position.y = 0.025; g.add(body);
  const platters = [];
  for (const x of [-0.17, 0.17]) {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.008, 40), silver); ring.position.set(x, 0.054, 0.01); g.add(ring);
    const p = new THREE.Group(); p.position.set(x, 0.06, 0.01); g.add(p); platters.push(p);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.006, 40), vinyl); p.add(disc);
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.007, 0.07), silver); mark.position.set(0, 0.002, 0.04); p.add(mark);
  }
  // mixer: knobs, faders, crossfader
  for (let i = 0; i < 3; i++) for (const x of [-0.035, 0.035]) { const k = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.014, 12), silver); k.position.set(x, 0.057, -0.08 + i * 0.04); g.add(k); }
  const xf = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.014, 0.014), silver); xf.position.set(0, 0.057, 0.11); g.add(xf);
  // pads: 4 per deck, flash on the beat
  const pads = [];
  const cols = [0xff3cc8, 0x35d0ff, 0xffb020, 0x6cff5c];
  for (const x0 of [-0.23, 0.11]) for (let i = 0; i < 4; i++) {
    const m = new THREE.MeshStandardMaterial({ color: 0x050505, emissive: cols[i], emissiveIntensity: 0.6 });
    const pad = new THREE.Mesh(new RoundedBoxGeometry(0.026, 0.008, 0.026, 1, 0.004), m); pad.position.set(x0 + i * 0.034, 0.054, 0.12); g.add(pad); pads.push(m);
  }
  const ledStrip = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x35d0ff, emissiveIntensity: 1.5 });
  const strip = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.006, 0.006), ledStrip); strip.position.set(0, 0.026, 0.152); g.add(strip);
  const glow = new THREE.PointLight(0xff3cc8, 0, 1.6, 2); glow.position.set(0, 0.25, 0.1); g.add(glow);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.userData.update = (dt, beat, on) => {
    for (const p of platters) p.rotation.y -= dt * (on ? 3.5 : 0);
    const f = on ? Math.exp(-((beat % 1) * 5)) : 0, step = Math.floor(beat) % 4;
    pads.forEach((m, i) => { m.emissiveIntensity = on ? 0.4 + (i % 4 === step ? 3.5 * f + 0.8 : 0) : 0.15; });
    ledStrip.emissive.setHSL(((beat / 8) % 1), 0.9, 0.55); ledStrip.emissiveIntensity = on ? 1.5 + 2 * f : 0.3;
    glow.color.copy(ledStrip.emissive); glow.intensity = on ? 0.12 + 0.3 * f : 0;
  };
  return g;
}

// colourful print shirt (Zuma) and plain shirts (Kauai, Lopo)
export function printShirt() {
  return canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = '#f2a516'; g.fillRect(0, 0, w, h);
    const C = ['#d7263d', '#1b998b', '#2e294e', '#f46036', '#c5d86d', '#0b4f6c'];
    for (let y = -64, row = 0; y < h + 64; y += 96, row++) for (let x = -64, col = 0; x < w + 64; x += 96, col++) {
      const cx = x + (row % 2) * 48, cy = y;
      g.fillStyle = C[(row + col) % C.length]; g.beginPath(); g.moveTo(cx, cy - 42); g.lineTo(cx + 42, cy); g.lineTo(cx, cy + 42); g.lineTo(cx - 42, cy); g.closePath(); g.fill();
      g.fillStyle = '#fbe7c6'; g.beginPath(); g.moveTo(cx, cy - 18); g.lineTo(cx + 18, cy); g.lineTo(cx, cy + 18); g.lineTo(cx - 18, cy); g.closePath(); g.fill();
      g.fillStyle = C[(row + col + 3) % C.length]; g.beginPath(); g.arc(cx, cy, 7, 0, 7); g.fill();
    }
    g.strokeStyle = '#1a1a1a'; g.lineWidth = 6; for (let y = 0; y < h; y += 96) { g.beginPath(); for (let x = 0; x <= w; x += 24) g.lineTo(x, y + 48 + ((x / 24) % 2 ? 10 : -10)); g.stroke(); }
  });
}
export function plainShirt(hex, noise = 0.05) {
  return canvasTex(512, 512, (g, w, h) => { g.fillStyle = hex; g.fillRect(0, 0, w, h); for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * noise})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } });
}
