import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import fs from 'fs';
globalThis.self = globalThis; // some loaders reference self
for (const f of process.argv.slice(2)) {
  const buf = fs.readFileSync(f);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const obj = new FBXLoader().parse(ab, '');
  const clip = obj.animations[0];
  const out = f.replace(/\.fbx$/, '.json');
  fs.writeFileSync(out, JSON.stringify(THREE.AnimationClip.toJSON(clip)));
  console.log(out, clip.duration.toFixed(2), clip.tracks.length, (fs.statSync(out).size / 1e6).toFixed(2) + 'MB');
}
