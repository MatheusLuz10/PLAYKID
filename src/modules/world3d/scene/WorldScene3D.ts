/**
 * Mundo ECO QUEST em 3D (three.js puro).
 * - Uma paisagem com as 5 áreas; itens conquistados viram modelos 3D, os
 *   bloqueados aparecem como terra preparada.
 * - Sol com sombras suaves, reflexo do céu na água, névoa, nuvens, grama ao vento.
 * - Câmera: visão geral ou voo até cada área; arrastar gira, roda/pinça aproxima.
 * - Itens novos crescem ao aparecer. Sem movimento (preferência do sistema)
 *   nada anima e a cena só é desenhada quando algo muda.
 * - A casa do jogador (a mesma de "Meu Lugar") fica na frente; tocar nela abre a casa.
 * - Libera a memória da GPU ao sair (dispose).
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PLACE_ITEMS } from '../../place/catalog';
import { buildHouse, HOUSE } from '../../place/scene/house';
import { buildObject } from '../../place/scene/objects';
import { AREA_CODES, HOME, HOME_YARD, HOME_YARD_SCALE, ITEM_OFFSETS, OVERVIEW, OVERVIEW_PORTRAIT, slotToWorld, ZONES, zoneView, type AreaCode } from './layout';
import { animateModel } from './models/animate';
import { waterClock, waterMaterial } from './models/common';
import { buildWorldModel, lockedSlot } from './models';
import {
  buildClouds,
  buildGardenFence,
  buildGrass,
  buildPaths,
  buildRocks,
  buildSky,
  buildTerrain,
  buildWildflowers,
  heightAt,
  staticAvoidance,
  type Circle,
  type Wind,
} from './terrain';

/** 'home' = a casa e o quintal dela, na frente do mundo. */
export type FocusTarget = 'overview' | 'home' | AreaCode;

export interface WorldItemSpec {
  id: string;
  code: string;
  itemType: string;
  area: string;
  label: string;
  owned: boolean;
  isNew: boolean;
  /** Posição do mapa 2D (porcentagem), convertida para a área no terreno 3D. */
  slot: { x: number; y: number };
}

export interface ScreenPin {
  id: string;
  x: number;
  y: number;
  visible: boolean;
}

interface Options {
  reducedMotion: boolean;
  lowPower: boolean;
  onSelect: (id: string) => void;
  onPins: (items: ScreenPin[], areas: ScreenPin[], home: ScreenPin) => void;
  /** Tocou na casa. */
  onHome: () => void;
  /** Tocou num objeto do quintal da casa (código do objeto). */
  onYard?: (code: string) => void;
}

interface ItemEntry {
  group: THREE.Group;
  spec: WorldItemSpec;
  anchorY: number;
  phase: number;
  bornAt: number | null;
}

const GROW_SECONDS = 1.6;

export class WorldScene3D {
  private readonly container: HTMLElement;
  private readonly opts: Options;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private items = new Map<string, ItemEntry>();
  private wind: Wind = { uniforms: { uTime: { value: 0 } } };
  private grass: THREE.InstancedMesh | null = null;
  private clouds: THREE.Group;
  private home: THREE.Group;
  /** Quintal da casa (árvores, bichos, horta, água, banco), no próprio mundo. */
  private yard: THREE.Group;
  private envTarget: THREE.WebGLRenderTarget | null = null;
  /** Os shaders são preparados em segundo plano; só então a cena é desenhada. */
  private ready = false;
  private compiling = false;
  /** Na abertura o mundo aparece em etapas (um grupo por quadro): a preparação dos gráficos se divide e a página não congela. */
  private revealQueue: THREE.Object3D[][] = [];
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private downAt: { x: number; y: number } | null = null;
  private clock = new THREE.Clock();
  private raf = 0;
  private needsRender = true;
  private pinsDirty = true;
  private resizeObserver: ResizeObserver;
  private flight: { from: THREE.Vector3; to: THREE.Vector3; tFrom: THREE.Vector3; tTo: THREE.Vector3; start: number } | null = null;
  private focusTarget: FocusTarget = 'overview';
  private aspect = 1;
  /** Qualidade automática: se o aparelho estiver lento, a resolução da cena baixa. */
  private pixelRatio: number;
  private lastAnimAt = 0;
  private slowFrames = 0;
  private sampledFrames = 0;

  constructor(container: HTMLElement, opts: Options) {
    this.container = container;
    this.opts = opts;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'default' });
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, opts.lowPower ? 1.25 : 2);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // o sol não se move: as sombras só são recalculadas quando os itens mudam
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    const canvas = this.renderer.domElement;
    canvas.className = 'world3d-canvas';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Seu mundo em 3D, com as cinco áreas. Use os botões sobre a cena ou a lista abaixo para ver cada item.');
    container.appendChild(canvas);

    // Céu (o reflexo dele na água é gerado depois que o mundo aparece)
    this.scene.add(buildSky());

    this.scene.fog = new THREE.Fog(0xd9ecf6, 95, 230);
    this.scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x55683a, 0.85));
    const sun = new THREE.DirectionalLight(0xfff0d2, 2.5);
    sun.position.set(30, 45, 22);
    sun.target.position.set(0, 0, -12);
    sun.castShadow = true;
    const size = opts.lowPower ? 1536 : 2048;
    sun.shadow.mapSize.set(size, size);
    const cam = sun.shadow.camera;
    cam.left = -56;
    cam.right = 56;
    cam.top = 40;
    cam.bottom = -40;
    cam.near = 5;
    cam.far = 140;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.04;
    sun.shadow.radius = 3;
    this.scene.add(sun, sun.target);

    // Paisagem
    this.scene.add(buildTerrain(), buildPaths(), buildRocks(), buildGardenFence(), buildWildflowers(opts.lowPower ? 350 : 700));
    this.clouds = buildClouds();
    this.scene.add(this.clouds);
    this.home = buildHome();
    this.scene.add(this.home);
    this.yard = buildYard();
    this.scene.add(this.yard);

    // Câmera
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.3, 700);
    this.camera.position.set(...OVERVIEW.pos);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(...OVERVIEW.target);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = true;
    this.controls.screenSpacePanning = false;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 110;
    this.controls.minPolarAngle = 0.25;
    this.controls.maxPolarAngle = 1.4;
    this.controls.addEventListener('change', () => {
      this.needsRender = true;
      this.pinsDirty = true;
    });
    this.controls.addEventListener('start', () => (this.flight = null));
    this.controls.update();

    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointerup', this.onUp);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.loop();
  }

  setItems(specs: WorldItemSpec[]) {
    for (const { group } of this.items.values()) {
      this.scene.remove(group);
      disposeTree(group);
    }
    this.items.clear();
    const avoid: Circle[] = [...staticAvoidance()];
    const now = this.clock.getElapsedTime();
    specs.forEach((spec, i) => {
      const base = slotToWorld(spec.area, spec.slot);
      const [ox, oz] = ITEM_OFFSETS[spec.code] ?? [0, 0];
      const x = base.x + ox;
      const z = base.z + oz;
      const origin = new THREE.Vector3(x, heightAt(x, z), z);
      const group = spec.owned ? buildWorldModel(spec.code, spec.itemType, origin) : lockedSlot();
      group.position.copy(origin);
      if (!group.userData.noRotate) group.rotation.y = (((i * 67) % 50) - 25) * (Math.PI / 180);
      group.userData.itemId = spec.id;
      const box = new THREE.Box3().setFromObject(group);
      const size = box.getSize(new THREE.Vector3());
      if (group.userData.avoid) avoid.push(...(group.userData.avoid as Circle[]));
      else if (spec.owned) avoid.push({ x, z, r: Math.max(0.6, Math.min(size.x, size.z) * 0.45) });
      const grow = spec.owned && spec.isNew && !this.opts.reducedMotion;
      if (grow) group.scale.setScalar(0.001);
      this.scene.add(group);
      this.items.set(spec.id, {
        group,
        spec,
        anchorY: THREE.MathUtils.clamp(box.max.y - origin.y, 0.9, 7),
        phase: i * 1.7,
        bornAt: grow ? now + 0.6 : null,
      });
    });
    // grama refeita sem atravessar canteiros, lagos e construções
    if (this.grass) {
      this.scene.remove(this.grass);
      this.grass.geometry.dispose();
      (this.grass.material as THREE.Material).dispose();
    }
    this.grass = buildGrass(this.opts.lowPower ? 9000 : 22000, avoid, this.wind);
    this.scene.add(this.grass);
    if (!this.ready) {
      // primeira abertura: terreno primeiro, depois grama e uma área por vez
      const groups = [...this.items.values()];
      for (const o of [this.grass, ...groups.map((g) => g.group)]) o.visible = false;
      this.revealQueue = [[this.grass], ...AREA_CODES.map((code) => groups.filter((g) => g.spec.area === code).map((g) => g.group))];
      const other = groups.filter((g) => !AREA_CODES.includes(g.spec.area as AreaCode)).map((g) => g.group);
      if (other.length) this.revealQueue.push(other);
    }
    this.renderer.shadowMap.needsUpdate = true;
    this.needsRender = true;
    this.pinsDirty = true;
    this.prepare();
  }

  /**
   * Prepara os shaders sem travar a página (compilação paralela quando o navegador
   * permite) e só então libera o desenho. Depois gera o reflexo do céu na água.
   */
  private prepare() {
    if (this.compiling) return;
    this.compiling = true;
    const done = () => {
      this.compiling = false;
      this.needsRender = true;
      if (!this.ready) {
        this.ready = true;
        window.setTimeout(() => this.buildReflections(), 1200);
      }
    };
    this.renderer.compileAsync(this.scene, this.camera).then(done, done);
  }

  private buildReflections() {
    if (this.envTarget) return;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const skyScene = new THREE.Scene();
    skyScene.add(buildSky());
    this.envTarget = pmrem.fromScene(skyScene, 0, 0.1, 400, { size: 64 });
    disposeTree(skyScene);
    pmrem.dispose();
    // só a água (e o que usa o mesmo material) reflete o céu: os demais materiais não mudam
    const water = waterMaterial();
    water.envMap = this.envTarget.texture;
    water.envMapIntensity = 1.2;
    water.needsUpdate = true;
    this.needsRender = true;
  }

  get focus(): FocusTarget {
    return this.focusTarget;
  }

  /** Voa até uma área (ou volta para a visão geral). */
  focusOn(target: FocusTarget, animate = true) {
    this.focusTarget = target;
    const portrait = this.aspect < 0.8;
    const view =
      target === 'overview'
        ? portrait
          ? OVERVIEW_PORTRAIT
          : OVERVIEW
        : target === 'home'
          ? { pos: [HOME.x + 1.5, 10, HOME.z + 13] as [number, number, number], target: [HOME.x + 0.5, 0.6, HOME.z + 1.8] as [number, number, number] }
          : zoneView(target);
    const to = new THREE.Vector3(...view.pos);
    const tTo = new THREE.Vector3(...view.target);
    // tela estreita (celular em pé, tela cheia): afasta a câmera para caber a área inteira
    if (target !== 'overview') to.sub(tTo).multiplyScalar(Math.min(2.4, Math.max(1, 1.1 / this.aspect))).add(tTo);
    if (!animate || this.opts.reducedMotion) {
      this.flight = null;
      this.camera.position.copy(to);
      this.controls.target.copy(tTo);
      this.controls.update();
      return;
    }
    this.flight = { from: this.camera.position.clone(), to, tFrom: this.controls.target.clone(), tTo, start: performance.now() };
  }

  zoom(factor: number) {
    const dir = this.camera.position.clone().sub(this.controls.target);
    const len = THREE.MathUtils.clamp(dir.length() * factor, this.controls.minDistance, this.controls.maxDistance);
    this.camera.position.copy(this.controls.target).add(dir.setLength(len));
    this.controls.update();
  }

  rotate(angle: number) {
    const offset = this.camera.position.clone().sub(this.controls.target);
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    this.camera.position.copy(this.controls.target).add(offset);
    this.controls.update();
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.onDown);
    canvas.removeEventListener('pointerup', this.onUp);
    this.controls.dispose();
    disposeTree(this.scene);
    this.envTarget?.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss(); // devolve o contexto WebGL já (celulares aceitam poucos)
    canvas.remove();
  }

  // ---------- internos ----------

  private resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    const first = this.aspect === 1 && !this.flight;
    this.aspect = w / h;
    this.camera.aspect = this.aspect;
    this.camera.fov = this.aspect < 0.8 ? 52 : 42;
    this.camera.updateProjectionMatrix();
    if (first) this.focusOn(this.focusTarget, false);
    this.needsRender = true;
    this.pinsDirty = true;
  }

  private onDown = (e: PointerEvent) => {
    this.downAt = { x: e.clientX, y: e.clientY };
  };

  private onUp = (e: PointerEvent) => {
    if (!this.downAt || Math.hypot(e.clientX - this.downAt.x, e.clientY - this.downAt.y) > 6) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const groups = [...this.items.values()].map((i) => i.group);
    const hit = this.raycaster.intersectObjects([...groups, this.home, this.yard], true)[0];
    let node: THREE.Object3D | null = hit?.object ?? null;
    while (node && !node.userData.itemId && !node.userData.home && !node.userData.placeCode) node = node.parent;
    if (node?.userData.home) this.opts.onHome();
    else if (node?.userData.placeCode) this.opts.onYard?.(node.userData.placeCode as string);
    else if (node) this.opts.onSelect(node.userData.itemId as string);
  };

  private project(x: number, y: number, z: number, rect: DOMRect, id: string): ScreenPin {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    return {
      id,
      x: ((v.x + 1) / 2) * rect.width,
      y: ((1 - v.y) / 2) * rect.height,
      visible: v.z < 1 && Math.abs(v.x) < 1.02 && Math.abs(v.y) < 1.02,
    };
  }

  private emitPins() {
    this.camera.updateMatrixWorld(); // posições da câmera deste quadro (não do anterior)
    const rect = this.renderer.domElement.getBoundingClientRect();
    const items: ScreenPin[] = [];
    for (const { group, spec, anchorY } of this.items.values()) {
      items.push(this.project(group.position.x, group.position.y + anchorY + 0.4, group.position.z, rect, spec.id));
    }
    const areas = AREA_CODES.map((code) => {
      const z = ZONES[code];
      const pin = this.project(z.cx, heightAt(z.cx, z.cz) + 7, z.cz, rect, code);
      // o nome da área não passa da borda da cena
      const pad = Math.min(110, rect.width / 3);
      return { ...pin, x: THREE.MathUtils.clamp(pin.x, pad, rect.width - pad) };
    });
    const top = new THREE.Box3().setFromObject(this.home).max.y;
    const home = this.project(HOME.x, top + 0.9, HOME.z, rect, 'home');
    const homePad = Math.min(80, rect.width / 4);
    this.opts.onPins(items, areas, { ...home, x: THREE.MathUtils.clamp(home.x, homePad, rect.width - homePad) });
  }

  private animate(t: number, dt: number) {
    this.wind.uniforms.uTime.value = t;
    waterClock.uniforms.uTime.value = t;
    for (const entry of this.items.values()) {
      const { group, phase } = entry;
      if (entry.bornAt !== null) {
        const k = THREE.MathUtils.clamp((t - entry.bornAt) / GROW_SECONDS, 0, 1);
        // cresce com um pequeno "pulo" no fim
        const s = k === 0 ? 0.001 : 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2);
        group.scale.setScalar(Math.max(0.001, s));
        if (k >= 1) {
          group.scale.setScalar(1);
          entry.bornAt = null;
        }
        this.pinsDirty = true;
        this.renderer.shadowMap.needsUpdate = true;
      }
      animateModel(group, t, phase);
    }
    this.yard.children.forEach((g, i) => animateModel(g as THREE.Group, t, 40 + i * 1.3));
    for (const cloud of this.clouds.children) {
      cloud.position.x += cloud.userData.speed * dt;
      if (cloud.position.x > 130) cloud.position.x = -130;
    }
  }

  /** Se os quadros demoram demais, reduz a resolução (até 60 % da original). */
  private adaptQuality(frameMs: number) {
    if (frameMs > 1000) return; // aba voltou do segundo plano
    this.sampledFrames++;
    if (frameMs > 55) this.slowFrames++;
    if (this.sampledFrames < 40) return;
    const slow = this.slowFrames / this.sampledFrames > 0.6;
    this.sampledFrames = 0;
    this.slowFrames = 0;
    const min = Math.min(window.devicePixelRatio || 1, 1) * 0.6;
    if (slow && this.pixelRatio > min) {
      this.pixelRatio = Math.max(min, this.pixelRatio * 0.8);
      this.renderer.setPixelRatio(this.pixelRatio);
      this.renderer.setSize(this.container.clientWidth || 1, this.container.clientHeight || 1, false);
    }
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    if (this.flight) {
      const k = Math.min(1, (performance.now() - this.flight.start) / 1100);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      this.camera.position.lerpVectors(this.flight.from, this.flight.to, e);
      this.controls.target.lerpVectors(this.flight.tFrom, this.flight.tTo, e);
      if (k >= 1) this.flight = null;
      this.pinsDirty = true;
      this.needsRender = true;
    }
    const interacting = this.controls.update() || this.flight !== null;
    if (interacting) this.pinsDirty = true;
    const moving = !this.opts.reducedMotion && document.visibilityState === 'visible';
    // animação decorativa (vento, água, bichos) a no máximo ~30 quadros por segundo: poupa bateria
    const now = performance.now();
    if (moving && (interacting || now - this.lastAnimAt >= 33)) {
      this.adaptQuality(now - this.lastAnimAt);
      this.lastAnimAt = now;
      this.animate(this.clock.elapsedTime, dt);
      this.needsRender = true;
    }
    if (this.pinsDirty) {
      this.pinsDirty = false;
      this.emitPins();
    }
    if (this.ready && this.revealQueue.length && !this.needsRender) {
      for (const o of this.revealQueue.shift()!) o.visible = true;
      this.renderer.shadowMap.needsUpdate = true;
      this.needsRender = true;
    }
    if (this.needsRender && this.ready) {
      this.needsRender = false;
      this.renderer.render(this.scene, this.camera);
    }
  };
}

/** A casa de "Meu Lugar" em miniatura, sobre uma base de pedra que acompanha o terreno. */
function buildHome(): THREE.Group {
  const wrapper = new THREE.Group();
  const house = buildHouse().group;
  house.position.set(0, 0, 0); // a casa gira e escala em torno do próprio centro
  wrapper.add(house);
  wrapper.scale.setScalar(HOME.scale);
  const hx = (HOUSE.width / 2 + 0.3) * HOME.scale;
  const hz = (HOUSE.depth / 2 + 0.9) * HOME.scale;
  const heights = [-1, 0, 1].flatMap((i) => [-1, 0, 1].map((j) => heightAt(HOME.x + i * hx, HOME.z + j * hz)));
  const top = Math.max(...heights);
  const bottom = Math.min(...heights) - 0.3;
  wrapper.position.set(HOME.x, top + 0.05, HOME.z);
  // base de pedra até o chão mais baixo (o terreno não é plano)
  const baseH = (top - bottom + 0.1) / HOME.scale;
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(HOUSE.width + 0.6, baseH, HOUSE.depth + 1.4),
    new THREE.MeshStandardMaterial({ color: 0xbdb5a3, roughness: 0.95 }),
  );
  base.position.set(0, -baseH / 2 - 0.05, 0.3);
  base.receiveShadow = true;
  wrapper.add(base);
  wrapper.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) m.castShadow = m.receiveShadow = true;
  });
  wrapper.userData.home = true;
  wrapper.name = 'minha-casa';
  return wrapper;
}

/** Quintal da casa no mundo: os mesmos modelos da casa, em escala de miniatura, ao lado dela. */
function buildYard(): THREE.Group {
  const yard = new THREE.Group();
  for (const def of PLACE_ITEMS) {
    const spot = HOME_YARD[def.code];
    if (!spot) continue;
    const g = buildObject(def.model);
    g.scale.setScalar(def.scale * HOME_YARD_SCALE);
    g.rotation.y = ((spot.rot ?? def.rotation) * Math.PI) / 180;
    g.position.set(spot.x, heightAt(spot.x, spot.z) + (spot.y ?? 0), spot.z);
    g.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.castShadow = m.receiveShadow = true;
    });
    g.name = `quintal-${def.code}`;
    g.userData.placeCode = def.code;
    yard.add(g);
  }
  yard.name = 'quintal-da-casa';
  return yard;
}

/** Libera geometrias e materiais (os compartilhados são liberados de novo sem problema). */
function disposeTree(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.geometry.dispose();
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    mats.forEach((mat) => mat.dispose());
  });
}
