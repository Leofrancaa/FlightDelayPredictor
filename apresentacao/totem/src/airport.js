import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import * as T from './textures.js';

const M = (o) => new THREE.MeshStandardMaterial(o);
const P = (o) => new THREE.MeshPhysicalMaterial(o);

function add(parent, geo, mat, x = 0, y = 0, z = 0, opts = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (opts.ry) m.rotation.y = opts.ry;
  if (opts.rx) m.rotation.x = opts.rx;
  if (opts.rz) m.rotation.z = opts.rz;
  m.castShadow = opts.cast ?? true; m.receiveShadow = opts.receive ?? true;
  parent.add(m); return m;
}

export const HALL = { x0: -34, x1: 34, z0: -22, z1: 16, h: 9.5 };
export const ENT = { x0: 4.5, x1: 11.5, h: 4.2 };   // landside entrance opening in the back wall

export function buildAirport(scene, { quality = 'high', flights }) {
  const root = new THREE.Group(); scene.add(root);
  const out = { root, lightning: { level: 0 }, update: () => {} };
  const W = HALL.x1 - HALL.x0, D = HALL.z1 - HALL.z0;
  const cx = (HALL.x0 + HALL.x1) / 2, cz = (HALL.z0 + HALL.z1) / 2;

  // ---------- materials
  const tz = T.terrazzo();
  const floorMat = M({ map: tz.map, roughnessMap: tz.rough, roughness: 1, metalness: 0, transparent: quality !== 'low', opacity: 0.86 });
  const brushedTex = T.brushed();
  const steel = M({ color: 0xb8bcc2, metalness: 0.95, roughness: 0.32, roughnessMap: brushedTex });
  const darkSteel = M({ color: 0x2a2d32, metalness: 0.8, roughness: 0.45 });
  const whitePaint = M({ color: 0xeeeeec, roughness: 0.55 });
  const wallMat = M({ color: 0x9c9890, roughness: 0.8 });
  const woodMat = M({ color: 0x8a6142, roughness: 0.6 });
  const ceilTex = T.ceiling();
  const ceilMat = M({ map: ceilTex, roughness: 0.9, color: 0x8a8a88 });
  const lightStrip = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.97, 0.9).multiplyScalar(3) });

  // ---------- floor (reflector under semi-transparent terrazzo)
  if (quality !== 'low') {
    const refl = new Reflector(new THREE.PlaneGeometry(W, D), {
      textureWidth: Math.min(1024, innerWidth * 0.6) | 0, textureHeight: Math.min(1024, innerHeight * 0.6) | 0, color: 0x9a9a9a
    });
    refl.rotation.x = -Math.PI / 2; refl.position.set(cx, -0.002, cz);
    root.add(refl);
  }
  const floor = add(root, new THREE.PlaneGeometry(W, D), floorMat, cx, 0, cz, { rx: -Math.PI / 2, cast: false });
  floor.material.map.repeat.set(W / 2.4, D / 2.4); floor.material.roughnessMap.repeat.set(W / 2.4, D / 2.4);
  floor.renderOrder = 1;

  // ---------- ceiling with linear light slots
  const ceil = add(root, new THREE.PlaneGeometry(W, D), ceilMat, cx, HALL.h, cz, { rx: Math.PI / 2, cast: false });
  ceilMat.map.repeat.set(W / 1.2, D / 1.2);
  for (let z = HALL.z0 + 3; z < HALL.z1 - 1; z += 4) {
    add(root, new THREE.BoxGeometry(W - 4, 0.06, 0.22), lightStrip, cx, HALL.h - 0.03, z, { cast: false, receive: false });
  }
  // big structural beams
  for (let x = HALL.x0 + 4; x < HALL.x1; x += 8) {
    add(root, new THREE.BoxGeometry(0.5, 0.9, D), whitePaint, x, HALL.h - 0.45, cz, { cast: false });
  }

  // ---------- columns
  const colGeo = new THREE.CylinderGeometry(0.42, 0.42, HALL.h, 40);
  const baseGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.25, 40);
  for (let x = HALL.x0 + 4; x < HALL.x1; x += 8) {
    for (const z of [-12, 6]) {
      add(root, colGeo, whitePaint, x, HALL.h / 2, z);
      add(root, baseGeo, steel, x, 0.125, z);
    }
  }

  // ---------- side & back walls
  add(root, new THREE.PlaneGeometry(D, HALL.h), wallMat, HALL.x0, HALL.h / 2, cz, { ry: Math.PI / 2, cast: false });
  add(root, new THREE.PlaneGeometry(D, HALL.h), wallMat, HALL.x1, HALL.h / 2, cz, { ry: -Math.PI / 2, cast: false });
  // back (landside) wall with the entrance opening x∈[ENT.x0, ENT.x1], y < ENT.h
  const wl = ENT.x0 - HALL.x0, wr = HALL.x1 - ENT.x1;
  add(root, new THREE.PlaneGeometry(wl, HALL.h), wallMat, HALL.x0 + wl / 2, HALL.h / 2, HALL.z1, { ry: Math.PI, cast: false });
  add(root, new THREE.PlaneGeometry(wr, HALL.h), wallMat, ENT.x1 + wr / 2, HALL.h / 2, HALL.z1, { ry: Math.PI, cast: false });
  add(root, new THREE.PlaneGeometry(ENT.x1 - ENT.x0, HALL.h - ENT.h), wallMat, (ENT.x0 + ENT.x1) / 2, ENT.h + (HALL.h - ENT.h) / 2, HALL.z1, { ry: Math.PI, cast: false });
  const dm = new THREE.Object3D();
  // wood slat cladding on the back (z1) wall (texture, avoids moire)
  const sc = document.createElement('canvas'); sc.width = 512; sc.height = 64; const sg = sc.getContext('2d');
  sg.fillStyle = '#2b1d14'; sg.fillRect(0, 0, 512, 64);
  for (let i = 0; i < 16; i++) { const gr = sg.createLinearGradient(i * 32, 0, i * 32 + 22, 0); gr.addColorStop(0, '#7a5236'); gr.addColorStop(0.5, '#93663f'); gr.addColorStop(1, '#6a462d'); sg.fillStyle = gr; sg.fillRect(i * 32 + 2, 0, 22, 64); }
  const st = new THREE.CanvasTexture(sc); st.colorSpace = THREE.SRGBColorSpace; st.wrapS = st.wrapT = THREE.RepeatWrapping; st.repeat.set(W / 2.56, 1); st.anisotropy = 8;
  add(root, new THREE.PlaneGeometry(W, HALL.h - ENT.h - 0.3), M({ map: st, roughness: 0.65 }), cx, ENT.h + 0.3 + (HALL.h - ENT.h - 0.3) / 2, HALL.z1 - 0.05, { ry: Math.PI, cast: false });

  // ---------- glass curtain wall (z0) + outside world
  const glass = P({ color: 0x9fb4c4, metalness: 0, roughness: 0.04, transparent: true, opacity: 0.12, envMapIntensity: 1.2, side: THREE.DoubleSide, depthWrite: false });
  add(root, new THREE.PlaneGeometry(W, HALL.h), glass, cx, HALL.h / 2, HALL.z0, { cast: false, receive: false });
  const mull = new THREE.BoxGeometry(0.12, HALL.h, 0.25);
  for (let x = HALL.x0; x <= HALL.x1; x += 2.5) add(root, mull, darkSteel, x, HALL.h / 2, HALL.z0, { receive: false });
  for (const y of [0.1, 3.2, 6.4, HALL.h - 0.1]) add(root, new THREE.BoxGeometry(W, 0.12, 0.25), darkSteel, cx, y, HALL.z0, { receive: false });

  // outside: sky dome (cylinder), tarmac, airplane, rain, runway lights
  const skyTex = T.stormSky();
  const skyMat = new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, toneMapped: true });
  const sky = new THREE.Mesh(new THREE.CylinderGeometry(260, 260, 160, 64, 1, true, Math.PI * 0.5, Math.PI), skyMat);
  sky.position.set(0, 60, HALL.z0); sky.rotation.y = Math.PI; root.add(sky);
  const skyColorBase = new THREE.Color(1, 1, 1);
  const tarm = T.tarmac();
  add(root, new THREE.PlaneGeometry(520, 260), M({ map: tarm, roughness: 0.25, metalness: 0.1, color: 0x6a6a6a, fog: false }), 0, -0.4, HALL.z0 - 130, { rx: -Math.PI / 2, cast: false });
  // apron lights (sodium)
  const apronLights = [];
  for (let i = 0; i < 4; i++) {
    const L = new THREE.PointLight(0xffb36b, 60, 70, 2); L.position.set(-45 + i * 30, 18, HALL.z0 - 35); root.add(L); apronLights.push(L);
    add(root, new THREE.CylinderGeometry(0.2, 0.25, 18, 8), darkSteel, -45 + i * 30, 9, HALL.z0 - 35, { cast: false });
    add(root, new THREE.SphereGeometry(0.6, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.7, 0.4).multiplyScalar(8) }), -45 + i * 30, 18, HALL.z0 - 35, { cast: false });
  }
  // runway/taxiway lights far away
  const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.18, 6, 4), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 0.6, 1).multiplyScalar(10) }), 160);
  const r = T.rng(9);
  for (let i = 0; i < 160; i++) { dm.position.set(-160 + i * 2 + r() * 0.2, 0, HALL.z0 - 90 - (i % 2) * 22); dm.scale.setScalar(1); dm.updateMatrix(); dots.setMatrixAt(i, dm.matrix); }
  root.add(dots);
  out.plane = buildPlane(root, new THREE.Vector3(-6, 0, HALL.z0 - 30));

  // rain streaks outside
  const RAIN = quality === 'low' ? 1500 : 5000;
  const rainGeo = new THREE.BufferGeometry();
  const rp = new Float32Array(RAIN * 6), rspeed = new Float32Array(RAIN);
  for (let i = 0; i < RAIN; i++) {
    const x = (r() - 0.5) * 120, y = r() * 40, z = HALL.z0 - 2 - r() * 60;
    rp.set([x, y, z, x - 0.05, y - 0.9, z], i * 6); rspeed[i] = 22 + r() * 10;
  }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rp, 3));
  const rainMat = new THREE.LineBasicMaterial({ color: 0x9fb2c8, transparent: true, opacity: 0.35 });
  const rain = new THREE.LineSegments(rainGeo, rainMat); rain.frustumCulled = false; root.add(rain);

  // lightning light (from outside, washes in through glass)
  const flash = new THREE.DirectionalLight(0xc9d8ff, 0); flash.position.set(-20, 60, HALL.z0 - 80); flash.target.position.set(0, 0, 0);
  root.add(flash, flash.target);

  // ---------- interior furniture
  buildCheckin(root, steel, darkSteel, whitePaint);
  buildSeating(root, steel, darkSteel);
  // planters
  const planter = M({ color: 0x3b3b3b, roughness: 0.6 });
  const leaf = M({ color: 0x2f5a2a, roughness: 0.7, side: THREE.DoubleSide });
  for (const p of [[-9, 6.8], [9, 6.8], [17, -6]]) {
    add(root, new RoundedBoxGeometry(1.6, 0.6, 1.6, 3, 0.05), planter, p[0], 0.3, p[1]);
    for (let k = 0; k < 18; k++) {
      const lf = add(root, new THREE.ConeGeometry(0.12, 1.3, 4), leaf, p[0] + (r() - 0.5) * 1.0, 1.1 + r() * 0.4, p[1] + (r() - 0.5) * 1.0);
      lf.rotation.set((r() - 0.5) * 0.9, r() * 6, (r() - 0.5) * 0.9);
    }
  }

  // ---------- departures boards (hanging)
  const boardTex = T.departuresBoard(flights);
  const boardTexLate = T.departuresBoard(flights.map((f) => (f[1] === 'AA 1455' ? [f[0], f[1], f[2], f[3], 'DELAYED 13:43'] : f)), 'SAT  12:18');
  const boardMat = new THREE.MeshBasicMaterial({ map: boardTex, toneMapped: true });
  out.setDelayed = (on) => { boardMat.map = on ? boardTexLate : boardTex; boardMat.needsUpdate = true; };
  boardMat.color.setScalar(1.6);
  const mkBoard = (x, z, ry) => {
    const g = new THREE.Group(); g.position.set(x, 4.6, z); g.rotation.y = ry; root.add(g);
    add(g, new THREE.BoxGeometry(6.4, 3.8, 0.25), darkSteel, 0, 0, -0.14);
    add(g, new THREE.PlaneGeometry(6.0, 3.375), boardMat, 0, 0, 0.0, { cast: false, receive: false });
    for (const sx of [-2.6, 2.6]) add(g, new THREE.CylinderGeometry(0.02, 0.02, HALL.h - 6.5, 6), steel, sx, (HALL.h - 4.6) / 2 + 1.9 - 0.4, -0.14);
    return g;
  };
  out.board = mkBoard(-7.5, -4.5, 0.25);
  mkBoard(13, -10, -0.2);
  out.board2 = mkBoard(14.2, 7.6, -0.5);   // seen right after the entrance

  // ---------- wayfinding signs (yellow on charcoal, US airport style)
  const sign = (lines, x, y, z, w, ry = 0, arrow = 'right') => {
    const t = T.signTex(lines, { arrow, w: 1536, h: 256, bg: '#1d1f22', fg: '#ffd21f', font: 'bold 120px "Segoe UI", Arial, sans-serif' });
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; root.add(g);
    add(g, new THREE.BoxGeometry(w + 0.1, w / 6 + 0.1, 0.18), darkSteel, 0, 0, -0.1);
    const m = new THREE.MeshBasicMaterial({ map: t }); m.color.setScalar(1.3);
    add(g, new THREE.PlaneGeometry(w, w / 6), m, 0, 0, 0.0, { cast: false });
    add(g, new THREE.CylinderGeometry(0.015, 0.015, HALL.h - y, 6), steel, 0, (HALL.h - y) / 2, -0.1);
  };
  sign(['Gates A1 – A18'], 4.5, 5.6, 1.5, 4.2, 0, 'right');
  sign(['Baggage Claim'], -14, 5.6, 2.5, 3.6, 0.15, 'left');

  // ---------- lighting
  scene.add(new THREE.HemisphereLight(0xdfe6f0, 0x5a5048, 0.35));
  const spots = [];
  const mkSpot = (x, z, tx, tz, I, shadow) => {
    const s = new THREE.SpotLight(0xfff1dd, I, 30, 0.62, 0.65, 1.6); s.userData.base = I; spots.push(s);
    s.position.set(x, HALL.h - 0.2, z); s.target.position.set(tx, 0, tz);
    if (shadow) { s.castShadow = true; s.shadow.mapSize.set(2048, 2048); s.shadow.bias = -0.0002; s.shadow.normalBias = 0.02; s.shadow.radius = 6; s.shadow.camera.near = 2; s.shadow.camera.far = 20; }
    root.add(s, s.target); return s;
  };
  // key over the kiosk, plus area fills
  out.key = mkSpot(1.8, 3.2, 0, 0.3, 120, true);
  mkSpot(-6, 1, -6, -1, 120, quality === 'high');
  mkSpot(6, 5, 5.5, 4, 120, false);
  mkSpot(-14, -6, -14, -6, 100, false);
  mkSpot(12, -8, 12, -8, 100, false);
  mkSpot(0, -10, 0, -10, 100, false);
  mkSpot(0, 11, 0, 11, 90, false);
  out.entranceKey = mkSpot(9, 11.5, 8, 12, 110, quality === 'high');
  mkSpot(0.2, 10, -0.2, 11.5, 90, false);
  // lights flicker during a strike (power dip)
  let flick = 0; out.flicker = () => { flick = 0.9; };

  // ---------- update (rain, lightning)
  let nextStrike = 9, strike = 0, strikeT = 0;
  out.strikeNow = () => { nextStrike = 0; };
  out.update = (dt, t) => {
    const pos = rainGeo.attributes.position.array;
    for (let i = 0; i < RAIN; i++) {
      const o = i * 6; let y = pos[o + 1] - rspeed[i] * dt;
      if (y < -0.4) y += 40;
      pos[o + 1] = y; pos[o + 4] = y - 0.9;
    }
    rainGeo.attributes.position.needsUpdate = true;
    // lightning: a few quick flickers
    nextStrike -= dt;
    if (nextStrike <= 0) { strike = 1; strikeT = 0; nextStrike = 14 + Math.random() * 10; out.onStrike?.(); }
    let L = 0;
    if (strike) {
      strikeT += dt;
      const f = strikeT < 0.08 ? 1 : strikeT < 0.16 ? 0.15 : strikeT < 0.26 ? 0.9 : strikeT < 0.7 ? Math.max(0, 0.7 - (strikeT - 0.26) * 1.6) : 0;
      L = f; if (strikeT > 0.8) strike = 0;
    }
    out.lightning.level = L;
    if (flick > 0) { flick -= dt; const k = flick > 0.75 ? 0.15 : flick > 0.6 ? 1 : flick > 0.5 ? 0.3 : flick > 0 ? 0.3 + (0.5 - flick) * 1.4 : 1; spots.forEach((s) => (s.intensity = s.userData.base * Math.min(1, k))); lightStrip.color.setRGB(3 * k, 2.91 * k, 2.7 * k); }
    else if (flick > -1) { flick = -2; spots.forEach((s) => (s.intensity = s.userData.base)); lightStrip.color.setRGB(3, 2.91, 2.7); }
    flash.intensity = L * 1.6;
    skyMat.color.copy(skyColorBase).multiplyScalar(1 + L * 6);
    rainMat.opacity = 0.3 + L * 0.5;
  };
  return out;
}

function buildPlane(root, at) {
  const g = new THREE.Group(); g.position.copy(at); g.rotation.y = -0.35; root.add(g);
  const white = new THREE.MeshStandardMaterial({ color: 0xe8ebef, roughness: 0.35, metalness: 0.2, fog: false });
  const tail = new THREE.MeshStandardMaterial({ color: 0x1a2c5c, roughness: 0.4 });
  const win = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.85, 0.6).multiplyScalar(2.5) });
  const L = 38, R = 2.0;
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(R, L, 8, 24), white); body.rotation.z = Math.PI / 2; body.position.y = 4.2; g.add(body);
  for (let i = 0; i < 34; i++) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.4), win); w.position.set(-15 + i * 0.95, 4.6, R + 0.01); g.add(w);
  }
  const wing = new THREE.Mesh(new THREE.BoxGeometry(7, 0.35, 34), white); wing.position.set(1, 3.2, 0); wing.rotation.y = 0.25; g.add(wing);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(6, 7, 0.35), tail); fin.position.set(-19, 8.5, 0); fin.rotation.z = 0.45; g.add(fin);
  const stab = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.25, 12), white); stab.position.set(-20, 5, 0); g.add(stab);
  for (const s of [-1, 1]) {
    const eng = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.0, 4, 20), new THREE.MeshStandardMaterial({ color: 0x9aa1aa, metalness: 0.6, roughness: 0.3 }));
    eng.rotation.z = Math.PI / 2; eng.position.set(3, 2.2, s * 6.5); g.add(eng);
  }
  // nav + beacon lights
  const red = new THREE.PointLight(0xff2020, 8, 20); red.position.set(1, 3.5, -17); g.add(red);
  const grn = new THREE.PointLight(0x20ff40, 8, 20); grn.position.set(1, 3.5, 17); g.add(grn);
  const bea = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.1, 0.1).multiplyScalar(10) })); bea.position.set(0, 6.3, 0); g.add(bea);
  // jet bridge
  const jb = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 16), new THREE.MeshStandardMaterial({ color: 0x8c9096, roughness: 0.5, metalness: 0.4 }));
  jb.position.set(-8, 4.5, 10); jb.rotation.y = 0.2; g.add(jb);
  return { group: g, beacon: bea };
}

function buildCheckin(root, steel, darkSteel, white) {
  const desk = new THREE.MeshStandardMaterial({ color: 0xf1f0ee, roughness: 0.3 });
  const top = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.25, metalness: 0.1 });
  const blue = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.1, 0.45, 1).multiplyScalar(3) });
  for (let i = 0; i < 6; i++) {
    const x = -27 + i * 3.4, z = -15.5;
    const g = new THREE.Group(); g.position.set(x, 0, z); root.add(g);
    const d = new THREE.Mesh(new RoundedBoxGeometry(2.6, 1.05, 0.8, 3, 0.04), desk); d.position.y = 0.525; d.castShadow = d.receiveShadow = true; g.add(d);
    const t = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.04, 0.9), top); t.position.y = 1.07; g.add(t);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.04, 0.01), blue); strip.position.set(0, 0.2, 0.41); g.add(strip);
    const mon = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.36, 0.04), darkSteel); mon.position.set(0.4, 1.35, -0.1); g.add(mon);
    // overhead number screen
    const tex = (() => { const c = document.createElement('canvas'); c.width = 512; c.height = 160; const q = c.getContext('2d'); q.fillStyle = '#0b2a66'; q.fillRect(0, 0, 512, 160); q.fillStyle = '#fff'; q.font = 'bold 80px "Segoe UI",Arial'; q.textBaseline = 'middle'; q.fillText(String(i + 11), 30, 82); q.font = '54px "Segoe UI",Arial'; q.fillText(i < 3 ? 'Check-in' : 'Bag Drop', 160, 82); const tt = new THREE.CanvasTexture(c); tt.colorSpace = THREE.SRGBColorSpace; return tt; })();
    const sm = new THREE.MeshBasicMaterial({ map: tex }); sm.color.setScalar(1.4);
    const s = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.44), sm); s.position.set(0, 2.6, 0.2); g.add(s);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 8), steel); pole.position.set(0, 1.85, -0.2); g.add(pole);
  }
  // queue stanchions
  const post = new THREE.CylinderGeometry(0.03, 0.03, 0.95, 10), base = new THREE.CylinderGeometry(0.16, 0.16, 0.03, 16);
  const belt = new THREE.MeshStandardMaterial({ color: 0x15306b, roughness: 0.6 });
  for (let i = 0; i < 8; i++) {
    for (const z of [-12.4, -11.2]) {
      const x = -26 + i * 2.2;
      const p = new THREE.Mesh(post, steel); p.position.set(x, 0.475, z); p.castShadow = true; root.add(p);
      const b = new THREE.Mesh(base, steel); b.position.set(x, 0.015, z); root.add(b);
      if (i < 7) { const bl = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.05, 0.005), belt); bl.position.set(x + 1.1, 0.9, z); root.add(bl); }
    }
  }
}

function buildSeating(root, steel, darkSteel) {
  const seat = new THREE.MeshStandardMaterial({ color: 0x1f2a36, roughness: 0.5, metalness: 0.2 });
  const sGeo = new RoundedBoxGeometry(0.55, 0.08, 0.5, 2, 0.03);
  const bGeo = new RoundedBoxGeometry(0.55, 0.55, 0.06, 2, 0.03);
  for (let row = 0; row < 3; row++) {
    for (const block of [0, 1]) {
      const g = new THREE.Group(); g.position.set(11 + block * 5.2, 0, -1 + row * 2.2); g.rotation.y = Math.PI; root.add(g);
      const beam = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.08, 0.1), steel); beam.position.y = 0.38; beam.castShadow = true; g.add(beam);
      for (let k = 0; k < 7; k++) {
        const x = -1.95 + k * 0.65;
        const s = new THREE.Mesh(sGeo, seat); s.position.set(x, 0.46, 0); s.castShadow = s.receiveShadow = true; g.add(s);
        const b = new THREE.Mesh(bGeo, seat); b.position.set(x, 0.78, -0.24); b.rotation.x = -0.12; b.castShadow = true; g.add(b);
      }
      for (const lx of [-2.0, 2.0]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, 0.45), darkSteel); l.position.set(lx, 0.2, 0); g.add(l); }
    }
  }
}
