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
import { createTotem } from './totem.js';
import { ArmIK, HeadLook } from './ik.js';
import * as PROPS from './props.js';
import { CFG, LINES } from './config.js';

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
const totem = createTotem(CFG);
scene.add(totem.group);

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
airport.onStrike = () => { const d = 0.5 + Math.random() * 0.8; EVENTS.push({ t: vt + d, type: 'thunder' }); thunder(d); };

// ---------------------------------------------------------------- props
const bag = PROPS.giftBag(); scene.add(bag);
const suit = PROPS.suitcase(); scene.add(suit);
const phone = PROPS.phone(); phone.visible = false; scene.add(phone);
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
const ANIM = { walk: './anim/walking.json', talk0: './anim/Talking_0.json', talk1: './anim/Talking_1.json' };
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
}

let prof, att;
const actors = [];

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

function walkTo(a, pts, speed = WALK_SPEED) {
  return new Promise((res) => {
    a.walk = { pts: pts.map((p) => p.clone()), i: 0, speed, res };
    if (!SIM) a.head.playAnimation(ANIM.walk, null, 120);
    else a.head.playAnimation(ANIM.walk, null, 120);
  });
}
function updateWalk(a, dt) {
  const w = a.walk; if (!w) return;
  const tgt = w.pts[w.i]; const d = tgt.clone().sub(a.pos); d.y = 0;
  const dist = d.length(), step = w.speed * dt;
  if (dist <= step) {
    a.pos.copy(tgt); w.i++;
    if (w.i >= w.pts.length) { a.walk = null; a.head.stopAnimation(); w.res(); return; }
  } else {
    a.pos.add(d.multiplyScalar(step / dist));
    a.yawGoal = Math.atan2(d.x, d.z);
  }
}
function turnTo(a, yaw) { a.yawGoal = yaw; }
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
function showSub(who, text) { const el = $('sub'); if (!subtitlesOn || !text) { el.classList.remove('on'); return; } el.innerHTML = `<span class="who">${who === 'prof' ? 'Soussa' : 'Guis'}</span>${text}`; el.classList.add('on'); }

async function say(id, { gesture = null, anim = null } = {}) {
  const L = LINES[id], a = L.who === 'prof' ? prof : att;
  showSub(L.who, L.text);
  const t0 = vt;
  if (anim && !a.walk) a.head.playAnimation(ANIM[anim], null, 30);
  if (gesture) setTimeout(() => a.head.playGesture(gesture[0], gesture[1] || 2.5, gesture[2] || false), 250);
  let durMs;
  if (SIM) {
    durMs = estimateMs(L.text);
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
    if (ended) { await Promise.race([ended, wait(durMs / 1000 * 2 + 1)]); await wait(0.2); if (anim) a.head.stopAnimation(); showSub(null); return; }
  }
  EVENTS.push({ t: t0, type: 'line', id, who: L.who, text: L.text, dur: durMs / 1000, file: audioBuffers[id] ? L.audio : null });
  await wait(durMs / 1000 + 0.25);
  if (anim) a.head.stopAnimation();
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

// ---------------------------------------------------------------- per-frame actor logic
const hand = new THREE.Vector3(), tmp = new THREE.Vector3();
const state = { suitMode: 'pull', bagHand: 'Left', phone: false, typing: false, passMode: 'hidden', passOwner: null };
const suitWheel = new THREE.Vector3(6, 0, 9);

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

function updateProps(dt) {
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
  } else if (state.suitMode === 'parked') {
    const want = prof.pos.clone().addScaledVector(right, 0.45).addScaledVector(fwd, -0.05);
    suit.position.lerp(V(want.x, 0, want.z), Math.min(1, dt * 3));
    suit.quaternion.slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, prof.yaw, 0)), Math.min(1, dt * 3));
    suitWheel.copy(suit.position);
  }
  // phone in prof right hand
  phone.visible = state.phone;
  if (state.phone) {
    gripPoint(prof, 'Right', hand);
    const face = prof.headPos();
    phone.position.copy(hand).add(face.clone().sub(hand).normalize().multiplyScalar(0.035));
    phone.lookAt(face);
    M_PHONE.position.copy(phone.position);
  }
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
    updateWalk(a, dt);
    a.yaw = angleLerp(a.yaw, a.yawGoal, Math.min(1, dt * 5));
    a.arm.position.copy(a.pos); a.arm.rotation.y = a.yaw;
    a.head.animate(dt * 1000);
    a.arm.updateMatrixWorld(true);
  }
  // procedural targets
  if (state.typing && prof.ikR) {
    const fwd = V(Math.sin(prof.yaw), 0, Math.cos(prof.yaw)), right = V(-Math.cos(prof.yaw), 0, Math.sin(prof.yaw));
    const p = prof.pos.clone().addScaledVector(fwd, 0.3).addScaledVector(right, 0.04); p.y = 1.27 + Math.sin(vt * 9) * 0.004;
    prof.ikR.set(p, 1);
  }
  for (const a of actors) { guardArms(a); a.look.update(dt); a.ikL.update(dt); a.ikR.update(dt); }
  updateProps(dt);
}

// ---------------------------------------------------------------- scenes
function setTotem(s) { totem.setState(s); }
function resetWorld() {
  prof.pos.set(8.5, 0, 9.2); prof.yaw = prof.yawGoal = -2.1; prof.walk = null; prof.head.stopAnimation();
  att.pos.copy(ATT_POS); att.yaw = att.yawGoal = ATT_YAW;
  state.suitMode = 'pull'; state.phone = false; state.typing = false; state.passMode = 'hidden'; state.passOwner = null;
  [prof, att].forEach((a) => { a.ikL.weight = a.ikL.goal = 0; a.ikR.weight = a.ikR.goal = 0; a.look.weight = a.look.goal = 0; a.look.target = null; });
  suitWheel.set(9, 0, 10);
  setTotem('idle'); grade.uniforms.uFade.value = 1; $('endcard').classList.remove('on'); showSub(null);
}
function placeAtKiosk() {
  prof.pos.copy(PROF_STOP); prof.yaw = prof.yawGoal = PROF_YAW; state.suitMode = 'parked';
  const right = V(-Math.cos(PROF_YAW), 0, Math.sin(PROF_YAW));
  suit.position.copy(PROF_STOP).addScaledVector(right, 0.45); suit.quaternion.setFromEuler(new THREE.Euler(0, PROF_YAW, 0));
  look(prof, att.head); look(att, prof.head);
}
// camera framing a horizontal band of the kiosk screen (v = 0 top … 1 bottom)
const screenCam = (v, dist = 1.1, dx = -0.18) => ({ p: () => screenPt(0.5, v).add(V(dx, 0.13 * dist, 0.99 * dist)), l: () => screenPt(0.5, v) });
const screenPt = (u, v) => totem.screen.localToWorld(V((u - 0.5) * 0.54, (0.5 - v) * 0.96, 0.03));

async function scene1() {
  // Establishing: wide, slow push while he walks in
  cut({ p0: V(-3.5, 3.4, 14.5), p1: V(-1.8, 2.3, 12.5), l0: V(3, 1.6, 6), l1: () => prof.headPos().add(V(-1.2, -0.3, -1)), dur: 9, fov: 34, focus: headOf(prof), aperture: 0.0008 });
  const walking = walkTo(prof, [V(5.5, 0, 7.9), V(0.6, 0, 7.3), V(-1.6, 0, 5.6), BOARD_SPOT]);
  await wait(4.6);
  cut({ p0: rel(prof, -1.0, 1.55, 3.4), p1: rel(prof, -0.8, 1.55, 2.6), l0: headOf(prof, -0.3), dur: 6, fov: 30, focus: headOf(prof), smoothPos: true });
  await walking;
  turnTo(prof, -2.6); look(prof, M_BOARD);
  await wait(0.6);
  cut({ p0: () => prof.pos.clone().add(V(-1.7, 1.62, 1.3)), l0: headOf(prof, -0.18), p1: () => prof.pos.clone().add(V(-1.4, 1.62, 1.05)), dur: 8, fov: 28, focus: headOf(prof), aperture: 0.002 });
  await say('p1', { anim: 'talk1' });
  await wait(0.3);
}

async function scene2() {
  look(prof, totem.head);
  cut({ p0: V(3.4, 1.55, 4.2), p1: V(2.6, 1.5, 3.4), l0: () => prof.headPos().add(V(0, -0.35, 0)), dur: 5, fov: 32, focus: headOf(prof), smoothPos: true });
  await walkTo(prof, [V(-0.8, 0, 3.0), V(0.55, 0, 1.55), PROF_STOP], 1.15);
  turnTo(prof, PROF_YAW); state.suitMode = 'parked'; prof.ikR.release();
  look(prof, att.head); look(att, prof.head);
  await wait(0.5);
  // over attendant's shoulder onto the professor
  cut({ p0: rel(att, -0.55, 1.6, -0.45), l0: headOf(prof, -0.08), fov: 30, focus: headOf(prof), aperture: 0.0025 });
    await say('p2', { gesture: ['index', 1.6, true] });
  // reverse: over prof's shoulder onto the attendant
  cut({ p0: rel(prof, 0.55, 1.62, -0.45), l0: headOf(att, -0.08), fov: 30, focus: headOf(att), aperture: 0.0025 });
  await say('a1', { gesture: ['side', 2, true] });
}

async function scene3() {
  // hand-off of the boarding pass (two-shot)
  cut({ p0: V(1.9, 1.45, 2.6), p1: V(1.6, 1.4, 2.2), l0: V(-0.15, 1.15, 0.55), dur: 4, fov: 32, focus: () => V(-0.15, 1.1, 0.7) });
  state.passMode = 'prof'; state.passOwner = prof; state.passHand = 'RightHand';
  const meet = V(-0.2, 1.05, 0.85);
  prof.ikR.set(meet, 1); await wait(1.0);
  att.ikR.set(meet.clone().add(V(-0.04, 0.0, -0.02)), 1); await wait(0.9);
  state.passOwner = att; state.passHand = 'RightHand'; prof.ikR.release();
  att.ikR.set(V(0.0, 0.92, 0.22), 1); await wait(0.9);
  state.passMode = 'hidden'; state.passOwner = null; setTotem('form'); look(att, M_SCREEN); look(prof, M_SCREEN);
  // close on the screen, typing
  { const c0 = screenCam(0.36, 1.25), c1 = screenCam(0.42, 1.1); cut({ p0: c0.p, p1: c1.p, l0: c0.l, l1: c1.l, dur: 5, fov: 30, focus: c1.l, aperture: 0.0008, handheld: 0.003 }); }
  for (let i = 0; i < 4; i++) { att.ikR.set(screenPt(0.6, 0.27 + i * 0.1), 1); await wait(0.45); att.ikR.set(screenPt(0.62, 0.25 + i * 0.1).add(V(0, 0, 0.05)), 1); await wait(0.45); }
  att.ikR.set(screenPt(0.5, 0.67), 1); await wait(0.6); att.ikR.release();
  await wait(2.6);                    // let the filled-in form be read
  setTotem('auto');
  { const c = screenCam(0.55, 1.25); cut({ p0: c.p, l0: c.l, fov: 30, focus: c.l, aperture: 0.0008, handheld: 0.002 }); }
  await wait(6.5);                    // the three live-data cards slide in and stay readable
  // attendant explains, screen glow on her face
  cut({ p0: () => att.pos.clone().add(V(0.95, 1.55, 1.05)), p1: () => att.pos.clone().add(V(0.8, 1.55, 0.9)), l0: headOf(att, -0.08), dur: 6, fov: 30, focus: headOf(att), aperture: 0.0022 });
  look(att, totem.head);
  const sp = say('a2', { gesture: ['index', 2.2, true] });
  await wait(1.2); look(att, prof.head);
  await sp;
  { const c = screenCam(0.55, 1.25); cut({ p0: c.p, l0: c.l, fov: 30, focus: c.l, aperture: 0.0008, handheld: 0.003 }); }
  await wait(3.5);
}

async function scene4() {
  att.ikR.set(screenPt(0.5, 0.78), 1); await wait(0.5); att.ikR.release();
  setTotem('analyzing');
  { const c0 = screenCam(0.5, 1.3), c1 = screenCam(0.38, 1.15); cut({ p0: c0.p, p1: c1.p, l0: c0.l, l1: c1.l, dur: 6, fov: 30, focus: c1.l, aperture: 0.0008, handheld: 0.002 }); }
  await wait(2.8);
  setTotem('result');
  { const c0 = screenCam(0.33, 1.25), c1 = screenCam(0.37, 1.15); cut({ p0: c0.p, p1: c1.p, l0: c0.l, l1: c1.l, dur: 5, fov: 30, focus: c1.l, aperture: 0.0008, handheld: 0.002 }); }
  await wait(7.0);                    // probabilities: bars grow, then hold
  { const c0 = screenCam(0.7, 0.98), c1 = screenCam(0.76, 0.92); cut({ p0: c0.p, p1: c1.p, l0: c0.l, l1: c1.l, dur: 4, fov: 30, focus: c1.l, aperture: 0.0008, handheld: 0.002 }); }
  await wait(6.0);                    // main factors
  // reaction: attendant
  cut({ p0: rel(prof, 0.38, 1.66, -0.62), l0: headOf(att, -0.06), fov: 25, focus: headOf(att), aperture: 0.0028 });
  look(att, prof.head); att.head.setMood('neutral');
  await say('a3');
  cut({ p0: rel(att, -0.38, 1.62, -0.62), l0: headOf(prof, -0.06), fov: 25, focus: headOf(prof), aperture: 0.0028 });
  look(prof, att.head); prof.head.playGesture('shrug', 2);
  await say('p3');
  cut({ p0: () => att.pos.clone().add(V(0.9, 1.5, 1.35)), p1: () => att.pos.clone().add(V(0.75, 1.5, 1.15)), l0: headOf(att, -0.15), dur: 9, fov: 32, focus: headOf(att), aperture: 0.0018 });
  look(prof, att.head);
  const s = say('a4', { anim: 'talk0' });
  await wait(1.5);
  { const c = screenCam(0.76, 0.92); cut({ p0: c.p, l0: c.l, fov: 30, focus: c.l, aperture: 0.0008, handheld: 0.002 }); }
  await wait(5.0);
  cut({ p0: rel(prof, 0.38, 1.66, -0.62), l0: headOf(att, -0.06), fov: 25, focus: headOf(att), aperture: 0.0028 });
  await s;
  att.head.setMood('happy');
}

async function scene5() {
  // prof close-up, looks at the gift
  cut({ p0: rel(prof, 0.5, 1.56, 1.25), p1: rel(prof, 0.42, 1.57, 1.1), l0: headOf(prof, -0.12), dur: 10, fov: 26, focus: headOf(prof), aperture: 0.003 });
  look(prof, M_BAG); await wait(1.6);
  // checks watch (left wrist up)
  const fwd = () => V(Math.sin(prof.yaw), 0, Math.cos(prof.yaw));
  prof.ikL.set(prof.pos.clone().addScaledVector(fwd(), 0.28).add(V(0, 1.12, 0)), 1);
  await wait(1.6); prof.ikL.release();
  look(prof, att.head);
  await say('p4');
  await wait(0.9);       // comic pause
  look(prof, att.head);
  look(prof, camera);
  await say('p5');
  // takes his phone and starts typing
  cut({ p0: rel(prof, -0.3, 1.95, -0.22), p1: rel(prof, -0.27, 1.92, -0.17), l0: () => M_PHONE.position.clone(), dur: 5, fov: 30, focus: () => M_PHONE.position.clone(), aperture: 0.0015 });
  state.phone = true; state.typing = true; look(prof, M_PHONE);
  airport.strikeNow();
  await wait(1.6);
  // fade out
  for (let i = 0; i <= 30; i++) { grade.uniforms.uFade.value = 1 - i / 30; await wait(1.4 / 30); }
}

async function scene6() {
  grade.uniforms.uFade.value = 0;
  $('realcase').innerHTML = `Voo real: ${CFG.flight.airline} ${CFG.flight.code}, ${CFG.flight.origin} → ${CFG.flight.dest}, ${CFG.flight.date}<br>Previsão 1 h antes: ${Math.round(CFG.result.p * 100)}% · ${CFG.result.actual}`;
  EVENTS.push({ t: vt, type: 'end', title: 'Como esse totem funciona?', sub: $('realcase').innerHTML.split('<br>') });
  $('endcard').classList.add('on');
  await wait(6);
}

const SCENES = [scene1, scene2, scene3, scene4, scene5, scene6];
async function run(from = 1) {
  const id = ++runId;
  resetWorld();
  if (from >= 2) {
    // fast-forward state to the start of the requested scene
    placeAtKiosk();
    if (from >= 4) setTotem('auto');
    if (from >= 5) setTotem('result');
  }
  try {
    for (let i = from; i <= SCENES.length; i++) { $('scenelabel').textContent = `Cena ${i}`; EVENTS.push({ t: vt, type: 'scene', n: i }); await SCENES[i - 1](); }
    window.__finished = vt;
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
  [prof, att] = await Promise.all([
    makeActor({ name: 'prof', pos: V(8.5, 0, 9.2), yaw: -2.1, avatar: { url: AV_DIR + 'avatarsdk', body: 'M', avatarMood: 'neutral', retarget: { Neck: { z: -0.01, rx: 0.02 }, Neck1: { z: -0.01, rx: 0.02 }, Neck2: { z: -0.01, rx: 0.02 }, LeftShoulder: { rz: -0.3 }, RightShoulder: { rz: 0.3 }, scaleToEyesLevel: 1.0, origin: { y: -0.1 } }, baseline: { headRotateX: -0.08, eyeBlinkLeft: 0.05, eyeBlinkRight: 0.05 } } }),
    makeActor({ name: 'att', pos: ATT_POS, yaw: ATT_YAW, avatar: { url: AV_DIR + 'avatarsdk', body: 'M', avatarMood: 'happy', retarget: { Neck: { z: -0.01, rx: 0.02 }, Neck1: { z: -0.01, rx: 0.02 }, Neck2: { z: -0.01, rx: 0.02 }, LeftShoulder: { rz: -0.3 }, RightShoulder: { rz: 0.3 }, scaleToEyesLevel: 1.0, origin: { y: -0.1 } }, baseline: { headRotateX: -0.08, eyeBlinkLeft: 0.05, eyeBlinkRight: 0.05 } } }),
  ]);
  actors.push(prof, att);
  for (let i = 0; i < 20; i++) for (const a of actors) { a.arm.position.copy(a.pos); a.arm.rotation.y = a.yaw; a.head.animate(16); }
  for (const a of actors) { a.arm.updateMatrixWorld(true); a.look.calibrate(); }
  att.arm.scale.setScalar(0.97);
  // professor's shirt: plain navy, no logo
  const tex = async (u) => { const t = await new THREE.TextureLoader().loadAsync(u); t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; return t; };
  const [shirt, headTex, aShirt, aHead, aJeans] = await Promise.all(['prof_shirt', 'prof_head', 'att_shirt', 'att_head', 'att_jeans'].map((n) => tex('./avatars/' + n + '.jpg')));
  const restyle = (arm, maps) => arm.traverse((o) => {
    if (!o.isMesh || !maps[o.material?.name]) return;
    o.material = o.material.clone(); o.material.map = maps[o.material.name]; o.material.needsUpdate = true;
  });
  restyle(prof.arm, { outfit_top: shirt, AvatarHead: headTex });
  restyle(att.arm, { outfit_top: aShirt, AvatarHead: aHead, outfit_bottom: aJeans });
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
  await preloadAnims(prof, ['walk', 'talk1']);
  await preloadAnims(att, ['walk', 'talk0']);
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
  while (vt < SIM_AT) { step(dt); if (++n % 30 === 0) await new Promise((r) => setTimeout(r, 0)); }
  step(dt); render();
  const f = (v) => v.toArray().map((x) => x.toFixed(2)).join(',');
  console.log('DBG ikR', prof.ikR.weight.toFixed(2), prof.ikR.goal, prof.ikR.auto, 'target', f(prof.ikR.target), 'hand', f(prof.bone('RightHand').getWorldPosition(new THREE.Vector3())), 'phone', phone.visible, f(phone.position), 'typing', state.typing);
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
