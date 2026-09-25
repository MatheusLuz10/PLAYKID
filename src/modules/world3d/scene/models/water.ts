/** 💧 Área da água: vegetação de margem, lago, pequeno ponto de água e rio. */
import * as THREE from 'three';
import { heightAt } from '../terrain';
import { MAT, mesh, ripple, rng, solid, stoneRing, waterDisc, waterMaterial } from './common';

/** Taboas e juncos na beira da água. */
function riverbank(): THREE.Group {
  const g = new THREE.Group();
  const mud = mesh(new THREE.CircleGeometry(1.3, 24), MAT.soilWet, 0, 0.04, 0);
  mud.rotation.x = -Math.PI / 2;
  g.add(mud);
  const reeds = new THREE.Group();
  const rand = rng(8);
  const reed = solid(0x6f8f3a);
  const cattail = solid(0x6b4426, { roughness: 1 });
  for (let i = 0; i < 26; i++) {
    const h = 0.9 + rand() * 0.9;
    const x = (rand() - 0.5) * 2;
    const z = (rand() - 0.5) * 1.6;
    const stalk = mesh(new THREE.CylinderGeometry(0.012, 0.025, h, 5), reed, x, h / 2, z);
    stalk.rotation.set((rand() - 0.5) * 0.25, 0, (rand() - 0.5) * 0.25);
    reeds.add(stalk);
    if (rand() < 0.45) {
      const head = mesh(new THREE.CapsuleGeometry(0.045, 0.2, 4, 8), cattail, x + stalk.rotation.z * -h * 0.5, h * 0.92, z + stalk.rotation.x * h * 0.5);
      reeds.add(head);
    }
  }
  // folhas longas e finas
  for (let i = 0; i < 14; i++) {
    const blade = mesh(new THREE.ConeGeometry(0.05, 1.1, 4), solid(0x7fa845), (rand() - 0.5) * 2.2, 0.5, (rand() - 0.5) * 1.8);
    blade.rotation.set((rand() - 0.5) * 0.7, rand() * 3, (rand() - 0.5) * 0.7);
    reeds.add(blade);
  }
  reeds.userData.sway = true;
  g.add(reeds);
  return g;
}

/** Lago com contorno de pedras, vitórias-régias e ondinhas. */
function pond(): THREE.Group {
  const g = new THREE.Group();
  const bank = mesh(new THREE.CircleGeometry(3.2, 40), MAT.soilWet, 0, 0.03, 0);
  bank.rotation.x = -Math.PI / 2;
  bank.scale.set(1.25, 1, 1);
  g.add(bank);
  const water = waterDisc(2.8, 3, 1.25);
  water.position.y = 0.09;
  g.add(water);
  g.add(stoneRing(2.95, 26, 0.16, 1.25));
  const rand = rng(17);
  for (let i = 0; i < 6; i++) {
    const pad = mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.02, 16, 1, false, 0.4, Math.PI * 2 - 0.4), solid(0x3f8a3a), (rand() - 0.5) * 3.8, 0.12, (rand() - 0.5) * 2.8);
    pad.rotation.y = rand() * Math.PI * 2;
    g.add(pad);
    if (i % 2 === 0) {
      const lotus = new THREE.Group();
      for (let p = 0; p < 7; p++) {
        const petal = mesh(new THREE.SphereGeometry(0.08, 8, 5), solid(0xf7a8c4), Math.cos(p) * 0.06, 0.05, Math.sin(p) * 0.06);
        petal.scale.set(0.6, 1, 0.6);
        petal.rotation.set(Math.sin(p) * 0.6, 0, Math.cos(p) * 0.6);
        lotus.add(petal);
      }
      lotus.position.set(pad.position.x, 0.14, pad.position.z);
      g.add(lotus);
    }
  }
  for (let i = 0; i < 3; i++) {
    const r = ripple(1.2 + i * 0.4, i * 1.3);
    r.position.set(-0.8 + i * 0.8, 0.13, -0.4 + i * 0.4);
    g.add(r);
  }
  return g;
}

/** Pequena nascente: água saindo entre pedras, com uma poça limpa. */
function spring(): THREE.Group {
  const g = new THREE.Group();
  const water = waterDisc(0.85, 9);
  water.position.y = 0.08;
  g.add(water);
  g.add(stoneRing(0.95, 14, 0.14));
  const rock = mesh(new THREE.DodecahedronGeometry(0.45, 1), MAT.stone, -0.7, 0.3, -0.5);
  rock.scale.set(1.2, 0.8, 1);
  g.add(rock);
  // filete de água descendo da pedra
  const trickle = mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.4, 8), waterMaterial(), -0.45, 0.28, -0.3);
  trickle.rotation.z = 0.5;
  g.add(trickle);
  const r = ripple(0.6, 0);
  r.position.set(-0.3, 0.11, -0.2);
  g.add(r);
  // plantinhas em volta
  for (let i = 0; i < 5; i++) {
    const a = i * 1.3;
    const fern = mesh(new THREE.ConeGeometry(0.12, 0.45, 5), solid(0x5e9a3a), Math.cos(a) * 1.15, 0.22, Math.sin(a) * 1.15);
    fern.userData.sway = true;
    g.add(fern);
  }
  return g;
}

/**
 * Rio (item raro): corre pela borda da área da água, da colina do fundo até a
 * frente, com margens de terra e pedras. O grupo fica no ponto do item, e a
 * geometria acompanha o relevo em coordenadas do mundo.
 */
function river(origin: THREE.Vector3): THREE.Group {
  const g = new THREE.Group();
  g.userData.noRotate = true; // segue o relevo em coordenadas do mundo
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1, 0, -14),
    new THREE.Vector3(1.5, 0, -8),
    new THREE.Vector3(-0.5, 0, -2),
    new THREE.Vector3(1, 0, 4),
    new THREE.Vector3(-1.5, 0, 10),
    new THREE.Vector3(0, 0, 16),
  ]);
  const points = curve.getSpacedPoints(140);
  const ribbon = (width: number, lift: number, mat: THREE.Material) => {
    const verts: number[] = [];
    const index: number[] = [];
    const uv: number[] = [];
    points.forEach((p, i) => {
      const next = points[Math.min(points.length - 1, i + 1)];
      const prev = points[Math.max(0, i - 1)];
      const dir = next.clone().sub(prev).normalize();
      const side = new THREE.Vector3(-dir.z, 0, dir.x);
      for (const [k, s] of [
        [0, -1],
        [0.5, 0],
        [1, 1],
      ]) {
        const x = p.x + side.x * width * s;
        const z = p.z + side.z * width * s;
        const y = heightAt(origin.x + x, origin.z + z) - origin.y + lift;
        verts.push(x, y, z);
        uv.push(k, i / points.length);
      }
      if (i < points.length - 1) {
        const a = i * 3;
        // triângulos virados para cima (normal +Y)
        index.push(a, a + 1, a + 3, a + 1, a + 4, a + 3, a + 1, a + 2, a + 4, a + 2, a + 5, a + 4);
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(index);
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, mat);
  };
  const banks = ribbon(1.9, 0.07, new THREE.MeshStandardMaterial({ color: 0x6a5238, roughness: 1, side: THREE.DoubleSide }));
  banks.receiveShadow = true;
  g.add(banks);
  const water = ribbon(1.35, 0.2, waterMaterial());
  water.userData.noShadow = true;
  g.add(water);
  // sem grama atravessando o leito do rio (coordenadas do mundo)
  g.userData.avoid = points.filter((_, i) => i % 4 === 0).map((p) => ({ x: origin.x + p.x, z: origin.z + p.z, r: 2.1 }));
  const rand = rng(41);
  for (let i = 4; i < points.length; i += 9) {
    const p = points[i];
    const side = rand() < 0.5 ? -1 : 1;
    const s = mesh(new THREE.DodecahedronGeometry(0.18 + rand() * 0.2, 0), MAT.stone, p.x + side * (1.6 + rand() * 0.4), 0, p.z);
    s.position.y = heightAt(origin.x + s.position.x, origin.z + s.position.z) - origin.y + 0.1;
    g.add(s);
  }
  return g;
}

export const waterModels: Record<string, (origin: THREE.Vector3) => THREE.Group> = {
  riverbank,
  pond,
  water_basic: spring,
  river,
};
