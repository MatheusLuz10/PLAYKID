/** Modelo 3D de cada item do mundo (pelo código do item; se faltar, pelo tipo). */
import * as THREE from 'three';
import { MAT, mesh, shadow } from './common';
import { communityModels } from './community';
import { gardenModels } from './garden';
import { bush, naturalModels } from './natural';
import { pollinatorModels } from './pollinators';
import { waterModels } from './water';

type Builder = (origin: THREE.Vector3) => THREE.Group;

const BY_CODE: Record<string, Builder> = {
  ...naturalModels,
  ...waterModels,
  ...gardenModels,
  ...pollinatorModels,
  ...communityModels,
};

const BY_TYPE: Record<string, Builder> = {
  tree: naturalModels.tree_basic,
  plant: bush,
  flower: naturalModels.flower_basic,
  animal: pollinatorModels.bird,
  water: waterModels.water_basic,
  building: communityModels.solar_panel,
  decoration: communityModels.green_area,
};

export function hasModel(code: string): boolean {
  return code in BY_CODE;
}

/** `origin` é o ponto do item no mundo (o rio usa para acompanhar o relevo). */
export function buildWorldModel(code: string, itemType: string, origin: THREE.Vector3): THREE.Group {
  const build = BY_CODE[code] ?? BY_TYPE[itemType] ?? bush;
  return shadow(build(origin));
}

/** Espaço ainda bloqueado: terra preparada cercada de pedrinhas. */
export function lockedSlot(): THREE.Group {
  const g = new THREE.Group();
  const dirt = mesh(new THREE.CircleGeometry(0.75, 28), new THREE.MeshStandardMaterial({ color: 0x6e5337, roughness: 1 }), 0, 0.05, 0);
  dirt.rotation.x = -Math.PI / 2;
  dirt.receiveShadow = true;
  g.add(dirt);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const s = mesh(new THREE.DodecahedronGeometry(0.09, 0), MAT.stone, Math.cos(a) * 0.82, 0.05, Math.sin(a) * 0.82);
    s.castShadow = true;
    g.add(s);
  }
  return g;
}
