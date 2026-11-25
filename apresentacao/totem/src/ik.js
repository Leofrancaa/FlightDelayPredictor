import * as THREE from 'three';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion();
const _wq = new THREE.Quaternion(), _pq = new THREE.Quaternion();

// Rotate `bone` (in world space) by quaternion q, keeping its parent.
function rotateWorld(bone, q) {
  bone.getWorldQuaternion(_wq);
  bone.parent.getWorldQuaternion(_pq);
  const nw = q.clone().multiply(_wq);
  bone.quaternion.copy(_pq.invert().multiply(nw));
  bone.updateMatrixWorld(true);
}

/**
 * Two-bone IK (upper arm, fore arm, hand) with a pole direction, blended by weight.
 * Runs after the animation system so it overrides the pose for this frame.
 */
export class ArmIK {
  constructor(armature, side /* 'Left' | 'Right' */) {
    const find = (n) => armature.getObjectByName(n);
    this.upper = find(side + 'Arm');
    this.fore = find(side + 'ForeArm');
    this.hand = find(side + 'Hand');
    this.target = new THREE.Vector3();
    this.pole = new THREE.Vector3(side === 'Left' ? 0.6 : -0.6, -1, -0.4); // in armature space
    this.armature = armature;
    this.weight = 0; this.goal = 0; this.speed = 4;
    this.ok = !!(this.upper && this.fore && this.hand);
  }
  set(target, w = 1) { this.target.copy(target); this.goal = w; }
  release() { this.goal = 0; }
  update(dt) {
    if (!this.ok) return;
    this.weight += (this.goal - this.weight) * Math.min(1, dt * this.speed);
    if (this.weight < 0.002) return;
    const u = this.upper, f = this.fore, h = this.hand;
    const q0u = u.quaternion.clone(), q0f = f.quaternion.clone();
    u.updateMatrixWorld(true);
    u.getWorldPosition(_a); f.getWorldPosition(_b); h.getWorldPosition(_c);
    const l1 = _a.distanceTo(_b), l2 = _b.distanceTo(_c);
    const t = this.target.clone();
    const dist = Math.min(_a.distanceTo(t), (l1 + l2) * 0.999);
    // 1) set elbow angle with law of cosines
    const cur = Math.acos(THREE.MathUtils.clamp(_v1.subVectors(_a, _b).normalize().dot(_v2.subVectors(_c, _b).normalize()), -1, 1));
    const want = Math.acos(THREE.MathUtils.clamp((l1 * l1 + l2 * l2 - dist * dist) / (2 * l1 * l2), -1, 1));
    const axis = new THREE.Vector3().crossVectors(_v1.subVectors(_b, _a), _v2.subVectors(_c, _b));
    if (axis.lengthSq() < 1e-8) {
      // straight arm: bend around a sideways axis
      const pw = this.pole.clone().applyQuaternion(this.armature.quaternion);
      axis.crossVectors(_v1.subVectors(_c, _a), pw);
    }
    axis.normalize();
    _q.setFromAxisAngle(axis, -(want - cur));
    rotateWorld(f, _q);
    // 2) aim the chain at target
    h.getWorldPosition(_c);
    _v1.subVectors(_c, _a).normalize(); _v2.subVectors(t, _a).normalize();
    _q.setFromUnitVectors(_v1, _v2); rotateWorld(u, _q);
    // 3) swing elbow toward pole around shoulder->target axis
    f.getWorldPosition(_b);
    const ax = _v2.clone();
    const pw = this.pole.clone().applyQuaternion(this.armature.quaternion).normalize();
    const e = _b.clone().sub(_a); e.sub(ax.clone().multiplyScalar(e.dot(ax)));
    const p = pw.clone().sub(ax.clone().multiplyScalar(pw.dot(ax)));
    if (e.lengthSq() > 1e-8 && p.lengthSq() > 1e-8) {
      e.normalize(); p.normalize();
      let ang = Math.acos(THREE.MathUtils.clamp(e.dot(p), -1, 1));
      if (new THREE.Vector3().crossVectors(e, p).dot(ax) < 0) ang = -ang;
      _q.setFromAxisAngle(ax, ang); rotateWorld(u, _q);
    }
    // blend
    if (this.weight < 0.999) {
      u.quaternion.copy(q0u.slerp(u.quaternion, this.weight));
      f.quaternion.copy(q0f.slerp(f.quaternion, this.weight));
      u.updateMatrixWorld(true);
    }
  }
}

// Procedural head/neck aim (replaces TalkingHead's camera-oriented eye contact)
export class HeadLook {
  constructor(head /* TalkingHead */) {
    this.th = head; this.arm = head.armature;
    this.neck = this.arm.getObjectByName('Neck'); this.headBone = this.arm.getObjectByName('Head');
    this.target = null; this.weight = 0; this.goal = 0; this.max = 0.9; this.offset = new THREE.Vector3();
  }
  calibrate() {
    const aq = this.arm.getWorldQuaternion(new THREE.Quaternion());
    const hq = this.headBone.getWorldQuaternion(new THREE.Quaternion());
    this.localFwd = new THREE.Vector3(0, 0, 1).applyQuaternion(aq).applyQuaternion(hq.invert()).normalize();
  }
  set(t, w = 1) { this.target = t; this.goal = t ? w : 0; }
  clear() { this.goal = 0; }
  update(dt) {
    this.weight += (this.goal - this.weight) * Math.min(1, dt * 3.5);
    if (this.weight < 0.01 || !this.target || !this.neck || !this.headBone) return;
    const raw = this.target.isVector3 ? this.target.clone() : this.target.getWorldPosition(new THREE.Vector3());
    raw.add(this.offset);
    // ease the gaze point toward the target, so a new target turns the head instead of snapping it
    if (!this.cur) this.cur = raw.clone(); else this.cur.lerp(raw, Math.min(1, dt * 4));
    const tgt = this.cur.clone();
    this.arm.updateMatrixWorld(true);
    if (!this.localFwd) {
      // head-local axis that points where the face points (armature +Z at rest)
      const aq = this.arm.getWorldQuaternion(new THREE.Quaternion());
      const hq = this.headBone.getWorldQuaternion(new THREE.Quaternion());
      this.localFwd = new THREE.Vector3(0, 0, 1).applyQuaternion(aq).applyQuaternion(hq.invert()).normalize();
    }
    for (const [bone, share] of [[this.neck, 0.35], [this.headBone, 0.75]]) {
      this.arm.updateMatrixWorld(true);
      const le = this.th.objectLeftEye, re = this.th.objectRightEye;
      const eyes = le && re ? le.getWorldPosition(new THREE.Vector3()).add(re.getWorldPosition(new THREE.Vector3())).multiplyScalar(0.5) : this.headBone.getWorldPosition(new THREE.Vector3());
      const fwd = this.localFwd.clone().applyQuaternion(this.headBone.getWorldQuaternion(new THREE.Quaternion())).normalize();
      const want = tgt.clone().sub(eyes).normalize();
      // yaw about world up, pitch about the face's right axis: no roll
      const Y = new THREE.Vector3(0, 1, 0);
      let yaw = Math.atan2(want.x, want.z) - Math.atan2(fwd.x, fwd.z);
      while (yaw > Math.PI) yaw -= 2 * Math.PI; while (yaw < -Math.PI) yaw += 2 * Math.PI;
      yaw = THREE.MathUtils.clamp(yaw, -1.3, 1.3);
      let pitch = Math.asin(THREE.MathUtils.clamp(want.y, -1, 1)) - Math.asin(THREE.MathUtils.clamp(fwd.y, -1, 1));
      pitch = THREE.MathUtils.clamp(pitch, -0.35, 0.3);
      const k = share * this.weight;
      const qy = new THREE.Quaternion().setFromAxisAngle(Y, yaw * k);
      const f2 = fwd.clone().applyQuaternion(qy);
      const right = new THREE.Vector3().crossVectors(f2, Y).normalize();
      const qp = new THREE.Quaternion().setFromAxisAngle(right, pitch * k);
      const q = qp.multiply(qy);
      rotateWorld(bone, q);
    }
  }
}
