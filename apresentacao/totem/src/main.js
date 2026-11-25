import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { TalkingHead } from './talkinghead.mjs';
import { buildAirport } from './airport.js';
import { buildLandside, CURB, DESK } from './landside.js';
import { createTotem } from './totem.js';
import { ArmIK, HeadLook } from './ik.js';
import * as PROPS from './props.js';
import { CFG, LINES, NAMES, CREDITS } from './config.js';
import { buildCabin, rowZ, laptop, djDeck, printShirt, plainShirt } from './cabin.js';

// ---------------------------------------------------------------- params
const Q = new URLSearchParams(location.search);
const QUALITY = Q.get('q') || 'high';
const EXPORT = Q.has('export');         // offline video export: deterministic frames + event log
const SIM = Q.has('at');                 // headless preview: simulate up to `at` seconds of a scene
const START_SCENE = +(Q.get('scene') || 1);
const SIM_AT = +(Q.get('at') || 0);
const $ = (id) => document.getElementById(id);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const lerp = THREE.MathUtils.lerp;
const smooth = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };

// ---------------------------------------------------------------- renderer
const container = $('stage');
const renderer = new THREE.WebGLRenderer({ antialias: QUALITY === 'low', powerPreference: 'high-performance', preserveDrawingBuffer: SIM || EXPORT });
renderer.setPixelRatio(Math.min(devicePixelRatio, QUALITY === 'high' ? 1.5 : 1));
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.85;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0c10);
scene.fog = new THREE.FogExp2(0x15181d, 0.006);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.45;

const camera = new THREE.PerspectiveCamera(32, container.clientWidth / container.clientHeight, 0.05, 600);
camera.position.set(6, 1.7, 9);

// ---------------------------------------------------------------- world
const airport = buildAirport(scene, { quality: QUALITY, flights: CFG.board });
const land = buildLandside(scene, { quality: QUALITY });
const totem = createTotem(CFG);
scene.add(totem.group);
const cabin = buildCabin(scene);
// which set is live: the airport (main film) or the plane (post-credits)
function setWorld(w) {
  const inPlane = w === 'cabin';
  airport.root.visible = !inPlane; land.root.visible = !inPlane; totem.group.visible = !inPlane; cabin.root.visible = inPlane;
  for (const a of [att, diniz, leo, motti, sa]) a.arm.visible = !inPlane;
  for (const a of [kauai, zuma, lopo]) a.arm.visible = inPlane;
  state.world = w;
}

// ---------------------------------------------------------------- post
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
let gtao = null, bokeh = null;
if (QUALITY !== 'low') {
  gtao = new GTAOPass(scene, camera, container.clientWidth, container.clientHeight);
  gtao.blendIntensity = 0.9;
  gtao.updateGtaoMaterial({ radius: 0.45, distanceExponent: 1.5, thickness: 1.5, scale: 1.0, samples: 12 });
  composer.addPass(gtao);
}
const bloom = new UnrealBloomPass(new THREE.Vector2(container.clientWidth, container.clientHeight), 0.3, 0.5, 0.96);
composer.addPass(bloom);
if (QUALITY === 'high') {
  bokeh = new BokehPass(scene, camera, { focus: 3, aperture: 0.0016, maxblur: 0.008 });
  composer.addPass(bokeh);
}
composer.addPass(new OutputPass());
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uFade: { value: 1 }, uFlash: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime; uniform float uFade; uniform float uFlash; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 d = vUv - 0.5; float r = dot(d,d);
      vec3 c;
      c.r = texture2D(tDiffuse, vUv - d*0.0025).r;
      c.g = texture2D(tDiffuse, vUv).g;
      c.b = texture2D(tDiffuse, vUv + d*0.0025).b;
      // teal/orange film grade
      float l = dot(c, vec3(0.299,0.587,0.114));
      c = mix(c, c * vec3(1.04,1.0,0.94), smoothstep(0.35,0.9,l));
      c = mix(c, c * vec3(0.92,1.0,1.08), 1.0 - smoothstep(0.05,0.4,l));
      c *= 1.0 - r * 0.85;                         // vignette
      c += (h(vUv*1000.0 + uTime) - 0.5) * 0.035;  // grain
      c += uFlash * vec3(0.55,0.62,0.8) * 0.06;
      gl_FragColor = vec4(c * uFade, 1.0);
    }`,
});
composer.addPass(grade);

addEventListener('resize', () => {
  const w = container.clientWidth, h = container.clientHeight;
  renderer.setSize(w, h); composer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
});

// ---------------------------------------------------------------- audio
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const master = audioCtx.createGain(); master.connect(audioCtx.destination);
const recDest = audioCtx.createMediaStreamDestination(); master.connect(recDest);
const audioBuffers = {};
async function loadBuffer(url) {
  try { const r = await fetch(url); if (!r.ok) return null; return await audioCtx.decodeAudioData(await r.arrayBuffer()); } catch { return null; }
}
function ambience() {
  // rain (filtered noise) + terminal murmur
  const len = audioCtx.sampleRate * 4, nb = audioCtx.createBuffer(1, len, audioCtx.sampleRate), d = nb.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = audioCtx.createBufferSource(); src.buffer = nb; src.loop = true;
  const lp = audioCtx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
  const g = audioCtx.createGain(); g.gain.value = 0.012; src.connect(lp).connect(g).connect(master); src.start();
  if (audioBuffers.murmur) { const m = audioCtx.createBufferSource(); m.buffer = audioBuffers.murmur; m.loop = true; const mg = audioCtx.createGain(); mg.gain.value = 0.22; m.connect(mg).connect(master); m.start(); }
}
function thunder(delay = 0.6) {
  if (SIM || audioCtx.state !== 'running') return;
  const t0 = audioCtx.currentTime + delay, len = audioCtx.sampleRate * 5;
  const b = audioCtx.createBuffer(1, len, audioCtx.sampleRate), d = b.getChannelData(0);
  let last = 0; for (let i = 0; i < len; i++) { last = last * 0.985 + (Math.random() * 2 - 1) * 0.15; d[i] = last; }
  const s = audioCtx.createBufferSource(); s.buffer = b;
  const lp = audioCtx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220;
  const g = audioCtx.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.05, t0 + 0.25); g.gain.exponentialRampToValueAtTime(0.018, t0 + 1.6); g.gain.exponentialRampToValueAtTime(0.001, t0 + 4.8);
  s.connect(lp).connect(g).connect(master); s.start(t0);
}
const EVENTS = (window.__events = []);
window.__st = () => ({ vt: +vt.toFixed(2), z: +prof.pos.z.toFixed(2), walk: !!prof.walk, slip: +(prof.slip || 0).toFixed(2), fall: prof.fall ? +prof.fall.t.toFixed(2) : null, k: prof.fall ? +(prof.fall.k || 0).toFixed(2) : null });
function sfx(name, vol = 1) {
  EVENTS.push({ t: vt, type: 'sfx', file: name + '.mp3', vol });
  const b = audioBuffers['sfx_' + name]; if (!b || SIM || audioCtx.state !== 'running') return null;
  const s = audioCtx.createBufferSource(); s.buffer = b; const g = audioCtx.createGain(); g.gain.value = vol; s.connect(g).connect(master); s.start(); return { s, g };
}
// music with a muffled (behind the door) and a clear layer; keys: [t, muffledGain, clearGain] relative to start
const BEAT = 0.5803, BEAT0 = 0.4;   // lopo_music.mp3: ~103 BPM, first downbeat at 0.40 s
let musicT0 = null, musicLive = null;
function music(file, keys) {
  musicT0 = vt; keys = keys.map((k) => k.slice()); keys.push([600, ...keys[keys.length - 1].slice(1)]);
  musicEv = { t: vt, type: 'music', file, keys }; EVENTS.push(musicEv);
  const b = audioBuffers['sfx_' + file.replace(/\.mp3$/, '')]; if (!b || SIM || audioCtx.state !== 'running') return;
  const mk = (muf) => { const s = audioCtx.createBufferSource(); s.buffer = b; const g = audioCtx.createGain(); g.gain.value = 0; let n = s; if (muf) { const lp = audioCtx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520; n.connect(lp); n = lp; } n.connect(g).connect(master); return { s, g }; };
  const A = mk(true), B = mk(false), now = audioCtx.currentTime;
  for (const [t, m, c] of keys) { A.g.gain.linearRampToValueAtTime(m, now + t); B.g.gain.linearRampToValueAtTime(c, now + t); }
  A.s.start(); B.s.start(); musicLive = [A, B];
}
let musicEv = null;
function musicAt(rel) { const k = musicEv.keys; let p = k[0]; for (const q of k) { if (q[0] >= rel) { const u = q[0] > p[0] ? (rel - p[0]) / (q[0] - p[0]) : 1; return [p[1] + (q[1] - p[1]) * u, p[2] + (q[2] - p[2]) * u]; } p = q; } return [p[1], p[2]]; }
function musicTo(muf, clr, ramp = 0.3) {
  if (!musicEv) return; const rel = vt - musicT0, [m, c] = musicAt(rel);
  musicEv.keys = musicEv.keys.filter((q) => q[0] < rel); musicEv.keys.push([rel, m, c], [rel + ramp, muf, clr], [rel + 600, muf, clr]);
  if (musicLive) { const now = audioCtx.currentTime; musicLive[0].g.gain.cancelScheduledValues(now); musicLive[1].g.gain.cancelScheduledValues(now); musicLive[0].g.gain.setValueAtTime(m, now); musicLive[1].g.gain.setValueAtTime(c, now); musicLive[0].g.gain.linearRampToValueAtTime(muf, now + ramp); musicLive[1].g.gain.linearRampToValueAtTime(clr, now + ramp); }
}
function musicStop() { EVENTS.push({ t: vt, type: 'musicStop' }); if (musicLive) { musicLive.forEach((x) => { try { x.s.stop(); } catch {} }); musicLive = null; } musicT0 = null; musicEv = null; }
const beatNow = () => (musicT0 == null ? 0 : Math.max(0, (vt - musicT0 - BEAT0) / BEAT));

airport.onStrike = () => { const d = 0.5 + Math.random() * 0.8; EVENTS.push({ t: vt + d, type: 'thunder' }); thunder(d); airport.flicker?.(); };

// ---------------------------------------------------------------- props
const bag = PROPS.giftBag(); scene.add(bag);
const suit = PROPS.suitcase(); scene.add(suit);
const phone = PROPS.chatPhone(); phone.visible = false; scene.add(phone);
const leoPhone = PROPS.phone(); scene.add(leoPhone);
const pass = PROPS.boardingPass(); pass.visible = false; scene.add(pass);

// ---------------------------------------------------------------- actors
const KIOSK = V(0, 0, 0);
const ATT_POS = V(-0.78, 0, 0.42), ATT_YAW = 0.95;
const PROF_STOP = V(0.42, 0, 1.0), PROF_YAW = -2.55;
const BOARD_SPOT = V(-2.3, 0, 4.6);

function marker(p) { const o = new THREE.Object3D(); o.position.copy(p); scene.add(o); return o; }
const M_BOARD = marker(V(-7.5, 4.6, -4.5)), M_SCREEN = marker(V(0, 1.45, 0.08)), M_BAG = marker(V(0, 0.8, 0)), M_PHONE = marker(V(0, 1.3, 0));

const glbCache = {};
function fetchGlb(url) { return (glbCache[url] ||= fetchGlbRaw(url)); }
async function fetchGlbRaw(url) {
  try { const r = await fetch(url + '.glb'); const ct = r.headers.get('content-type') || ''; if (r.ok && !ct.includes('text/html')) return await r.arrayBuffer(); } catch {}
  const b64 = (await (await fetch(url + '.glb.b64.txt')).text()).trim();
  const bin = atob(b64); const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8.buffer;
}
async function makeActor(cfg) {
  const head = new TalkingHead(container, {
    avatarOnly: true, avatarOnlyCamera: camera, audioCtx,
    lipsyncModules: ['pt_br'], lipsyncLang: 'pt_br', modelFPS: 60,
    avatarIdleEyeContact: 0, avatarSpeakingEyeContact: 0, avatarIgnoreCamera: true, avatarIdleHeadMove: 0.35, avatarSpeakingHeadMove: 0.45,
  });
  const data = (await fetchGlb(cfg.avatar.url)).slice(0);
  await head.showAvatar({ lipsyncLang: 'pt_br', ...cfg.avatar, data });
  head.audioReverbNode.disconnect(); head.audioReverbNode.connect(master);
  const arm = head.armature; scene.add(arm);
  arm.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
  const a = { head, arm, pos: cfg.pos.clone(), yaw: cfg.yaw, yawGoal: cfg.yaw, walk: null, ikL: new ArmIK(arm, 'Left'), ikR: new ArmIK(arm, 'Right'), look: new HeadLook(head), name: cfg.name };
  a.bone = (n) => arm.getObjectByName(n);
  a.headPos = (v = new THREE.Vector3()) => { a.bone('Head').getWorldPosition(v); v.y += 0.07; return v; };
  return a;
}

// Vercel serves binary .glb; the claude.ai artifact only serves text files, so fall back to base64
const AV_DIR = './avatars/';
const ANIM = { walk: './anim/walking.json', talk0: './anim/Talking_0.json', talk1: './anim/Talking_1.json', talk2: './anim/Talking_2.json', idle: './anim/Idle.json', laugh: './anim/Laughing.json' };
// which talking clips each speaker cycles through (varied body language line to line)
const TALKS = { prof: ['talk1', 'talk2'], att: ['talk0', 'talk2'], leo: ['talk1'], motti: ['talk0'], sa: ['talk2'], diniz: [] };
let WALK_SPEED = 1.25;

async function preloadAnims(a, keys) {
  for (const k of keys) {
    // clips were converted from Mixamo FBX to three.js JSON; register them the way TalkingHead would
    const clip = THREE.AnimationClip.parse(await (await fetch(ANIM[k])).json());
    const props = {};
    clip.tracks.forEach((t) => {
      t.name = t.name.replaceAll('mixamorig', '');
      const ids = t.name.split('.');
      if (ids[1] === 'position') { for (let i = 0; i < t.values.length; i++) t.values[i] *= 0.01; props[t.name] = new THREE.Vector3(t.values[0], t.values[1], t.values[2]); }
      else if (ids[1] === 'quaternion') props[t.name] = new THREE.Quaternion(t.values[0], t.values[1], t.values[2], t.values[3]);
    });
    const item = { url: ANIM[k] + '-0', clip, pose: { props, standing: true } };
    a.head.animClips.push(item);
    if (!item) continue;
    // make it in-place: freeze Hips X/Z (we move the armature ourselves)
    const tr = item.clip.tracks.find((t) => t.name === 'Hips.position');
    if (tr) {
      const v = tr.values, n = v.length / 3;
      if (k !== 'walk') { // talking clips: pin hips to the walk clip's standing frame (other rigs/units)
        const wi = a.head.animClips.find((x) => x.url === ANIM.walk + '-0');
        const wp = wi.clip.tracks.find((t) => t.name === 'Hips.position'), wq = wi.clip.tracks.find((t) => t.name === 'Hips.quaternion');
        console.log('clip', k, 'non-bone tracks:', item.clip.tracks.filter((t) => !a.arm.getObjectByName(t.name.split('.')[0])?.isBone).map((t) => t.name).join(' '));
        item.clip.tracks = item.clip.tracks.filter((t) => !t.name.startsWith('Hips.') && a.arm.getObjectByName(t.name.split('.')[0])?.isBone);
        item.clip.tracks.push(new THREE.VectorKeyframeTrack('Hips.position', [0, item.clip.duration], [...wp.values.slice(0, 3), ...wp.values.slice(0, 3)]));
        if (wq) item.clip.tracks.push(new THREE.QuaternionKeyframeTrack('Hips.quaternion', [0, item.clip.duration], [...wq.values.slice(0, 4), ...wq.values.slice(0, 4)]));
        item.pose.props['Hips.position'] = new THREE.Vector3(...wp.values.slice(0, 3));
        if (wq) item.pose.props['Hips.quaternion'] = new THREE.Quaternion(...wq.values.slice(0, 4));
        item.pose.lying = false; item.pose.standing = true;
        continue;
      }
      if (k === 'walk') { const dz = v[(n - 1) * 3 + 2] - v[2]; if (Math.abs(dz) > 0.2) WALK_SPEED = Math.abs(dz) / item.clip.duration; console.log('walk clip', item.clip.duration.toFixed(2), 's, dz', dz.toFixed(2), 'speed', WALK_SPEED.toFixed(2)); }
      for (let i = 0; i < n; i++) { v[i * 3] = v[0]; v[i * 3 + 2] = v[2]; }
    }
  }
  calibrateArms(a);
}
// The Talking/Idle/Laughing clips come from another rig: at rest they hunch the shoulders and hold the forearms up,
// palms out. Re-base every upper-limb track so the idle's first frame equals this avatar's own natural standing
// pose (captured before any clip ran); the motion on top of it is kept.
const ARM_BONES = ['Shoulder', 'Arm', 'ForeArm', 'Hand'].flatMap((b) => ['Left' + b, 'Right' + b]);
function calibrateArms(a) {
  if (!a.restArms) { a.restArms = {}; for (const b of ARM_BONES) a.restArms[b] = a.bone(b).quaternion.clone(); }
  const idle = a.head.animClips.find((x) => x.url === ANIM.idle + '-0'); if (!idle) return;
  const corr = {};
  for (const b of ARM_BONES) {
    const t = idle.clip.tracks.find((x) => x.name === b + '.quaternion'); if (!t) continue;
    const q0 = new THREE.Quaternion().fromArray(t.values, 0);
    corr[b] = a.restArms[b].clone().multiply(q0.invert());
  }
  const q = new THREE.Quaternion();
  for (const item of a.head.animClips) {
    if (item.url === ANIM.walk + '-0' || item.armsFixed) continue;
    for (const t of item.clip.tracks) {
      const b = t.name.split('.')[0]; if (!corr[b] || !t.name.endsWith('quaternion')) continue;
      for (let i = 0; i < t.values.length; i += 4) { q.fromArray(t.values, i).premultiply(corr[b]).normalize().toArray(t.values, i); }
      const pp = item.pose.props[t.name]; if (pp) pp.premultiply(corr[b]);
    }
    item.armsFixed = true;
  }
}

let prof, att, diniz, leo, motti, sa, kauai, zuma, lopo;
const actors = [];
const ACT = {};

// ---------------------------------------------------------------- virtual clock & director helpers
let vt = 0, runId = 0;
const waiters = [];
function wait(sec) { const id = runId; return new Promise((res, rej) => waiters.push({ t: vt + sec, res, rej, id })); }
function flushWaiters() {
  for (let i = waiters.length - 1; i >= 0; i--) {
    const w = waiters[i];
    if (w.id !== runId) { waiters.splice(i, 1); w.rej(new Error('abort')); continue; }
    if (vt >= w.t) { waiters.splice(i, 1); w.res(); }
  }
}

function walkTo(a, pts, speed = WALK_SPEED, rate = null) {
  // round the corners: Catmull-Rom through start + waypoints, resampled every ~12 cm
  let path = pts.map((p) => p.clone());
  const start = a.pos.clone(); start.y = 0;
  if (path.length > 1) {
    const curve = new THREE.CatmullRomCurve3([start, ...path], false, 'centripetal', 0.5);
    const n = Math.max(4, Math.ceil(curve.getLength() / 0.12));
    path = curve.getSpacedPoints(n).slice(1); path[path.length - 1].copy(pts[pts.length - 1]);
  }
  let total = 0; { let q = start; for (const p of path) { total += p.distanceTo(q); q = p; } }
  return new Promise((res) => {
    a.walk = { pts: path, i: 0, speed, res, total, done: 0, v: 0 };
    play(a, ANIM.walk, 120);
  });
}
function updateWalk(a, dt) {
  const w = a.walk; if (!w) return;
  // ease in over ~0.45 s, ease out over the last ~0.6 m (stride slows with the body, no foot skating)
  const left = w.total - w.done;
  const vWant = w.speed * Math.max(0.35, Math.min(1, left / 0.6));
  w.v += (vWant - w.v) * Math.min(1, dt * (w.v < vWant ? 2.4 : 6));
  w.v = Math.max(w.v, 0.25);
  if (a.head.mixer) a.head.mixer.timeScale = Math.max(0.45, w.v / WALK_SPEED);
  let step = w.v * dt;
  while (step > 0 && w.i < w.pts.length) {
    const tgt = w.pts[w.i]; const d = tgt.clone().sub(a.pos); d.y = 0;
    const dist = d.length();
    if (dist > 1e-4) a.yawGoal = Math.atan2(d.x, d.z);
    if (dist <= step) { a.pos.copy(tgt); step -= dist; w.done += dist; w.i++; }
    else { a.pos.add(d.multiplyScalar(step / dist)); w.done += step; step = 0; }
  }
  if (w.i >= w.pts.length) { a.walk = null; if (a.head.mixer) a.head.mixer.timeScale = 1; softStop(a, 0.4); w.res(); }
}
function turnTo(a, yaw) { a.yawGoal = yaw; }
// switch pose fast, skipping TalkingHead's slow kneel-in-between for standing<->sitting
function quickPose(a, name, ms = 350) { const h = a.head; h.poseName = name; h.poseTarget = null; h.setPoseFromTemplate(h.poseTemplates[name], ms); }
// fade a Mixamo clip out instead of cutting it (avoids the pose snapping between shots)
function fadeAll(m, t) { for (const act of m._actions) { if (!act.isRunning()) continue; const w = act.getEffectiveWeight(); act.weight = 1; act.stopFading(); act._scheduleFading(t, w, 0); } }
// talking clip layered over the idle (idle keeps weight 1, talk 1.3 -> ~57/43 mix): calmer, less 'Mixamo' gestures
function playTalk(a, name) {
  const h = a.head, idle = a.idleOK && h.animClips.find((x) => x.url === ANIM.idle + '-0');
  h.crossFade = 0.5; h.keepClip = idle ? idle.clip : null; h.clipWeight = idle ? 1.3 : 0.8;
  if (idle && !(h.mixer && h.mixer.existingAction(idle.clip)?.isRunning())) { h.animPhase = a.idlePhase; play(a, ANIM.idle, 600); h.animPhase = null; }
  play(a, ANIM[name], 30);
  h.crossFade = null; h.keepClip = null; h.clipWeight = null;
}
function canIdle(a) { return a.idleOK && !a.walk && !a.fall && !(a.slip > 0) && vt >= (a.holdIdle || 0); }
function softStop(a, t = 0.4) {
  if (canIdle(a)) { a.head.crossFade = t; a.head.animPhase = a.idlePhase; play(a, ANIM.idle, 600); a.head.animPhase = null; a.head.crossFade = null; return; }
  const m = a.head.mixer; if (!m) return;
  fadeAll(m, t);
  a.fadeStopAt = vt + t;
}
// a short laugh (Mixamo clip), then back to idle
function laugh(a, dur = 1.5, phase = 0.2) {
  a.holdIdle = vt + dur; a.head.crossFade = 0.3; a.head.animPhase = phase; play(a, ANIM.laugh, 20); a.head.animPhase = null; a.head.crossFade = null;
  wait(dur).then(() => { a.holdIdle = 0; softStop(a, 0.5); }).catch(() => {});
}
// hand gestures are pose-based: let the body clip go for the gesture, then settle back
function gesture(a, name, dur = 2.5, mirror = false) {
  a.holdIdle = vt + dur + 0.5;
  const m = a.head.mixer; if (m) { fadeAll(m, 0.3); a.fadeStopAt = vt + 0.3; }
  a.head.playGesture(name, dur, mirror);
  wait(dur + 0.5).then(() => { if (!a.head.mixer && !a.walk) softStop(a, 0.6); }).catch(() => {});
}
function play(a, url, dur) { a.fadeStopAt = null; a.head.playAnimation(url, null, dur); }
function angleLerp(a, b, k) { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * k; }

// look at something (Object3D) for ms; null => partner
function look(a, obj) { a.look.set(obj && obj.armature ? obj.armature.getObjectByName('Head') : obj); }

// ---------------------------------------------------------------- speech
function syllables(w) { const m = w.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').match(/[aeiouy]+/g); return Math.max(1, m ? m.length : 1); }
function wordTiming(text, totalMs, startMs = 0, voiced = null) {
  const toks = text.split(/\s+/).filter(Boolean);
  const weights = toks.map((w) => syllables(w) + (/[,;]$/.test(w) ? 1.2 : /[.…!?]$/.test(w) ? 2.0 : 0));
  const sum = weights.reduce((a, b) => a + b, 0);
  const words = [], wtimes = [], wdurations = [];
  let acc = 0;
  toks.forEach((w, i) => {
    const t0 = startMs + (acc / sum) * totalMs;
    const dur = (syllables(w) / sum) * totalMs;
    acc += weights[i];
    words.push(w.replace(/[.,;!?…]/g, '')); wtimes.push(voiced ? voiced(t0) : t0); wdurations.push(dur);
  });
  return { words, wtimes, wdurations };
}
function estimateMs(text) { return text.split(/\s+/).reduce((s, w) => s + syllables(w) * 175 + (/[,;]$/.test(w) ? 220 : /[.…!?]$/.test(w) ? 420 : 0), 0); }
// find speech start/end in a recorded buffer (simple energy gate)
function voicedSpan(buf) {
  const d = buf.getChannelData(0), sr = buf.sampleRate, win = Math.floor(sr * 0.02);
  let peak = 0; for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
  const th = peak * 0.08; let s = 0, e = d.length;
  for (let i = 0; i < d.length; i += win) { let m = 0; for (let j = i; j < Math.min(d.length, i + win); j++) m = Math.max(m, Math.abs(d[j])); if (m > th) { s = i; break; } }
  for (let i = d.length - win; i > 0; i -= win) { let m = 0; for (let j = i; j < i + win; j++) m = Math.max(m, Math.abs(d[j])); if (m > th) { e = i + win; break; } }
  return [s / sr * 1000, e / sr * 1000];
}
let voices = [];
if ('speechSynthesis' in window) { const lv = () => { voices = speechSynthesis.getVoices(); }; lv(); speechSynthesis.onvoiceschanged = lv; }
function pickVoice(who) {
  const pt = voices.filter((v) => /pt[-_]BR/i.test(v.lang));
  // neural voices first (Edge: "Microsoft Francisca/Antonio Online (Natural)"), then Google, then the rest
  const rank = (v) => (/natural|online|neural/i.test(v.name) ? 0 : /google/i.test(v.name) ? 1 : 2);
  pt.sort((x, y) => rank(x) - rank(y));
  const male = /antonio|ant[oô]nio|daniel|donato|fabio|f[aá]bio|humberto|julio|j[uú]lio|nicolau|valerio|val[eé]rio|felipe/i;
  const female = /francisca|thalita|maria|luciana|vit[oó]ria|brenda|elza|giovanna|leila|leticia|let[ií]cia|manuela|yara|google/i;
  return (who === 'prof' ? pt.find((v) => male.test(v.name)) : pt.find((v) => female.test(v.name))) || pt[0];
}
let ttsRatio = 1; // learned ratio (real synth duration / estimate), keeps lips in step with the browser voice
let subtitlesOn = true;
function showSub(who, text) { const el = $('sub'); if (!subtitlesOn || !text) { el.classList.remove('on'); return; } el.innerHTML = `<span class="who">${NAMES[who] || who}</span>${text}`; el.classList.add('on'); }

const gesture_ = (...x) => gesture(...x);
async function say(id, { gesture = null, anim = null } = {}) {
  const L = LINES[id], a = ACT[L.who];
  showSub(L.who, L.text);
  const t0 = vt;
  const tl = TALKS[L.who] || [];
  if (anim === null && !gesture) anim = tl.length && !a.noTalkAnim ? tl[(a.lineN = (a.lineN || 0) + 1) % tl.length] : null;
  if (anim === false) anim = null;
  if (anim && !a.walk && !a.fall && !a.seated) playTalk(a, anim);
  if (gesture) wait(0.25).then(() => gesture_(a, gesture[0], gesture[1] || 2.5, gesture[2] || false)).catch(() => {});
  let durMs;
  if (SIM || (EXPORT && !audioBuffers[id])) {
    durMs = estimateMs(L.text);
    if (EXPORT) console.warn('FALTA ÁUDIO: ' + L.audio);
  } else if (audioBuffers[id]) {
    const buf = audioBuffers[id]; const [s, e] = voicedSpan(buf);
    durMs = buf.duration * 1000;
    a.head.speakAudio({ audio: buf, ...wordTiming(L.text, e - s, s) }, { lipsyncLang: 'pt_br' });
  } else {
    durMs = estimateMs(L.text);
    durMs = estimateMs(L.text) * ttsRatio;
    const silent = audioCtx.createBuffer(1, Math.ceil(audioCtx.sampleRate * durMs / 1000), audioCtx.sampleRate);
    const v = pickVoice(L.who);
    let ended = null;
    if (v) {
      const u = new SpeechSynthesisUtterance(L.text); u.voice = v; u.lang = 'pt-BR';
      const natural = /natural|online|neural/i.test(v.name);
      u.pitch = natural ? 1 : L.who === 'prof' ? 0.9 : 1.05; u.rate = L.who === 'prof' ? 0.95 : 1.0;
      const t0 = performance.now();
      ended = new Promise((res) => { u.onend = () => { const real = performance.now() - t0; ttsRatio = Math.min(1.8, Math.max(0.6, ttsRatio * 0.4 + 0.6 * ttsRatio * real / durMs)); res(); }; u.onerror = () => res(); });
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    }
    a.head.speakAudio({ audio: silent, ...wordTiming(L.text, durMs * 0.95, 0) }, { lipsyncLang: 'pt_br' });
    if (ended) { await Promise.race([ended, wait(durMs / 1000 * 2 + 1)]); await wait(0.2); if (anim && !a.walk) softStop(a); showSub(null); return; }
  }
  EVENTS.push({ t: t0, type: 'line', id, who: L.who, name: NAMES[L.who], text: L.text, dur: durMs / 1000, file: audioBuffers[id] ? L.audio : null });
  await wait(durMs / 1000 + 0.25);
  if (anim && !a.walk) softStop(a);
  showSub(null);
}

// ---------------------------------------------------------------- camera shots
let shot = null;
const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
const val = (x) => (typeof x === 'function' ? x() : x);
function cut(s) { shot = { ...s, t0: vt }; if (s.fov) { camera.fov = s.fov; camera.updateProjectionMatrix(); } }
// helpers: position relative to an actor's facing
function rel(a, x, y, z) { return () => { const c = Math.cos(a.yaw), s = Math.sin(a.yaw); return V(a.pos.x + x * c + z * s, y, a.pos.z - x * s + z * c); }; }
function headOf(a, dy = 0) { return () => { const v = a.headPos(); v.y += dy; return v; }; }
function mid(f1, f2) { return () => val(f1).clone().add(val(f2)).multiplyScalar(0.5); }
function updateCamera() {
  if (!shot) return;
  const k = shot.dur ? smooth((vt - shot.t0) / shot.dur) : 0;
  tmpA.copy(val(shot.p0)); if (shot.p1) tmpA.lerp(val(shot.p1), k);
  tmpB.copy(val(shot.l0)); if (shot.l1) tmpB.lerp(val(shot.l1), k);
  // subtle handheld drift
  const hh = shot.handheld ?? 0.006;
  tmpA.x += Math.sin(vt * 0.9) * hh + Math.sin(vt * 2.3) * hh * 0.4;
  tmpA.y += Math.sin(vt * 1.3 + 1) * hh * 0.7;
  if (shot.smoothPos && camera.userData.lastPos) { camera.position.lerp(tmpA, 0.08); } else camera.position.copy(tmpA);
  camera.userData.lastPos = true;
  camera.lookAt(tmpB);
  if (bokeh) {
    const f = shot.focus ? val(shot.focus) : tmpB;
    bokeh.uniforms.focus.value = camera.position.distanceTo(f);
    bokeh.uniforms.aperture.value = shot.aperture ?? 0.0016;
  }
}

// ---------------------------------------------------------------- sitting on the floor (procedural, outside TalkingHead's pose system)
let SIT = null;
// procedural full-body poses from TalkingHead templates (legs/spine/head only; arms stay with the IK)
const TPL = {};
function tpl(a, name) {
  if (TPL[name]) return TPL[name];
  const t = a.head.poseTemplates[name].props, q = {};
  for (const [key, v] of Object.entries(t)) { const [b, ty] = key.split('.'); if (ty === 'rotation' && !/Hand|Arm|Shoulder/.test(b)) q[b] = new THREE.Quaternion().setFromEuler(new THREE.Euler(v.x, v.y, v.z, 'XYZ')); }
  const ref = a.head.poseTemplates.side.props['Hips.position'];
  return (TPL[name] = { q, hy: t['Hips.position'] ? t['Hips.position'].y / ref.y : null });
}
// blend the body between two poses (null = whatever the animation gives = standing), u in 0..1
const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion();
function applyPoseBlend(a, A, B, u) {
  const hips = a.bone('Hips'); if (!a.h0) a.h0 = hips.position.clone();
  const names = new Set([...Object.keys(A ? A.q : {}), ...Object.keys(B ? B.q : {})]);
  for (const n of names) {
    const bone = a.bone(n); if (!bone) continue;
    _qa.copy(A && A.q[n] ? A.q[n] : bone.quaternion); _qb.copy(B && B.q[n] ? B.q[n] : bone.quaternion);
    bone.quaternion.slerpQuaternions(_qa, _qb, u);
  }
  const ya = A ? A.hy : 1, yb = B ? B.hy : 1;
  hips.position.y = a.h0.y * THREE.MathUtils.lerp(ya, yb, u);
  a.arm.updateMatrixWorld(true);
}
function applySit(a, k) {
  const S = tpl(a, 'sitting'); if (S.hy == null || S.hy > 0.5) S.hy = 0.16;
  applyPoseBlend(a, null, S, k);
}

// ---------------------------------------------------------------- wet look
const wetMats = [];
function setupWet(a) {
  a.arm.traverse((o) => { if (o.isMesh && o.material?.name === 'AvatarHead' && !headMat) { headMat = o.material; headRough = o.material.roughness ?? 0.6; dryHeadTex = o.material.map; } });
  a.arm.traverse((o) => { if (!o.isMesh || !/outfit/.test(o.material?.name || '')) return; const old = o.material; const m = new THREE.MeshPhysicalMaterial(); THREE.MeshStandardMaterial.prototype.copy.call(m, old); m.name = old.name; m.clearcoat = 0; m.clearcoatRoughness = 0.6; o.material = m; wetMats.push({ m, c: m.color.clone(), r: m.roughness }); });
}
function applyWet(w) {
  for (const x of wetMats) { x.m.color.copy(x.c).multiplyScalar(1 - 0.55 * w); x.m.roughness = Math.max(0.42, x.r * (1 - 0.45 * w)); x.m.envMapIntensity = 1 + 0.6 * w; x.m.clearcoat = 0.18 * w; }
  // hair: soaked texture while really wet; face a little shinier
  if (headMat) { const want = w > 0.55 ? wetHeadTex : dryHeadTex; if (want && headMat.map !== want) { headMat.map = want; headMat.needsUpdate = true; } headMat.roughness = headRough * (1 - 0.35 * w); }
}
let headMat = null, headRough = 0.6, wetHeadTex = null, dryHeadTex = null;
const DRIPS = 80, dripMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.0045, 8, 6), new THREE.MeshPhysicalMaterial({ color: 0xcfe0f2, roughness: 0.02, metalness: 0, transparent: true, opacity: 0.55, envMapIntensity: 2.5 }), DRIPS);
dripMesh.frustumCulled = false; scene.add(dripMesh);
const drips = Array.from({ length: DRIPS }, () => ({ p: new THREE.Vector3(0, -9, 0), v: 0, life: 0 }));
const DRIP_BONES = ['LeftHand', 'RightHand', 'LeftForeArm', 'RightForeArm', 'Hips', 'LeftHand', 'RightHand'];
const _dm = new THREE.Object3D();
function updateDrips(dt) {
  const w = (prof.wet || 0) > 0.55 ? prof.wet : 0;   // only drips while really soaked
  for (const d of drips) {
    d.life -= dt;
    if (d.life <= 0 || d.p.y < 0.01) {
      if (Math.random() < (w * 14 + (prof.shake > 0 ? 160 : 0)) * dt) { const b = prof.bone(DRIP_BONES[(Math.random() * DRIP_BONES.length) | 0]); b.getWorldPosition(d.p); d.p.add(V((Math.random() - 0.5) * 0.12, -0.05, (Math.random() - 0.5) * 0.12)); d.v = 0; d.life = 1.5; }
      else { d.p.y = -9; }
    } else { d.v += 9.8 * dt; d.p.y -= d.v * dt; }
    _dm.position.copy(d.p); _dm.scale.set(1, 1 + Math.min(3, d.v * 0.6), 1); _dm.updateMatrix(); dripMesh.setMatrixAt(drips.indexOf(d), _dm.matrix);
  }
  dripMesh.instanceMatrix.needsUpdate = true;
}

// ---------------------------------------------------------------- per-frame actor logic
const hand = new THREE.Vector3(), tmp = new THREE.Vector3();
const state = { suitMode: 'pull', bagHand: 'Left', phone: false, typing: false, passMode: 'hidden', passOwner: null };
const suitWheel = new THREE.Vector3(6, 0, 9);
const suitRoll = new THREE.Vector3();

// point between the wrist and the knuckles (where a handle sits in a closed hand)
function gripPoint(a, side, v = new THREE.Vector3()) {
  const w = a.bone(side + 'Hand').getWorldPosition(new THREE.Vector3());
  const k = a.bone(side + 'HandMiddle1')?.getWorldPosition(new THREE.Vector3()) || w;
  return v.copy(w).lerp(k, 0.8);
}
const CURL_AXIS = new THREE.Vector3(1, 0, 0);
function curlFingers(a, side, amt) {
  if (amt <= 0) return;
  for (const f of ['Index', 'Middle', 'Ring', 'Pinky']) for (let j = 1; j <= 3; j++) {
    const b = a.bone(side + 'Hand' + f + j); if (!b) continue;
    b.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(CURL_AXIS, amt * (j === 1 ? 0.9 : 1.1)));
  }
  const t = a.bone(side + 'HandThumb2'); if (t) t.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(CURL_AXIS, amt * 0.4));
  a.arm.updateMatrixWorld(true);
}

// phone against the right ear: screen toward the cheek, long axis from ear down toward the mouth
const _bx = new THREE.Vector3(), _by = new THREE.Vector3(), _bz = new THREE.Vector3(), _m4 = new THREE.Matrix4();
function earPos(a) { const r = V(-Math.cos(a.yaw), 0, Math.sin(a.yaw)), f = V(Math.sin(a.yaw), 0, Math.cos(a.yaw)); return a.headPos().addScaledVector(r, 0.095).addScaledVector(f, 0.02).add(V(0, -0.06, 0)); }
function placeAtEar(ph, a) {
  const p = earPos(a), r = V(-Math.cos(a.yaw), 0, Math.sin(a.yaw)), f = V(Math.sin(a.yaw), 0, Math.cos(a.yaw));
  _bz.copy(r).multiplyScalar(-1);                                   // screen faces the head
  _by.set(0, 1, 0).addScaledVector(f, -0.55).normalize();           // top behind the ear, bottom toward the mouth
  _by.addScaledVector(_bz, -_by.dot(_bz)).normalize(); _bx.crossVectors(_by, _bz);
  ph.quaternion.setFromRotationMatrix(_m4.makeBasis(_bx, _by, _bz)); ph.position.copy(p).addScaledVector(r, 0.012);
}
const _pq = new THREE.Quaternion(), _pp = new THREE.Vector3(), _gy = new THREE.Vector3();
// keep the phone in the palm: slide the ear-placed phone so its lower third sits at the grip (it can't float off the hand)
function snapToGrip(ph, grip, t) {
  _gy.set(0, 1, 0).applyQuaternion(ph.quaternion);
  const want = grip.clone().addScaledVector(_gy, 0.045);
  ph.position.lerp(want, 0.85 * Math.min(1, t * 1.5));
}
function updateProps(dt) {
  prof.phoneT = Math.max(0, Math.min(1, (prof.phoneT || 0) + (state.phone === 'ear' ? dt : -dt) / 0.9));
  // gift bag hangs from prof's left hand
  curlFingers(prof, 'Left', 1.0);
  if (state.suitMode === 'pull' || state.phone) curlFingers(prof, 'Right', state.phone ? 0.6 : 1.0);
  gripPoint(prof, state.bagHand, hand);
  bag.position.copy(hand).add(V(0, 0.02, 0));
  bag.rotation.set(0, prof.yaw + Math.PI / 2, Math.sin(vt * 3) * 0.04 * (prof.walk ? 2 : 0.3));
  M_BAG.position.copy(bag.position).add(V(0, -0.25, 0));
  // suitcase
  const fwd = V(Math.sin(prof.yaw), 0, Math.cos(prof.yaw)), right = V(-Math.cos(prof.yaw), 0, Math.sin(prof.yaw));
  if (state.suitMode === 'pull') {
    // right arm reaches back to the handle; suitcase trails ~0.6 m behind the hand
    const grip = prof.pos.clone().addScaledVector(fwd, -0.28).addScaledVector(right, 0.24); grip.y = 0.84;
    prof.ikR.set(grip, prof.walk ? 1 : 0.6);
    gripPoint(prof, 'Right', hand);
    // place the wheels on the floor behind the hand so the handle top lands exactly in the hand
    const L = 1.04, dy = Math.max(0.2, hand.y - 0.035), horiz = Math.sqrt(Math.max(0.01, L * L - dy * dy));
    suitWheel.copy(hand).addScaledVector(fwd, -horiz); suitWheel.y = 0.035;
    const up = hand.clone().sub(suitWheel).normalize();
    const zAxis = new THREE.Vector3().crossVectors(right, up).normalize();
    const m = new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(up, zAxis), up, zAxis);
    suit.quaternion.setFromRotationMatrix(m);
    suit.position.copy(suitWheel).add(V(0, -0.035, 0)).addScaledVector(zAxis, 0.03);
  } else if (state.suitMode === 'parked' && !prof.fall) {
    const want = prof.pos.clone().addScaledVector(right, 0.45).addScaledVector(fwd, -0.05);
    suit.position.lerp(V(want.x, 0, want.z), Math.min(1, dt * 3));
    suit.quaternion.slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, prof.yaw, 0)), Math.min(1, dt * 3));
    suitWheel.copy(suit.position);
  }
  // phone in prof right hand (looking at it, or at the ear)
  phone.visible = !!state.phone;
  if (state.phone) {
    gripPoint(prof, 'Right', hand);
    const face = prof.headPos();
    phone.position.copy(hand).add(V(0, 0.075, 0)).add(face.clone().sub(hand).normalize().multiplyScalar(0.03)); phone.lookAt(face);
    if (prof.phoneT > 0.001) { _pq.copy(phone.quaternion); _pp.copy(phone.position); placeAtEar(phone, prof); snapToGrip(phone, hand, prof.phoneT); const k = smooth(prof.phoneT); phone.position.lerpVectors(_pp, phone.position, k); phone.quaternion.slerpQuaternions(_pq, phone.quaternion, k); }
    M_PHONE.position.copy(phone.position);
  }
  leoPhone.visible = !!leo.onPhone;
  if (leo.onPhone) { curlFingers(leo, 'Right', 0.6); placeAtEar(leoPhone, leo); }
  // boarding pass
  pass.visible = state.passMode !== 'hidden';
  if (state.passOwner) {
    state.passOwner.bone(state.passHand || 'RightHand').getWorldPosition(hand);
    pass.position.lerp(hand, Math.min(1, dt * 20));
    pass.quaternion.setFromEuler(new THREE.Euler(-1.2, state.passOwner.yaw, 0.3));
  }
}

// keep hands/elbows out of the torso: if the animation pushes them inside, steer the hand outward with IK
const _h = new THREE.Vector3(), _e = new THREE.Vector3();
function guardArms(a) {
  for (const [ik, sgn] of [[a.ikL, 1], [a.ikR, -1]]) {
    if (!ik.ok) continue;
    if (ik.goal > 0 && !ik.auto) continue; // scripted IK wins
    ik.hand.getWorldPosition(_h); a.arm.worldToLocal(_h);
    ik.fore.getWorldPosition(_e); a.arm.worldToLocal(_e);
    const inside = (p, r) => p.y > 0.75 && p.y < 1.5 && Math.abs(p.x) < r && p.z > -0.15 && p.z < 0.22;
    if (inside(_h, 0.21) || inside(_e, 0.2)) {
      _h.x = sgn * Math.max(Math.abs(_h.x), 0.28); _h.z = Math.max(_h.z, 0.24);
      ik.set(a.arm.localToWorld(_h.clone()), 0.85); ik.auto = true;
    } else if (ik.auto) { ik.release(); ik.auto = false; }
  }
}

function updateActors(dt) {
  for (const a of actors) {
    if (a.fadeStopAt != null && vt >= a.fadeStopAt) { a.fadeStopAt = null; a.head.stopAnimation(); }
    if (a.fadeStopAt == null && !a.head.mixer && canIdle(a)) softStop(a, 0.6);
    updateWalk(a, dt);
    a.yaw = angleLerp(a.yaw, a.yawGoal, Math.min(1, dt * 5));
    a.arm.position.copy(a.pos); a.arm.rotation.y = a.yaw;
    a.head.animate(dt * 1000);
    if (a.seated) chairPose(a);
    if (a.fall && a.fall.up != null) { const u = Math.min(1, a.fall.up / 1.9), S = tpl(a, 'sitting'), K = tpl(a, 'oneknee'); if (u < 0.45) applyPoseBlend(a, S, K, smooth(u / 0.45)); else applyPoseBlend(a, K, null, smooth((u - 0.45) / 0.55)); }
    else if (a.fall && a.fall.k > 0) applySit(a, a.fall.k);
    a.arm.updateMatrixWorld(true);
  }
  nodToBeat();
  // procedural targets
  const earPt = (a) => { const r = V(-Math.cos(a.yaw), 0, Math.sin(a.yaw)), f = V(Math.sin(a.yaw), 0, Math.cos(a.yaw)); return earPos(a).addScaledVector(r, 0.06).addScaledVector(f, 0.035).add(V(0, -0.055, 0)); };
  if ((state.phone === 'hand' && !state.typing) || state.phone === 'ear') { const f = fwdOf(prof), r = V(-Math.cos(prof.yaw), 0, Math.sin(prof.yaw)); const hold = prof.pos.clone().addScaledVector(f, 0.42).addScaledVector(r, 0.05).add(V(0, 1.18, 0)); prof.ikR.set(hold.lerp(earPt(prof), smooth(prof.phoneT || 0)), 1); }
  if (leo.onPhone) leo.ikR.set(earPt(leo), 1);
  if (prof.shake > 0) { prof.shake -= dt; const k = Math.max(0, prof.shake) / 0.8; prof.arm.rotation.z = Math.sin(prof.shake * 38) * 0.05 * k; if (prof.shake <= 0) prof.arm.rotation.z = 0; }
  if (prof.fall) {
    const F = prof.fall; F.t += dt; prof.pos.y = 0;
    const r = V(-Math.cos(prof.yaw), 0, Math.sin(prof.yaw)), f = fwdOf(prof);
    if (F.up == null) {
      const k = smooth(F.t / 0.42); F.k = k; prof.arm.rotation.x = 0.28 * k;
      prof.ikL.set(prof.pos.clone().addScaledVector(r, -0.35).add(V(0, 1.55 + 0.5 * k, 0)), 1);   // gift held up, safe
    } else {
      // getting up: sitting -> one knee (hand pushing on the knee) -> standing; the gift comes down to his side
      F.up += dt; const u = Math.min(1, F.up / 1.9), lean = Math.sin(Math.PI * Math.min(1, u / 0.8));
      prof.arm.rotation.x = 0.28 * (1 - smooth(Math.min(1, u / 0.3))) - 0.06 * lean;
      const gh = THREE.MathUtils.lerp(2.05, 0.85, smooth(u));
      prof.ikL.set(prof.pos.clone().addScaledVector(r, -0.3 + 0.1 * u).addScaledVector(f, 0.1).add(V(0, gh * (u < 0.45 ? 0.75 : 1), 0)), 1 - smooth(Math.max(0, (u - 0.75) / 0.25)));
      const kneeH = u < 0.45 ? 0.35 : THREE.MathUtils.lerp(0.55, 0.9, (u - 0.45) / 0.55);
      prof.ikR.set(prof.pos.clone().addScaledVector(r, 0.18).addScaledVector(f, 0.32).add(V(0, kneeH, 0)), Math.sin(Math.PI * Math.min(1, u / 0.85)));
      if (u >= 1) { prof.fall = null; prof.arm.rotation.x = 0; prof.ikL.release(); prof.ikR.release(); prof.head.setMood('neutral'); }
    }
  }
  if (state.suitMode === 'parked' && suitRoll.lengthSq() > 0) { suit.position.lerp(suitRoll, Math.min(1, dt * 1.6)); if (suit.position.distanceTo(suitRoll) < 0.02) suitRoll.set(0, 0, 0); }
  for (const a of actors) {
    if (a.slip > 0) {
      a.slip -= dt; const k = Math.max(0, a.slip) / 0.45;
      a.arm.rotation.z = Math.sin((0.45 - a.slip) * 22) * 0.2 * k; if (!a.fall) a.arm.rotation.x = -(1 - k) * 0.25;
      a.ikL.set(a.pos.clone().addScaledVector(V(-Math.cos(a.yaw), 0, Math.sin(a.yaw)), -0.55).add(V(0, 1.5, 0)), 1);
      const r = V(-Math.cos(a.yaw), 0, Math.sin(a.yaw)), f = V(Math.sin(a.yaw), 0, Math.cos(a.yaw));
      a.ikR.set(a.pos.clone().addScaledVector(r, 0.55).addScaledVector(f, 0.1).add(V(0, 1.45, 0)), k);
      if (a.slip <= 0) { a.ikR.release(); a.arm.rotation.z = 0; if (!a.fall) { a.arm.rotation.x = 0; a.ikL.release(); } }
    }
  }
  if (state.typing && prof.ikR) {
    const fwd = V(Math.sin(prof.yaw), 0, Math.cos(prof.yaw)), right = V(-Math.cos(prof.yaw), 0, Math.sin(prof.yaw));
    const p = prof.pos.clone().addScaledVector(fwd, 0.42).addScaledVector(right, 0.05); p.y = 1.18 + Math.sin(vt * 9) * 0.004;
    prof.ikR.set(p, 1);
  }
  if (diniz.head.poseName !== 'sitting') diniz.head.playPose('sitting', null, 1e6);
  updatePlane(dt);
  for (const a of actors) { guardArms(a); a.look.update(dt); a.ikL.update(dt); a.ikR.update(dt); }
  updateProps(dt);
  // he gets soaked between the taxi and the doors, then slowly dries
  const want = prof.pos.z > 19.6 && prof.pos.z < 22.5 ? 1 : null;
  if (want) prof.wet = Math.min(1, (prof.wet || 0) + dt * 0.5); else if (prof.pos.z < 16) prof.wet = Math.max(0.35, (prof.wet || 0) - dt * 0.004);
  applyWet(prof.wet || 0); updateDrips(dt);
}


// ---------------------------------------------------------------- the plane (post-credits)
const lap = laptop(); scene.add(lap);
const deck = djDeck(); scene.add(deck);
const _l = new THREE.Vector3(), _k1 = new THREE.Vector3(), _k2 = new THREE.Vector3();
// a seated actor's lap, from the bones (hips -> knees), raised a little
function lapPoint(a, out) {
  a.bone('Hips').getWorldPosition(out); a.bone('LeftLeg').getWorldPosition(_k1); a.bone('RightLeg').getWorldPosition(_k2);
  _k1.add(_k2).multiplyScalar(0.5); out.lerp(_k1, 0.62); out.y += 0.1; return out;
}
// chair sitting: thighs forward, shins down, a slight recline (applied after the animation each frame)
const CH = { up: +(Q.get('chU') || 1.5), knee: +(Q.get('chK') || -1.45), spine: +(Q.get('chS') || -0.06), drop: +(Q.get('chD') || 0.5) };
const _q = new THREE.Quaternion(), _ax = new THREE.Vector3(1, 0, 0);
function chairPose(a) {
  for (const sd of ['Left', 'Right']) {
    a.bone(sd + 'UpLeg')?.quaternion.multiply(_q.setFromAxisAngle(_ax, CH.up));
    a.bone(sd + 'Leg')?.quaternion.multiply(_q.setFromAxisAngle(_ax, CH.knee));
  }
  a.bone('Spine')?.quaternion.multiply(_q.setFromAxisAngle(_ax, CH.spine));
  a.arm.updateMatrixWorld(true);
}
// seat a passenger: root at the seat pan, sitting pose
function seat(a, row, letter, yaw = 0) {
  a.seated = true; a.walk = null; a.head.stopAnimation(); a.idleOK = false;
  a.pos.copy(cabin.seat(row, letter)).add(V(0, 0.06 - CH.drop, 0.06)); a.yaw = a.yawGoal = yaw;
}
function updatePlane(dt) {
  if (state.world !== 'cabin') { lap.visible = deck.visible = false; return; }
  const beat = beatNow(), on = musicT0 != null && (state.party || 0) > 0.05;
  state.partyK = (state.partyK || 0) + ((state.party || 0) - (state.partyK || 0)) * Math.min(1, dt * 2.5);
  cabin.setParty(state.partyK); cabin.update(dt, beat);
  // Kauai: laptop on his lap, typing (until he looks up)
  lap.visible = true; lapPoint(kauai, lap.position); lap.rotation.set(0, kauai.yaw + Math.PI, 0);
  const f = V(Math.sin(kauai.yaw), 0, Math.cos(kauai.yaw)), r = V(-Math.cos(kauai.yaw), 0, Math.sin(kauai.yaw));
  const kb = lap.position.clone().addScaledVector(f, -0.02).add(V(0, 0.03, 0));
  const tap = (ph) => (kauai.typing ? Math.max(0, Math.sin(vt * 17 + ph)) * 0.012 : 0);
  kauai.ikL.set(kb.clone().addScaledVector(r, 0.08).add(V(0, tap(0), 0)), 1);
  kauai.ikR.set(kb.clone().addScaledVector(r, -0.08).add(V(0, tap(1.7), 0)), 1);
  // Zuma: hands relaxed on the lap
  lapPoint(zuma, _l); const fz = V(Math.sin(zuma.yaw), 0, Math.cos(zuma.yaw)), rz = V(-Math.cos(zuma.yaw), 0, Math.sin(zuma.yaw));
  zuma.ikL.set(_l.clone().addScaledVector(rz, 0.13).addScaledVector(fz, 0.02), 0.8); zuma.ikR.set(_l.clone().addScaledVector(rz, -0.13).addScaledVector(fz, 0.02), 0.8);
  // Lopo carries the DJ deck in front of his chest; it keeps playing
  deck.visible = !!lopo.carry;
  if (lopo.carry) {
    const fl = V(Math.sin(lopo.yaw), 0, Math.cos(lopo.yaw)), rl = V(-Math.cos(lopo.yaw), 0, Math.sin(lopo.yaw));
    const bob = lopo.walk ? Math.abs(Math.sin(vt * 9)) * 0.03 : 0;
    deck.position.copy(lopo.pos).addScaledVector(fl, 0.36).add(V(0, (lopo.liftDeck ? 1.2 : 1.04) + bob, 0));
    deck.rotation.set(-0.25, lopo.yaw, 0);
    lopo.ikL.set(deck.position.clone().addScaledVector(rl, -0.25).add(V(0, 0.03, 0)), 1);
    lopo.ikR.set(deck.position.clone().addScaledVector(rl, 0.25).add(V(0, 0.03, 0)), 1);
  }
  deck.userData.update(dt, beat, on);
}
// heads nodding on the beat (after the animation, before the head-look)
function nodToBeat() {
  if (state.world !== 'cabin') return;
  if (musicT0 == null) return;
  const b = beatNow(), dip = Math.pow(Math.max(0, Math.cos(b * Math.PI * 2)), 3);
  for (const [a, amp] of [[kauai, 0.16], [zuma, 0.2], [lopo, 0.1]]) { if (!a.nod) continue; a.bone('Neck')?.rotateX(amp * dip * (state.partyK || 0)); }
}

// ---------------------------------------------------------------- scenes
function setTotem(s) { totem.setState(s); }
const yawTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);
const fwdOf = (a) => V(Math.sin(a.yaw), 0, Math.cos(a.yaw));
const TX = land.taxi;
const EXT_START = TX.rearDoor.clone();
const DOOR_OUT = V(8.2, 0, 17.4), DOOR_IN = V(8.4, 0, 13.9);
const BOARD2 = V(14.2, 4.6, 7.6), BOARD2_SPOT = V(11.5, 0, 12.3);
const DESK_STOP = V(0.65, 0, 11.75), MOTTI_POS = V(-1.25, 0, 11.05), SA_POS = V(-1.25, 0, 12.15);
const LEO_A = V(9.9, 0, 14.4), LEO_B = V(7.4, 0, 14.1);
const M_BOARD2 = marker(BOARD2), M_FEET = marker(V(0, 0.1, 0));
let rainOut = null;

function resetWorld() {
  prof.pos.copy(EXT_START); prof.yaw = prof.yawGoal = Math.PI; prof.walk = null; prof.head.stopAnimation(); prof.slip = 0; prof.fall = null; actors.forEach((a) => { a.holdIdle = 0; a.lineN = 0; }); prof.wet = 0.25; prof.phoneT = 0; suitRoll.set(0, 0, 0);
  att.pos.copy(ATT_POS); att.yaw = att.yawGoal = ATT_YAW;
  diniz.pos.copy(TX.driverSeat).add(V(0, 0.6, 0)); diniz.yaw = diniz.yawGoal = -Math.PI / 2;
  leo.pos.copy(LEO_A); leo.yaw = leo.yawGoal = -Math.PI / 2; leo.onPhone = true; leo.walk = null;
  motti.pos.copy(MOTTI_POS); motti.yaw = motti.yawGoal = Math.PI / 2;
  sa.pos.copy(SA_POS); sa.yaw = sa.yawGoal = Math.PI / 2;
  state.suitMode = 'parked'; state.phone = false; state.typing = false; state.passMode = 'hidden'; state.passOwner = null;
  actors.forEach((a) => { a.ikL.weight = a.ikL.goal = 0; a.ikR.weight = a.ikR.goal = 0; a.look.weight = a.look.goal = 0; a.look.target = null; a.arm.rotation.x = a.arm.rotation.z = 0; });
  suit.position.copy(EXT_START).add(V(0.45, 0, 0.1)); suit.quaternion.setFromEuler(new THREE.Euler(0, Math.PI, 0));
  airport.setDelayed(false); land.doors(false); TX.setDoor(true);
  hideRoll(); eyeContact(prof, false); setWorld('airport'); prof.seated = false; lopo.carry = false; musicT0 = null; state.party = 0;
  setTotem('idle'); grade.uniforms.uFade.value = 1; $('endcard').classList.remove('on'); showSub(null);
}
function placeAtKiosk() {
  prof.pos.copy(PROF_STOP); prof.yaw = prof.yawGoal = PROF_YAW; state.suitMode = 'parked';
  const right = V(-Math.cos(PROF_YAW), 0, Math.sin(PROF_YAW));
  suit.position.copy(PROF_STOP).addScaledVector(right, 0.45); suit.quaternion.setFromEuler(new THREE.Euler(0, PROF_YAW, 0));
  look(prof, att.head); look(att, prof.head); leo.onPhone = false; leo.pos.set(14, 0, 18);
}
// camera framing a horizontal band of the kiosk screen (v = 0 top … 1 bottom)
const screenCam = (v, dist = 1.1, dx = -0.18) => ({ p: () => screenPt(0.5, v).add(V(dx, 0.13 * dist, 0.99 * dist)), l: () => screenPt(0.5, v) });
const screenPt = (u, v) => totem.screen.localToWorld(V((u - 0.5) * 0.54, (0.5 - v) * 0.96, 0.03));
const until = async (cond, max = 20) => { const t = vt; while (!cond() && vt - t < max) await wait(1 / 30); };

// 1 — the taxi under the canopy
async function scene1() {
  rainOut = sfx('rain_out', 1.0);
  look(diniz, prof.head); look(prof, TX.group);
  // through the wet entrance glass: taxi parked, Soussa getting out
  cut({ p0: V(7.5, 1.55, 13.4), p1: V(7.7, 1.55, 14.2), l0: V(9.0, 1.15, 22.2), dur: 6, fov: 30, focus: () => V(9.0, 1.1, 22.0), aperture: 0.0012 });
  await wait(2.2);
  sfx('carDoor', 0.8); TX.setDoor(false);
  await wait(1.3);
  // close on Diniz through the open passenger window
  cut({ p0: () => V(7.55, 1.22, 19.9), l0: headOf(diniz, -0.05), fov: 20, focus: headOf(diniz), aperture: 0.0022, handheld: 0.004 });
  await wait(0.4);
  await say('m1');
  cut({ p0: V(8.05, 1.62, 18.4), p1: V(8.15, 1.62, 18.9), l0: headOf(prof, -0.12), dur: 4, fov: 30, focus: headOf(prof), aperture: 0.002 });
  look(prof, diniz.head);
  const p10 = say('p10', { anim: false }); await wait(0.3); gesture(prof, 'handup', 1.4, true); await p10;
  // Soussa: thanks with a hand, turns to the doors
  await wait(0.3);
  look(prof, null); state.suitMode = 'pull';
  const go = walkTo(prof, [V(8.8, 0, 19.6), DOOR_OUT], 1.45);
  await wait(1.2);
  // Diniz, almost to himself, Soussa already walking away
  cut({ p0: () => V(7.3, 1.2, 20.1), l0: headOf(diniz, -0.05), fov: 22, focus: headOf(diniz), aperture: 0.002, handheld: 0.004 });
  look(diniz, prof.head);
  await say('m2');
  airport.strikeNow();
  await go;
}

// 2 — the wet entrance
async function scene2() {
  cut({ p0: V(7.1, 1.5, 12.4), p1: V(7.3, 1.5, 12.9), l0: V(8.3, 1.45, 16.5), dur: 6, fov: 32, focus: headOf(prof), aperture: 0.0015 });
  land.doors(true); sfx('door', 0.7);
  await wait(0.5);
  const inn = walkTo(prof, [V(8.3, 0, 15.6), DOOR_IN], 1.35);
  await until(() => prof.pos.z < 15.2);
  if (rainOut) rainOut.g.gain.setTargetAtTime(0.35, audioCtx.currentTime, 0.4);
  EVENTS.push({ t: vt, type: 'rainDuck' });
  await inn;
  land.doors(false); sfx('door', 0.5);
  turnTo(prof, Math.PI + 0.35);
  cut({ p0: () => prof.pos.clone().add(V(-0.9, 1.6, -1.9)), p1: () => prof.pos.clone().add(V(-0.8, 1.6, -1.7)), l0: headOf(prof, -0.25), dur: 2, fov: 32, focus: headOf(prof), aperture: 0.0016 });
  prof.shake = 0.8; gesture(prof, 'shrug', 0.9); await wait(1.2);
  // phone buzzes: message from his wife
  sfx('buzz', 0.8);
  phone.setChat([{ me: false, text: 'Já tá no aeroporto? Papai tá de roupa nova desde as 7h.' }]);
  state.phone = 'hand'; state.suitMode = 'parked'; look(prof, M_PHONE);
  await wait(0.4);
  cut({ p0: rel(prof, -0.26, 1.86, -0.06), p1: rel(prof, -0.22, 1.84, 0.0), l0: () => M_PHONE.position.clone(), dur: 5, fov: 12, focus: () => M_PHONE.position.clone(), aperture: 0.0014, handheld: 0.003 });
  await wait(2.4);
  state.typing = true; await wait(1.4); state.typing = false;
  phone.setChat([{ me: false, text: 'Já tá no aeroporto? Papai tá de roupa nova desde as 7h.' }, { me: true, text: 'Cheguei. Tudo no horário.' }]);
  await wait(1.8);
  state.phone = false; prof.ikR.release();
}

// 3 — the board says ON TIME
async function scene3() {
  state.suitMode = 'pull'; look(prof, M_BOARD2);
  leo.onPhone = true;
  cut({ p0: V(9.4, 1.6, 15.2), l0: headOf(prof, -0.2), fov: 34, focus: headOf(prof), aperture: 0.0012, smoothPos: true });
  await walkTo(prof, [V(10.2, 0, 13.2), BOARD2_SPOT], 1.35);
  turnTo(prof, yawTo(prof.pos, BOARD2)); state.suitMode = 'parked'; prof.ikR.release();
  // over his shoulder: the board, AA 1455 ON TIME
  cut({ p0: () => prof.pos.clone().add(V(-0.75, 1.75, 1.15)), p1: () => prof.pos.clone().add(V(-0.6, 1.72, 0.9)), l0: () => BOARD2.clone().add(V(0.45, -0.1, 0.1)), dur: 4.5, fov: 27, focus: () => BOARD2.clone(), aperture: 0.0008, handheld: 0.002 });
  await wait(3.6);
  // relief, then the lightning and the lights dip
  cut({ p0: rel(prof, 0.1, 1.58, 1.55), l0: headOf(prof, -0.05), fov: 28, focus: headOf(prof), aperture: 0.0016 });
  prof.head.setMood('happy');
  walkTo(leo, [LEO_B], 1.1).then(() => turnTo(leo, yawTo(leo.pos, prof.pos) - 0.5));
  await wait(1.1);
  airport.strikeNow();
  await wait(0.9);
  prof.head.setMood('neutral');
  // Leo, behind him on the phone
  cut({ p0: rel(prof, 0.45, 1.6, 1.5), l0: headOf(leo, -0.15), fov: 22, focus: headOf(leo), aperture: 0.002 });
  look(leo, null);
  const l1 = say('l1', { anim: 'talk1' });
  await wait(1.0); look(prof, leo.head); turnTo(prof, yawTo(prof.pos, leo.pos) - 0.6);
  await l1;
  walkTo(leo, [LEO_A, V(11.5, 0, 14.8)], 1.1);
  cut({ p0: rel(prof, -0.2, 1.6, 1.3), l0: headOf(prof, -0.06), fov: 26, focus: headOf(prof), aperture: 0.002 });
  look(prof, M_BOARD2); prof.head.setMood('sad');
  await wait(1.6);
}

// 4 — the information desk
async function scene4() {
  prof.head.setMood('neutral'); look(prof, null); state.suitMode = 'pull';
  cut({ p0: V(3.5, 1.62, 9.3), l0: V(0.0, 1.3, 11.7), fov: 34, focus: () => V(-0.4, 1.4, 11.6), aperture: 0.0012 });
  const go = walkTo(prof, [V(8.0, 0, 12.0), V(3.5, 0, 11.9), DESK_STOP], 1.45);
  look(motti, prof.head); look(sa, prof.head);
  await wait(1.6);
  const call = say('mt1', { gesture: ['handup', 1.6] });
  await go;
  turnTo(prof, -Math.PI / 2 + 0.25); state.suitMode = 'parked'; prof.ikR.release(); look(prof, motti.head);
  await call;
  // Soussa explains (over Motti's shoulder)
  cut({ p0: rel(motti, -0.3, 1.62, -0.55), l0: headOf(prof, -0.08), fov: 28, focus: headOf(prof), aperture: 0.0022 });
  await say('p1', { anim: 'talk1' });
  // Motti and Sá exchange a look
  cut({ p0: () => V(0.1, 1.5, 14.2), l0: () => mid(headOf(motti), headOf(sa))(), fov: 30, focus: headOf(motti), aperture: 0.0015 });
  look(motti, sa.head); look(sa, motti.head);
  motti.head.setMood('happy'); sa.head.setMood('happy');
  laugh(motti, 1.5, 0.15); await wait(0.15); laugh(sa, 1.4, 0.55);
  await wait(1.55);
  motti.head.setMood('neutral'); sa.head.setMood('neutral');
  // Sá points to the kiosk
  look(sa, totem.head); turnTo(sa, yawTo(sa.pos, KIOSK) + 0.5);
  const sp = say('sa1', { gesture: ['index', 2.6] });
  await wait(1.6);
  // his point of view: the kiosk across the hall
  cut({ p0: () => prof.headPos().add(V(-0.15, 0, -0.1)), l0: () => totem.head.getWorldPosition(new THREE.Vector3()), fov: 26, focus: () => totem.head.getWorldPosition(new THREE.Vector3()), aperture: 0.0016, handheld: 0.004 });
  look(prof, totem.head);
  await sp;
  cut({ p0: rel(motti, -0.3, 1.62, -0.55), l0: headOf(prof, -0.08), fov: 28, focus: headOf(prof), aperture: 0.0022 });
  look(prof, sa.head); gesture(prof, 'thumbup', 1.2, true);
  await wait(1.3);
}

// 5 — the slip (and the fall)
async function scene5() {
  look(prof, totem.head); state.suitMode = 'pull';
  look(motti, prof.head); look(sa, prof.head);
  walkTo(prof, [V(0.85, 0, 7.8), V(1.05, 0, 5.0), V(0.95, 0, 2.6), PROF_STOP], 2.3);
  cut({ p0: V(2.35, 0.32, 3.7), l0: V(1.2, 0.35, 5.5), fov: 38, focus: () => V(1.3, 0.3, 5.2), aperture: 0.0012, handheld: 0.003 });
  await until(() => prof.pos.z < 5.6);
  // slip: feet go, arms fly up, he lands sitting with the gift held high
  prof.walk = null; prof.head.stopAnimation(); prof.slip = 0.45; sfx('squeak', 0.9);
  state.suitMode = 'parked'; suitRoll.set(prof.pos.x - 0.9, 0, prof.pos.z + 1.6);
  await wait(0.35);
  prof.fall = { t: 0 };
  await wait(0.42); sfx('thud', 0.8);
  // floor level, side on: he lands, checks the gift, gets up
  const upK = () => (prof.fall && prof.fall.up != null ? smooth(Math.min(1, prof.fall.up / 1.9)) : prof.fall ? 0 : 1);
  const FP = prof.pos.clone();
  cut({ p0: () => FP.clone().add(V(-1.35, 0.75 + 0.55 * upK(), -1.95)), l0: () => FP.clone().add(V(0, 0.55 + 0.85 * upK(), 0.1)), fov: 36, focus: () => prof.headPos(), aperture: 0.0016, handheld: 0.004, smoothPos: true });
  prof.head.setMood('sad');
  await wait(0.9); look(prof, M_BAG); await wait(0.9); prof.head.setMood('neutral'); look(prof, totem.head);
  await wait(0.4);
  prof.fall.up = 0; look(prof, V(prof.pos.x, 0.2, prof.pos.z - 1.2));
  await wait(1.1); look(prof, totem.head);
  await until(() => !prof.fall, 3);
  prof.shake = 0.5; await wait(0.6);
  // at the kiosk: Guis saw it all, and can't quite hold the laugh
  cut({ p0: rel(att, 0.35, 1.62, 1.1), p1: rel(att, 0.3, 1.62, 0.95), l0: headOf(att, -0.06), dur: 3, fov: 28, focus: headOf(att), aperture: 0.0024 });
  look(att, V(1.0, 1.2, 5.0)); att.head.setMood('happy'); laugh(att, 1.7, 0.3);
  // (hidden by the cut) he picks the suitcase back up and starts again
  prof.pos.set(0.95, 0, 3.6); prof.yaw = prof.yawGoal = Math.PI; suitRoll.set(0, 0, 0);
  await wait(2.0);
  look(att, prof.head);
  state.suitMode = 'pull';
  cut({ p0: V(2.4, 1.55, 3.2), p1: V(2.2, 1.5, 2.8), l0: () => prof.headPos().add(V(0, -0.35, 0)), dur: 3, fov: 32, focus: headOf(prof), smoothPos: true });
  await walkTo(prof, [PROF_STOP], 1.2);
  turnTo(prof, PROF_YAW); state.suitMode = 'parked'; prof.ikR.release();
  look(prof, att.head);
  await wait(0.4);
}

// 6 — the question
async function scene6() {
  cut({ p0: rel(att, -0.55, 1.6, -0.45), l0: headOf(prof, -0.08), fov: 30, focus: headOf(prof), aperture: 0.0025 });
  await say('p2', { gesture: ['index', 1.6, true] });
  cut({ p0: rel(prof, 0.55, 1.62, -0.45), l0: headOf(att, -0.08), fov: 30, focus: headOf(att), aperture: 0.0025 });
  await say('a1', { gesture: ['side', 2, true] });
}

// 7 — the lookup
async function scene7() {
  cut({ p0: V(1.9, 1.45, 2.6), p1: V(1.6, 1.4, 2.2), l0: V(-0.15, 1.15, 0.55), dur: 4, fov: 32, focus: () => V(-0.15, 1.1, 0.7) });
  state.passMode = 'prof'; state.passOwner = prof; state.passHand = 'RightHand';
  const meet = V(-0.2, 1.05, 0.85);
  prof.ikR.set(meet, 1); await wait(1.0);
  att.ikR.set(meet.clone().add(V(-0.04, 0.0, -0.02)), 1); await wait(0.9);
  state.passOwner = att; state.passHand = 'RightHand'; prof.ikR.release();
  att.ikR.set(V(0.0, 0.92, 0.22), 1); await wait(0.9);
  state.passMode = 'hidden'; state.passOwner = null; setTotem('form'); look(att, M_SCREEN); look(prof, M_SCREEN);
  { const c0 = screenCam(0.36, 1.25), c1 = screenCam(0.42, 1.1); cut({ p0: c0.p, p1: c1.p, l0: c0.l, l1: c1.l, dur: 5, fov: 30, focus: c1.l, aperture: 0.0008, handheld: 0.003 }); }
  for (let i = 0; i < 4; i++) { att.ikR.set(screenPt(0.6, 0.27 + i * 0.1), 1); await wait(0.45); att.ikR.set(screenPt(0.62, 0.25 + i * 0.1).add(V(0, 0, 0.05)), 1); await wait(0.45); }
  att.ikR.set(screenPt(0.5, 0.67), 1); await wait(0.6); att.ikR.release();
  await wait(2.6);
  setTotem('auto');
  { const c = screenCam(0.55, 1.25); cut({ p0: c.p, l0: c.l, fov: 30, focus: c.l, aperture: 0.0008, handheld: 0.002 }); }
  await wait(6.5);
  cut({ p0: () => att.pos.clone().add(V(0.95, 1.55, 1.05)), p1: () => att.pos.clone().add(V(0.8, 1.55, 0.9)), l0: headOf(att, -0.08), dur: 6, fov: 30, focus: headOf(att), aperture: 0.0022 });
  look(att, totem.head);
  const sp = say('a2', { gesture: ['index', 2.2, true] });
  await wait(1.2); look(att, prof.head);
  await sp;
  { const c = screenCam(0.55, 1.25); cut({ p0: c.p, l0: c.l, fov: 30, focus: c.l, aperture: 0.0008, handheld: 0.003 }); }
  await wait(3.5);
}

// 8 — the result
async function scene8() {
  prof.wet = Math.min(prof.wet, 0.3);
  att.ikR.set(screenPt(0.5, 0.78), 1); await wait(0.5); att.ikR.release();
  setTotem('analyzing');
  { const c0 = screenCam(0.5, 1.3), c1 = screenCam(0.38, 1.15); cut({ p0: c0.p, p1: c1.p, l0: c0.l, l1: c1.l, dur: 6, fov: 30, focus: c1.l, aperture: 0.0008, handheld: 0.002 }); }
  await wait(2.8);
  setTotem('result');
  { const c0 = screenCam(0.33, 1.25), c1 = screenCam(0.37, 1.15); cut({ p0: c0.p, p1: c1.p, l0: c0.l, l1: c1.l, dur: 5, fov: 30, focus: c1.l, aperture: 0.0008, handheld: 0.002 }); }
  await wait(7.0);
  { const c0 = screenCam(0.7, 0.98), c1 = screenCam(0.76, 0.92); cut({ p0: c0.p, p1: c1.p, l0: c0.l, l1: c1.l, dur: 4, fov: 30, focus: c1.l, aperture: 0.0008, handheld: 0.002 }); }
  await wait(6.0);
  cut({ p0: rel(prof, 0.38, 1.66, -0.62), l0: headOf(att, -0.06), fov: 25, focus: headOf(att), aperture: 0.0028 });
  look(att, prof.head); att.head.setMood('neutral');
  await say('a3');
  cut({ p0: rel(att, -0.38, 1.62, -0.62), l0: headOf(prof, -0.06), fov: 25, focus: headOf(prof), aperture: 0.0028 });
  look(prof, att.head); gesture(prof, 'shrug', 1.6);
  await say('p3', { anim: false });
  cut({ p0: () => att.pos.clone().add(V(0.9, 1.5, 1.35)), p1: () => att.pos.clone().add(V(0.75, 1.5, 1.15)), l0: headOf(att, -0.15), dur: 9, fov: 32, focus: headOf(att), aperture: 0.0018 });
  look(prof, att.head);
  const s = say('a4', { anim: 'talk0' });
  await wait(1.5);
  { const c = screenCam(0.76, 0.92); cut({ p0: c.p, l0: c.l, fov: 30, focus: c.l, aperture: 0.0008, handheld: 0.002 }); }
  await wait(5.0);
  cut({ p0: rel(prof, 0.38, 1.66, -0.62), l0: headOf(att, -0.06), fov: 25, focus: headOf(att), aperture: 0.0028 });
  await s;
  // he looks at the screen, then down at his soaked shoes
  cut({ p0: rel(prof, 0.45, 1.58, 1.15), p1: rel(prof, 0.4, 1.58, 1.0), l0: headOf(prof, -0.12), dur: 9, fov: 26, focus: headOf(prof), aperture: 0.003 });
  look(prof, M_SCREEN); await wait(0.9);
  M_FEET.position.copy(prof.pos).addScaledVector(fwdOf(prof), 0.35); look(prof, M_FEET); await wait(1.0);
  look(prof, att.head); prof.head.setMood('happy');
  await say('p8', { anim: 'talk1' });
  prof.head.setMood('neutral');
}

// 9 — the reaction
async function scene9() {
  cut({ p0: rel(prof, 0.5, 1.56, 1.25), p1: rel(prof, 0.42, 1.57, 1.1), l0: headOf(prof, -0.12), dur: 10, fov: 26, focus: headOf(prof), aperture: 0.003 });
  look(prof, M_BAG); await wait(1.4);
  prof.ikL.set(prof.pos.clone().addScaledVector(fwdOf(prof), 0.28).add(V(0, 1.12, 0)), 1);
  await wait(1.4); prof.ikL.release();
  look(prof, att.head);
  await say('p4');
  await wait(0.9);
  look(prof, camera);
  await say('p5');
}

// 10 — the call
async function scene10() {
  turnTo(prof, PROF_YAW + 0.7); look(prof, null);
  phone.setChat([{ me: false, text: 'Amor ❤ chamando…' }]);
  state.phone = 'hand'; look(prof, M_PHONE); sfx('buzz', 0.4);
  cut({ p0: rel(prof, 0.35, 1.58, 1.5), p1: rel(prof, 0.3, 1.58, 1.3), l0: headOf(prof, -0.1), dur: 10, fov: 28, focus: headOf(prof), aperture: 0.0026 });
  await wait(1.1);
  state.phone = 'ear'; look(prof, null);
  await wait(1.0);
  await say('p6', { anim: false });
  look(prof, M_BAG);
  await say('p7', { anim: false });
}

// 11 — the board confirms
async function scene11() {
  state.phone = false; prof.ikR.release(); look(prof, M_BOARD);
  turnTo(prof, yawTo(prof.pos, M_BOARD.position));
  const toB = M_BOARD.position.clone().sub(prof.pos).setY(0).normalize();
  const camP = () => prof.pos.clone().addScaledVector(toB, -1.5).add(V(-toB.z * 0.45, 1.72, toB.x * 0.45));
  cut({ p0: camP, l0: () => M_BOARD.position.clone().add(V(0, -0.2, 0)), fov: 24, focus: headOf(prof), aperture: 0.0016 });
  await wait(1.6);
  airport.setDelayed(true); sfx('buzz', 0.0);
  cut({ p0: camP, l0: () => M_BOARD.position.clone().add(V(0, -0.2, 0)), fov: 24, focus: () => M_BOARD.position.clone(), aperture: 0.0016 });
  await wait(2.6);
  // close on him: board, kiosk, Guis
  cut({ p0: rel(prof, -0.15, 1.6, 1.15), p1: rel(prof, -0.1, 1.6, 1.0), l0: headOf(prof, -0.06), dur: 12, fov: 26, focus: headOf(prof), aperture: 0.003 });
  await wait(0.8); look(prof, totem.head); await wait(0.9); look(prof, att.head); await wait(0.7);
  look(prof, att.head);
  await say('p9', { anim: 'talk1' });
  grade.uniforms.uFade.value = 0;   // hard cut to black
  await wait(0.8);
}

// 12 — end card + credits
async function scene12() {
  grade.uniforms.uFade.value = 0;
  const cr = CREDITS.map(([n, r]) => `${n} · ${r}`).join('<br>');
  $('realcase').innerHTML = `Voo real: ${CFG.flight.airline} ${CFG.flight.code}, ${CFG.flight.origin} → ${CFG.flight.dest}, ${CFG.flight.date}<br>Previsão 1 h antes: ${Math.round(CFG.result.p * 100)}% · ${CFG.result.actual}<br><br><span style="font-size:.8em;opacity:.8">${cr}</span>`;
  EVENTS.push({ t: vt, type: 'end', title: '', sub: [`Voo real: ${CFG.flight.airline} ${CFG.flight.code}, ${CFG.flight.origin} → ${CFG.flight.dest}, ${CFG.flight.date}`, `Previsão 1 h antes: ${Math.round(CFG.result.p * 100)}% · ${CFG.result.actual}`, '', ...CREDITS.map(([n, r]) => `${n} · ${r}`)] });
  $('endcard').querySelector('h2').style.display = 'none';
  $('endcard').classList.add('on');
  await wait(8);
  EVENTS.push({ t: vt, type: 'endOff' });
}

function showRoll(lines, dur) {
  let el = $('roll'); if (!el) { el = document.createElement('div'); el.id = 'roll'; document.body.appendChild(el); }
  el.style.cssText = 'position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:30;font-family:Segoe UI,system-ui,sans-serif;color:#fff;text-align:center';
  el.innerHTML = '<div id="rollin" style="position:absolute;left:0;right:0;top:100%;font-size:clamp(16px,2.2vw,34px);line-height:2.1">' + lines.map(([a, b]) => (b ? `<div><b style="font-weight:600">${a}</b><span style="opacity:.65"> · ${b}</span></div>` : `<div style="${a === 'ELENCO' ? 'letter-spacing:.3em;opacity:.8' : ''}">${a || '&nbsp;'}</div>`)).join('') + '</div>';
  const inner = $('rollin'); inner.style.transition = `transform ${dur}s linear`;
  requestAnimationFrame(() => requestAnimationFrame(() => { inner.style.transform = `translateY(calc(-100vh - 100%))`; }));
}
function hideRoll() { $('roll')?.remove(); }
function eyeContact(a, on) { const av = a.head.avatar; av.avatarSpeakingEyeContact = on ? 1 : 0; av.avatarIdleEyeContact = on ? 1 : 0; av.avatarSpeakingHeadMove = on ? 0.08 : 0.45; av.avatarIgnoreCamera = !on; }

// 13 — post-credits: the plane
async function scene13() {
  const W = (x, y, z) => cabin.toWorld(x, y, z);
  $('endcard').classList.remove('on'); grade.uniforms.uFade.value = 0;
  setWorld('cabin'); musicT0 = null; state.party = 0; state.partyK = 0;
  prof.seated = false; prof.fall = null; prof.slip = 0; prof.head.setMood('neutral'); prof.wet = Math.min(prof.wet || 0.3, 0.3);
  state.phone = false; state.passMode = 'hidden'; prof.ikR.release(); prof.ikL.release();
  seat(kauai, 5, 'C'); seat(zuma, 8, 'D');
  kauai.typing = true; kauai.nod = true; zuma.nod = true; look(kauai, null); look(zuma, null);
  lopo.carry = false; lopo.pos.copy(W(-2.6, 0, 1.35)); lopo.yaw = lopo.yawGoal = Math.PI / 2; lopo.idleOK = false; lopo.nod = false;
  cabin.door.set(true); cabin.setReading(false);
  // Soussa at the aircraft door, suitcase in tow
  prof.pos.copy(W(-1.55, 0, 1.35)); prof.yaw = prof.yawGoal = Math.PI / 2; prof.head.stopAnimation();
  state.suitMode = 'pull'; look(prof, null);
  sfx('cabin_hum', 0.35);
  await wait(0.6); sfx('chime', 0.6);
  await wait(0.5); sfx('an1', 0.55);
  // 1) wide, mid-cabin looking forward: he steps in through the door
  cut({ p0: W(0.25, 1.6, -5.6), p1: W(0.2, 1.58, -5.2), l0: W(-0.7, 1.25, 0.9), l1: W(-0.3, 1.3, 0.2), dur: 6, fov: 34, focus: () => prof.headPos(), aperture: 0.0012 });
  for (let i = 1; i <= 12; i++) { grade.uniforms.uFade.value = i / 12; await wait(1 / 12); }
  const go = walkTo(prof, [W(-0.9, 0, 1.0), W(-0.15, 0, 0.45), W(0.05, 0, -1.2), W(0.1, 0, rowZ(5) + 0.08)], 1.05);
  await until(() => prof.pos.z < W(0, 0, -0.6).z);
  // 2) leading him down the aisle (camera backs away in front of him)
  cut({ p0: () => prof.pos.clone().add(V(0.12, 1.6, -2.1)), l0: headOf(prof, -0.08), fov: 30, focus: headOf(prof), aperture: 0.0018, smoothPos: true, handheld: 0.004 });
  look(prof, V(0, 0, 0).copy(W(0, 1.1, rowZ(7))));
  await wait(1.2); kauai.typing = false; look(kauai, prof.head);
  await go; turnTo(prof, yawTo(prof.pos, kauai.pos)); state.suitMode = 'parked'; prof.ikR.release(); look(prof, kauai.head);
  // 3) over Soussa's shoulder: Kauai with the laptop
  cut({ p0: () => prof.pos.clone().add(V(0.5, 1.68, -0.5)), l0: () => kauai.headPos().add(V(0, -0.12, 0)), fov: 30, focus: headOf(kauai), aperture: 0.002, handheld: 0.003 });
  const k1 = say('k1');
  await wait(2.4);
  // insert: the screen (CPF field, "CRIAR MOEDA")
  cut({ p0: () => lap.position.clone().add(V(0.34, 0.5, -0.26)), l0: () => lap.position.clone().add(V(0, 0.09, 0.04)), fov: 32, focus: () => lap.position.clone().add(V(0, 0.09, 0.04)), aperture: 0.0016, handheld: 0.002 });
  await wait(1.8);
  cut({ p0: () => prof.pos.clone().add(V(0.5, 1.68, -0.5)), l0: () => kauai.headPos().add(V(0, -0.12, 0)), fov: 30, focus: headOf(kauai), aperture: 0.002, handheld: 0.003 });
  await k1;
  // 4) Soussa, low angle from Kauai's seat
  cut({ p0: () => kauai.headPos().add(V(-0.42, -0.04, 0.12)), l0: headOf(prof, -0.08), fov: 34, focus: headOf(prof), aperture: 0.0024 });
  await wait(0.3);
  await say('p11');
  await wait(0.4); kauai.typing = true; look(kauai, null);
  // on to Zuma
  state.suitMode = 'pull'; look(prof, null);
  const go2 = walkTo(prof, [W(0.02, 0, rowZ(8) + 0.08)], 1.0);
  cut({ p0: () => prof.pos.clone().add(V(-0.1, 1.6, -2.0)), l0: headOf(prof, -0.08), fov: 30, focus: headOf(prof), aperture: 0.0018, smoothPos: true, handheld: 0.004 });
  await wait(0.8); look(zuma, prof.head); zuma.head.setMood('happy');
  await go2; turnTo(prof, yawTo(prof.pos, zuma.pos)); state.suitMode = 'parked'; prof.ikR.release(); look(prof, zuma.head);
  // 5) Zuma, colourful shirt, smug
  cut({ p0: () => prof.pos.clone().add(V(-0.5, 1.68, -0.5)), l0: () => zuma.headPos().add(V(0, -0.12, 0)), fov: 30, focus: headOf(zuma), aperture: 0.002, handheld: 0.003 });
  await say('z1');
  cut({ p0: () => zuma.headPos().add(V(0.42, -0.04, 0.12)), l0: headOf(prof, -0.08), fov: 34, focus: headOf(prof), aperture: 0.0024 });
  prof.head.setMood('sad');
  await wait(0.2);
  await say('p13');
  prof.head.setMood('neutral'); look(zuma, null);
  // to his seat (11D), sit down (cut)
  state.suitMode = 'pull'; look(prof, null);
  const go3 = walkTo(prof, [W(0.06, 0, rowZ(11) + 0.45)], 1.05);
  cut({ p0: W(-0.35, 1.55, rowZ(13)), l0: () => prof.headPos().add(V(0, -0.15, 0)), fov: 30, focus: headOf(prof), aperture: 0.0016 });
  await go3; turnTo(prof, Math.PI / 2 + 0.6); await wait(0.6);
  state.suitMode = 'hidden'; suit.position.set(0, -10, 0); prof.ikR.release();
  seat(prof, 11, 'D'); prof.seated = true; 
  // 6) seated, relief; the door starts closing; music from outside
  cut({ p0: () => prof.headPos().add(V(-0.22, -0.02, 1.15)), p1: () => prof.headPos().add(V(-0.2, -0.02, 0.95)), l0: headOf(prof, -0.06), dur: 7, fov: 26, focus: headOf(prof), aperture: 0.003 });
  look(prof, W(0.6, 1.3, rowZ(9))); await wait(0.6);
  prof.head.setMood('happy'); await wait(1.4);
  cabin.door.set(false); sfx('doorclose', 0.5);
  music('lopo_music.mp3', [[0, 0, 0], [1.5, 0.35, 0], [3.6, 0.8, 0]]);
  await wait(1.2); look(prof, W(-0.4, 1.4, 1.2)); prof.head.setMood('neutral');
  await wait(1.0);
  // 7) the door: stops, opens again, Lopo bursts in with the deck
  cut({ p0: W(0.35, 1.5, -2.2), l0: W(-1.2, 1.25, 1.25), fov: 34, focus: () => lopo.headPos(), aperture: 0.0014, handheld: 0.005 });
  await wait(0.6);
  cabin.door.set(true); sfx('door', 0.5); musicTo(0.04, 0.9, 0.35);
  lopo.carry = true; lopo.nod = true; state.party = 1; cabin.setReading(true);
  const run = walkTo(lopo, [W(-1.0, 0, 1.25), W(-0.2, 0, 0.7), W(0.0, 0, -0.6), W(-0.05, 0, rowZ(10) + 0.1)], 2.5);
  await wait(0.9); cabin.door.set(false);
  look(kauai, lopo.head); look(zuma, lopo.head); kauai.typing = false;
  // 8) from behind Soussa's seat: Lopo runs down the aisle toward us
  cut({ p0: () => prof.headPos().add(V(0.25, 0.12, -0.55)), l0: () => lopo.headPos().add(V(0, -0.25, 0)), fov: 30, focus: () => lopo.headPos(), aperture: 0.0016, handheld: 0.006 });
  look(prof, lopo.head);
  await run; turnTo(lopo, Math.PI - 0.15); lopo.liftDeck = true; look(lopo, prof.head);
  musicTo(0.03, 0.22, 0.3);   // music down so we hear him
  await wait(0.35);
  await say('lp1');
  musicTo(0.03, 0.85, 0.4);
  await wait(0.5);
  // 9) Soussa, to camera
  cut({ p0: () => prof.headPos().add(V(-0.04, -0.03, 1.0)), l0: headOf(prof, -0.03), fov: 24, focus: headOf(prof), aperture: 0.0032 });
  look(prof, lopo.head); await wait(0.9); look(prof, camera);
  eyeContact(prof, true);   // he turns to us: eyes on the lens, no wandering while he talks
  musicTo(0.03, 0.28, 0.4);
  await say('p12');
  musicTo(0.03, 1.0, 0.25);
  await wait(1.3);
  // the music takes over: fade to black, the final credits roll
  for (let i = 1; i <= 15; i++) { grade.uniforms.uFade.value = 1 - i / 15; await wait(1 / 15); }
  const roll = [['ELENCO', ''], ...CREDITS, ['', ''], ['Kauai', 'investidor de bordo'], ['Zuma', 'aluno da USP'], ['Lopo', 'DJ (atrasado)'], ['', ''], ['Música', CFG.music || 'tocada pelo Lopo'], ['', ''], ['Obrigado por tudo, Soussa.', '']];
  const ROLL = 16;
  EVENTS.push({ t: vt, type: 'roll', dur: ROLL, lines: roll.map(([a, b]) => (b ? `${a}  ·  ${b}` : a)) });
  showRoll(roll, ROLL);
  await wait(ROLL - 3);
  musicTo(0, 0, 3); await wait(3.2);
  musicStop(); hideRoll();
  await wait(0.4);
}

const SCENES = [scene1, scene2, scene3, scene4, scene5, scene6, scene7, scene8, scene9, scene10, scene11, scene12, scene13];
async function run(from = 1) {
  const id = ++runId;
  resetWorld();
  if (from >= 2) { prof.pos.copy(DOOR_OUT); prof.yaw = prof.yawGoal = Math.PI; TX.setDoor(false); }
  if (from >= 2) prof.wet = 1;
  if (from >= 3) { prof.pos.copy(DOOR_IN); }
  if (from >= 4) { prof.pos.copy(BOARD2_SPOT); }
  if (from >= 5) { prof.pos.copy(DESK_STOP); prof.yaw = prof.yawGoal = -Math.PI / 2; leo.onPhone = false; }
  if (from >= 6) placeAtKiosk();
  if (from >= 8) { setTotem('auto'); prof.wet = 0.3; }
  if (from >= 9) setTotem('result');
  if (from >= 13) { prof.wet = 0.3; }
  try {
    for (let i = from; i <= SCENES.length; i++) { $('scenelabel').textContent = `Cena ${i}`; EVENTS.push({ t: vt, type: 'scene', n: i }); await SCENES[i - 1](); }
    window.__finished = vt; console.log('SCENES', JSON.stringify(EVENTS.filter((e) => e.type === 'scene').map((e) => [e.n, +e.t.toFixed(1)])), 'END', vt.toFixed(1));
    $('controls').classList.add('on');
  } catch (e) { if (e.message !== 'abort') console.error(e); }
}

// ---------------------------------------------------------------- loop
const clock = new THREE.Clock();
let totemAcc = 0;
function step(dt) {
  vt += dt;
  flushWaiters();
  airport.update(dt, vt);
  land.update(dt); land.setLightning(airport.lightning.level);
  totemAcc += dt; if (totemAcc > 1 / 30) { totem.update(totemAcc); totemAcc = 0; }
  updateActors(dt);
  updateCamera();
  grade.uniforms.uTime.value = vt % 100;
  grade.uniforms.uFlash.value = airport.lightning.level;
  if (airport.plane) airport.plane.beacon.visible = (vt % 1.2) < 0.12;
}
function render() { composer.render(); }

// ---------------------------------------------------------------- boot
async function boot() {
  $('loading').textContent = 'Carregando personagens…';
  audioBuffers.murmur = await loadBuffer('./audio/murmur.mp3');
  const RT = { Neck: { z: -0.01, rx: 0.02 }, Neck1: { z: -0.01, rx: 0.02 }, Neck2: { z: -0.01, rx: 0.02 }, LeftShoulder: { rz: -0.3 }, RightShoulder: { rz: 0.3 }, scaleToEyesLevel: 1.0, origin: { y: -0.1 } };
  const BL = { headRotateX: -0.04, eyeBlinkLeft: 0, eyeBlinkRight: 0, eyeWideLeft: 0.4, eyeWideRight: 0.4 };
  const mk = (name, pos, yaw, mood = 'neutral') => makeActor({ name, pos, yaw, avatar: { url: AV_DIR + 'avatarsdk', body: 'M', avatarMood: mood, retarget: RT, baseline: BL } });
  [prof, att, diniz, leo, motti, sa, kauai, zuma, lopo] = await Promise.all([
    mk('prof', V(8.5, 0, 9.2), -2.1), mk('att', ATT_POS, ATT_YAW, 'happy'), mk('diniz', V(8, 0, 23), -Math.PI / 2),
    mk('leo', V(10, 0, 14), 0), mk('motti', V(2.15, 0, 11), Math.PI / 2, 'happy'), mk('sa', V(2.15, 0, 12), Math.PI / 2, 'happy'),
    mk('kauai', V(0, 0, -204), 0, 'happy'), mk('zuma', V(1, 0, -206), 0, 'happy'), mk('lopo', V(-1, 0, -199), Math.PI, 'happy'),
  ]);
  Object.assign(ACT, { prof, att, diniz, leo, motti, sa, kauai, zuma, lopo });
  actors.push(prof, att, diniz, leo, motti, sa, kauai, zuma, lopo);
  for (let i = 0; i < 20; i++) for (const a of actors) { a.arm.position.copy(a.pos); a.arm.rotation.y = a.yaw; a.head.animate(16); }
  for (const a of actors) { a.arm.updateMatrixWorld(true); a.look.calibrate(); }
  att.arm.scale.setScalar(0.97);
  // professor's shirt: plain navy, no logo
  const tex = async (u) => { const t = await new THREE.TextureLoader().loadAsync(u); t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; return t; };
  const [shirt, headTex, aShirt, aHead, aJeans, dHead, dShirt, lHead, lShirt, mHead, sHead, stShirt] = await Promise.all(['prof_shirt', 'prof_head', 'att_shirt', 'att_head', 'att_jeans', 'diniz_head', 'diniz_shirt', 'leo_head', 'leo_shirt', 'motti_head', 'sa_head', 'staff_shirt'].map((n) => tex('./avatars/' + n + '.jpg')));
  const restyle = (arm, maps) => arm.traverse((o) => {
    if (!o.isMesh || !maps[o.material?.name]) return;
    o.material = o.material.clone(); o.material.map = maps[o.material.name]; o.material.needsUpdate = true;
  });
  restyle(prof.arm, { outfit_top: shirt, AvatarHead: headTex });
  restyle(att.arm, { outfit_top: aShirt, AvatarHead: aHead, outfit_bottom: aJeans });
  restyle(diniz.arm, { outfit_top: dShirt, AvatarHead: dHead });
  restyle(leo.arm, { outfit_top: lShirt, AvatarHead: lHead });
  restyle(motti.arm, { outfit_top: stShirt, AvatarHead: mHead });
  // brown eyes for the group members whose photos we have
  { const eb = await tex('./avatars/eyes_brown.jpg'); for (const a of [prof, att, diniz, motti, sa, kauai, zuma, lopo]) restyle(a.arm, { AvatarLeftEyeball: eb, AvatarRightEyeball: eb }); }
  restyle(sa.arm, { outfit_top: stShirt, AvatarHead: sHead });
  // Sá and Soussa are tanned: match hands/arms (body texture) to their faces
  for (const [a, c] of [[sa, [0.88, 0.76, 0.66]], [prof, [0.9, 0.8, 0.72]]]) a.arm.traverse((o) => { if (o.isMesh && o.material?.name === 'AvatarBody') { o.material = o.material.clone(); o.material.color.setRGB(...c); } });
  {
    const [kH, zH, lH] = await Promise.all(['kauai_head', 'zuma_head', 'lopo_head'].map((n) => tex('./avatars/' + n + '.jpg')));
    const flip = (t) => { t.flipY = false; return t; };
    restyle(kauai.arm, { AvatarHead: kH, outfit_top: flip(plainShirt('#c8b48e', 0.08)) });
    restyle(zuma.arm, { AvatarHead: zH, outfit_top: flip(printShirt()) });
    restyle(lopo.arm, { AvatarHead: lH, outfit_top: flip(plainShirt('#d6d4cd', 0.05)) });
    for (const [a, c] of [[zuma, [0.72, 0.58, 0.48]], [kauai, [0.84, 0.72, 0.62]]]) a.arm.traverse((o) => { if (o.isMesh && o.material?.name === 'AvatarBody') { o.material = o.material.clone(); o.material.color.setRGB(...c); } });
  }
  setupWet(prof); wetHeadTex = await tex('./avatars/prof_head_wet.jpg');
  setWorld('airport');
  diniz.arm.scale.setScalar(1.0); leo.arm.scale.setScalar(0.99); motti.arm.scale.setScalar(1.02); sa.arm.scale.setScalar(0.995);
  // accessories: Diniz's glasses, staff badges
  for (const a of [motti, sa]) { const b = PROPS.badge(); b.position.set(-0.09, 0.08, 0.13); b.rotation.y = 0; a.bone('Spine2').add(b); }
  // attendant: loose short-sleeve shirt (sleeve below mid upper arm painted as skin) and bell-bottom jeans
  att.arm.updateMatrixWorld(true);
  att.arm.traverse((o) => {
    if (!o.isMesh) return;
    const name = o.material?.name;
    if (name !== 'outfit_top' && name !== 'outfit_bottom') return;
    o.geometry = o.geometry.clone();
    const geo = o.geometry, pos = geo.attributes.position, nor = geo.attributes.normal;
    geo.computeBoundingBox(); const bb = geo.boundingBox, h = bb.max.y - bb.min.y;
    const unit = h > 10 ? 100 : 1;
    let armV = null;
    if (name === 'outfit_top' && o.isSkinnedMesh) {
      const bones = o.skeleton.bones, binds = o.skeleton.boneInverses.map((m) => new THREE.Vector3().setFromMatrixPosition(m.clone().invert()));
      const bi = (n) => bones.findIndex((bn) => bn.name === n);
      const sides = ['Left', 'Right'].map((sd) => ({ arm: bi(sd + 'Arm'), fore: bi(sd + 'ForeArm'), lower: new Set(bones.map((bn, k) => (bn.name.startsWith(sd + 'ForeArm') || bn.name.startsWith(sd + 'Hand') ? k : -1)).filter((k) => k >= 0)) }));
      const si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight, v = new THREE.Vector3();
      armV = new Uint8Array(pos.count); // 1 = sleeve (no inflation), 2 = bare arm (painted skin)
      for (let i = 0; i < pos.count; i++) {
        let best = -1, bw = 0; for (let j = 0; j < 4; j++) { const w = sw.getComponent(i, j); if (w > bw) { bw = w; best = si.getComponent(i, j); } }
        for (const sd of sides) {
          if (sd.lower.has(best)) armV[i] = 2;
          else if (best === sd.arm) {
            v.fromBufferAttribute(pos, i).applyMatrix4(o.bindMatrix);
            const s0 = binds[sd.arm], d = binds[sd.fore].clone().sub(s0);
            armV[i] = v.sub(s0).dot(d) / d.lengthSq() > 0.42 ? 2 : 1;
          }
        }
      }
      // paint the bare-arm triangles with skin in UV space, and a darker hem where the sleeve ends
      const img = o.material.map.image, cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
      const g2 = cv.getContext('2d'); g2.drawImage(img, 0, 0);
      const uv = geo.attributes.uv, idx = geo.index.array, W2 = cv.width, H2 = cv.height;
      const tri = (t, fill, grow) => { g2.beginPath(); for (let k = 0; k < 3; k++) { const q = idx[t + k]; const x = uv.getX(q) * W2, y = uv.getY(q) * H2; k ? g2.lineTo(x, y) : g2.moveTo(x, y); } g2.closePath(); g2.fillStyle = fill; g2.fill(); if (grow) { g2.strokeStyle = fill; g2.lineWidth = grow; g2.stroke(); } };
      for (let t = 0; t < idx.length; t += 3) { const c = (armV[idx[t]] === 2) + (armV[idx[t + 1]] === 2) + (armV[idx[t + 2]] === 2); if (c === 3) tri(t, '#cf9e86', 3); }
      for (let t = 0; t < idx.length; t += 3) { const c = (armV[idx[t]] === 2) + (armV[idx[t + 1]] === 2) + (armV[idx[t + 2]] === 2); if (c === 1 || c === 2) tri(t, '#9c6c1f', 1); }
      const nt = new THREE.CanvasTexture(cv); nt.flipY = false; nt.colorSpace = THREE.SRGBColorSpace; nt.anisotropy = 8;
      o.material.map = nt; o.material.needsUpdate = true;
    }
    for (let i = 0; i < pos.count; i++) {
      let k = 0;
      if (name === 'outfit_top') k = armV && armV[i] ? (armV[i] === 1 ? 0.006 : 0) : 0.012;
      else { const knee = bb.min.y + h * 0.42, y = pos.getY(i); if (y < knee) { const t = (knee - y) / (knee - bb.min.y); k = 0.075 * t * t; } }
      if (!k) continue;
      const nx = nor.getX(i), ny = name === 'outfit_top' ? nor.getY(i) : 0, nz = nor.getZ(i);
      pos.setXYZ(i, pos.getX(i) + nx * k * unit, pos.getY(i) + ny * k * unit, pos.getZ(i) + nz * k * unit);
    }
    pos.needsUpdate = true; geo.computeBoundingSphere();
  });
  $('loading').textContent = 'Carregando animações…';
  await preloadAnims(prof, ['walk', 'talk1', 'talk2', 'idle']);
  await preloadAnims(att, ['walk', 'talk0', 'talk2', 'idle', 'laugh']);
  await preloadAnims(diniz, ['walk', 'talk0']);
  await preloadAnims(leo, ['walk', 'talk1', 'idle']);
  await preloadAnims(motti, ['walk', 'talk0', 'idle', 'laugh']);
  await preloadAnims(sa, ['walk', 'talk1', 'talk2', 'idle', 'laugh']);
  await preloadAnims(lopo, ['walk']);
  for (const a of [kauai, zuma]) a.seated = true;
  for (const a of [kauai, zuma, prof]) a.look.maxUp = 0.6;
  // everyone but the driver breathes and shifts weight when standing still (out of phase with each other)
  if (!Q.has('noidle')) [prof, att, leo, motti, sa].forEach((a, i) => { a.idleOK = true; a.idlePhase = (i * 0.37) % 1; });
  diniz.head.playPose('sitting', null, 1e6);
  for (const n of ['rain_out', 'door', 'buzz', 'squeak', 'carDoor', 'thud', 'chime', 'an1', 'cabin_hum', 'doorclose', 'lopo_music']) audioBuffers['sfx_' + n] = await loadBuffer('./audio/' + n + '.mp3');
  for (const id of Object.keys(LINES)) audioBuffers[id] = (await loadBuffer('./audio/' + LINES[id].audio)) || (await loadBuffer('./audio/' + LINES[id].audio.replace(/\.mp3$/, '.wav')));
  const got = Object.keys(LINES).filter((k) => audioBuffers[k]).length;
  $('audiostatus').textContent = got ? `${got}/${Object.keys(LINES).length} falas com áudio gravado` : 'Vozes: sintetizadas pelo navegador (placeholder)';

  if (EXPORT) {
    $('loading').style.display = 'none'; document.querySelectorAll('.bar').forEach((b) => (b.style.display = 'none')); $('ui').style.display = 'none';
    master.gain.value = 0; await audioCtx.resume().catch(() => {});
    const FPS = +(Q.get('fps') || 30);
    window.__frame = () => { step(1 / FPS); render(); return renderer.domElement.toDataURL('image/jpeg', 0.92); };
    resetWorld(); run(START_SCENE); window.__ready = true; return;
  }
  if (SIM) {
    $('loading').style.display = 'none'; document.querySelectorAll('.bar').forEach((b) => (b.style.display = Q.has('bars') ? '' : 'none'));
    resetWorld(); runPreview(); return;
  }
  $('loading').style.display = 'none'; $('start').classList.add('on');
  // idle preview behind the start screen
  resetWorld();
  cut({ p0: V(5.5, 2.2, 7.5), p1: V(4.5, 2.0, 6), l0: V(-1, 1.6, 0), dur: 30, fov: 34 });
  renderer.setAnimationLoop(() => { const dt = Math.min(0.05, clock.getDelta()); step(dt); render(); });
}

async function runPreview() {
  // headless: run the requested scene in simulated time and render one frame
  run(START_SCENE);
  const dt = 1 / 30; let n = 0;
  while (vt < SIM_AT) { step(dt); n++; await new Promise((r) => setTimeout(r, 0)); }
  if (Q.has('face')) { const a = ACT[Q.get('face')] || prof; const h = a.headPos(); const fw = V(Math.sin(a.yaw), 0, Math.cos(a.yaw)); camera.fov = 14; camera.updateProjectionMatrix(); camera.position.copy(h).addScaledVector(fw, 1.1).add(V(0, -0.02, 0)); camera.lookAt(h.add(V(0, -0.04, 0))); shot = null; if (bokeh) bokeh.uniforms.focus.value = 1.1; }
  const bodyCam = () => { if (!Q.has('body')) return; const a = ACT[Q.get('body')] || prof; const ang = a.yaw + (+Q.get('ang') || 0); const h = a.pos.clone().add(V(0, 1.25, 0)); camera.fov = 30; camera.updateProjectionMatrix(); camera.position.copy(h).addScaledVector(V(Math.sin(ang), 0, Math.cos(ang)), 2.4).add(V(0, 0.15, 0)); camera.lookAt(h); shot = null; if (bokeh) bokeh.uniforms.focus.value = 2.4; };
  if (Q.has('lineup')) {
    const who = (Q.get('lineup') || 'prof,att,leo,motti,sa').split(',').map((k) => ACT[k]);
    who.forEach((a, i) => { a.walk = null; a.seated = Q.has('chair'); a.pos.set(3 + i * 1.0, Q.has('chair') ? -CH.drop + 0.45 : 0, 6.5); a.yaw = a.yawGoal = +(Q.get('ang') || 0); a.look.goal = 0; });
    state.suitMode = 'hidden'; suit.position.set(0, -5, 0); state.phone = false;
    for (let i = 0; i < 20; i++) step(dt);
    const cx = 3 + (who.length - 1) * 0.5, d = +(Q.get('d') || 4.2), y = +(Q.get('y') || 1.0);
    camera.fov = 30; camera.updateProjectionMatrix(); camera.position.set(cx, y + 0.25, 6.5 + d); camera.lookAt(cx, y, 6.5); shot = null; if (bokeh) bokeh.uniforms.focus.value = d;
  }
  bodyCam(); step(dt); bodyCam(); if (Q.has('lineup')) { const cx = 3 + ((Q.get('lineup') || 'prof,att,leo,motti,sa').split(',').length - 1) * 0.5, d = +(Q.get('d') || 4.2), y = +(Q.get('y') || 1.0); camera.position.set(cx, y + 0.25, 6.5 + d); camera.lookAt(cx, y, 6.5); } if (Q.has('face')) { const a = ACT[Q.get('face')] || prof; const h = a.headPos(); const fw = V(Math.sin(a.yaw), 0, Math.cos(a.yaw)); camera.position.copy(h).addScaledVector(fw, 1.1); camera.lookAt(h.add(V(0, -0.04, 0))); } render();
  const f = (v) => v.toArray().map((x) => x.toFixed(2)).join(',');
  console.log('DBG ikR', prof.ikR.weight.toFixed(2), prof.ikR.goal, prof.ikR.auto, 'target', f(prof.ikR.target), 'hand', f(prof.bone('RightHand').getWorldPosition(new THREE.Vector3())), 'phone', phone.visible, f(phone.position), 'typing', state.typing);
  { const K = kauai.look; console.log('DBG klook', K.target && (K.target.isVector3 ? 'vec' : K.target.name), 'w', K.weight.toFixed(2), 'goal', K.goal, 'cur', K.cur && f(K.cur), 'khead', f(kauai.headPos()), 'maxUp', K.maxUp); }
  { const L = prof.look; console.log('DBG look', L.target && (L.target.isVector3 ? 'vec ' + f(L.target) : L.target.name), 'w', L.weight.toFixed(2), 'cur', L.cur && f(L.cur), 'head', f(prof.headPos()), 'cam', f(camera.position), 'yaw', prof.yaw.toFixed(2), 'seated', !!prof.seated); }
  console.log('DBG pose', prof.head.poseName, JSON.stringify(Object.keys(prof.head.poseCurrentTemplate||{})), prof.head.poseCurrentTemplate===prof.head.poseTemplates.sitting, 'mixer', !!prof.head.mixer);
  console.log('DBG prof pos', f(prof.pos), 'yaw', prof.yaw.toFixed(2), 'head', f(prof.headPos()), 'hips', f(prof.bone('Hips').getWorldPosition(new THREE.Vector3())), '| att head', f(att.headPos()), 'cam', f(camera.position));
  window.__ready = true;
}

$('start').addEventListener('click', async () => {
  await audioCtx.resume(); ambience();
  $('start').classList.remove('on'); $('ui').classList.add('playing');
  run(START_SCENE);
});
$('btn-restart').onclick = () => { $('controls').classList.remove('on'); run(1); };
$('btn-subs').onclick = (e) => { subtitlesOn = !subtitlesOn; e.target.textContent = subtitlesOn ? 'Legendas: on' : 'Legendas: off'; if (!subtitlesOn) showSub(null); };
$('btn-full').onclick = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen());
addEventListener('keydown', (e) => { if (e.key === 'f') $('btn-full').click(); if (e.key === 'r') $('btn-restart').click(); if (e.key === 'h') $('ui').classList.toggle('hide'); });

boot().catch((e) => { $('loading').textContent = 'Erro: ' + e.message; console.error(e); window.__ready = true; });
