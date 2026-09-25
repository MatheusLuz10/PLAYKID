/**
 * Anima as partes marcadas em `userData` pelos modelos (ver common.ts):
 * vento nas plantas, bichos voando/pulando, asas, cabeça pastando, ondas na água
 * e anéis de destaque. Usada pelo mundo 3D e pela casa (Meu Lugar).
 */
import * as THREE from 'three';

type Orbit = { r: number; h: number; speed: number; cx: number; cz: number; phase: number; figure8?: boolean };

export function animateModel(group: THREE.Object3D, t: number, phase: number) {
  group.traverse((o) => {
    const u = o.userData;
    if (u.sway) {
      o.rotation.z = Math.sin(t * 0.9 + phase) * 0.025;
      o.rotation.x = Math.cos(t * 0.7 + phase) * 0.018;
    }
    if (u.graze) o.rotation.z = -0.25 + Math.sin(t * 0.6 + phase) * 0.25;
    if (u.tail) o.rotation.x = Math.sin(t * 2.2 + phase) * 0.35;
    if (u.pulse) ((o as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.3 + Math.sin(t * 1.8 + phase) * 0.15;
    if (u.orbit) {
      const { r, h, speed, cx, cz, phase: p, figure8 } = u.orbit as Orbit;
      const a = t * speed + p;
      const x = cx + Math.cos(a) * r;
      const z = cz + (figure8 ? Math.sin(a * 2) * r * 0.5 : Math.sin(a) * r);
      o.position.set(x, h + Math.sin(a * 3) * 0.12, z);
      const dx = -Math.sin(a) * r;
      const dz = figure8 ? Math.cos(a * 2) * r : Math.cos(a) * r;
      o.rotation.y = Math.atan2(-dz, dx);
    }
    if (u.flap) {
      const wings = o.children.filter((c) => c.userData.flapSide);
      if (wings.length) for (const w of wings) w.rotation.x = w.userData.flapSide * Math.sin(t * 14 + phase) * 0.9;
      else o.rotation.x = Math.sin(t * 40) * 0.5;
    }
    if (u.hop) {
      const { amp, speed, turn } = u.hop as { amp: number; speed: number; turn?: boolean };
      if (u.baseY === undefined) u.baseY = o.position.y;
      o.position.y = (u.baseY as number) + Math.abs(Math.sin(t * speed + phase)) * amp;
      if (turn) o.rotation.y = Math.sin(t * 0.7 + phase) * 0.8;
    }
    if (u.wiggle !== undefined) o.position.y = Math.sin(t * 5 - (u.wiggle as number) * 0.8) * 0.02;
    if (u.ripple) {
      const { radius, delay } = u.ripple as { radius: number; delay: number };
      const k = ((t + delay) % 3) / 3;
      o.scale.setScalar(0.1 + k * radius);
      ((o as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.35 * (1 - k);
    }
  });
}
