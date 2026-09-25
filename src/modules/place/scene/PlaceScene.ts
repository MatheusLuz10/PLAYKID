/**
 * Cena 3D de "Meu Lugar" (three.js puro), no mesmo visual realista do mundo 3D:
 * céu com névoa, sol com sombras suaves, grama ao vento, água com reflexo.
 * - Animação decorativa a no máximo ~30 quadros/s; sem movimento (preferência do
 *   sistema) só desenha quando algo muda → economiza bateria.
 * - Mouse: arrastar gira, roda aproxima, botão direito move. Toque: arrastar gira,
 *   pinça aproxima/move. Teclado: setas (com o foco na cena) e botões da tela.
 * - Libera toda a memória da GPU ao sair da página (dispose).
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { animateModel } from '../../world3d/scene/models/animate';
import { waterClock, waterMaterial } from '../../world3d/scene/models/common';
import { buildClouds, buildSky, type Wind } from '../../world3d/scene/terrain';
import { buildGardenZones, buildHouse, buildPlaceGrass, buildTerrain, GARDEN, HOUSE, ROOMS, type HouseParts } from './house';
import { buildObject, type ObjectModel } from './objects';

export type FocusTarget = 'geral' | keyof typeof ROOMS | 'jardim';

export interface SceneObject {
  code: string;
  model: ObjectModel;
  position: [number, number, number];
  rotation: number;
  scale: number;
  /** Surgiu agora: cresce ao aparecer. */
  isNew?: boolean;
  label: string;
}

export interface Hotspot {
  code: string;
  label: string;
  x: number;
  y: number;
  visible: boolean;
}

interface Options {
  reducedMotion: boolean;
  onSelect: (code: string) => void;
  onHotspots: (spots: Hotspot[]) => void;
}

const VIEWS: Record<FocusTarget, { pos: [number, number, number]; target: [number, number, number] }> = {
  geral: { pos: [16, 13, 18], target: [0, 1, 0] },
  jardim: { pos: [0, 11, 20], target: [0, 0, 5] },
  sala: { pos: [ROOMS.sala.x + 4, 9, ROOMS.sala.z + 7], target: [ROOMS.sala.x, 0.6, ROOMS.sala.z] },
  cozinha: { pos: [ROOMS.cozinha.x + 4, 9, ROOMS.cozinha.z + 7], target: [ROOMS.cozinha.x, 0.6, ROOMS.cozinha.z] },
  quarto: { pos: [ROOMS.quarto.x - 4, 9, ROOMS.quarto.z + 7], target: [ROOMS.quarto.x, 0.6, ROOMS.quarto.z] },
  estudos: { pos: [ROOMS.estudos.x + 4, 9, ROOMS.estudos.z + 7], target: [ROOMS.estudos.x, 0.6, ROOMS.estudos.z] },
};

export class PlaceScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private house: HouseParts;
  private objects = new Map<string, { group: THREE.Group; spec: SceneObject; born: number; anchorY: number; phase: number }>();
  private wind: Wind = { uniforms: { uTime: { value: 0 } } };
  private clouds: THREE.Group;
  private envTarget: THREE.WebGLRenderTarget | null = null;
  /** Shaders preparados em segundo plano antes do primeiro desenho (a página não trava). */
  private ready = false;
  private lastAnimAt = 0;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private needsRender = true;
  private raf = 0;
  private interior = false;
  private flight: { from: THREE.Vector3; to: THREE.Vector3; tFrom: THREE.Vector3; tTo: THREE.Vector3; start: number } | null = null;
  private resizeObserver: ResizeObserver;
  private downAt: { x: number; y: number } | null = null;
  private clock = new THREE.Clock();

  constructor(
    private container: HTMLElement,
    private opts: Options,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'default' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // o sol não se move: sombras recalculadas só quando os objetos mudam
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    const canvas = this.renderer.domElement;
    canvas.className = 'place-canvas';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Cena 3D da sua casa e do seu jardim. Use os botões ou a lista abaixo para explorar.');
    canvas.tabIndex = 0;
    container.appendChild(canvas);

    // Céu, névoa e luz de fim de manhã (as mesmas do mundo 3D)
    this.scene.add(buildSky());
    this.scene.fog = new THREE.Fog(0xd9ecf6, 38, 120);
    this.clouds = buildClouds();
    this.scene.add(this.clouds);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 700);
    this.camera.position.set(...VIEWS.geral.pos);

    this.scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x55683a, 0.9));
    const sun = new THREE.DirectionalLight(0xfff0d2, 2.4);
    sun.position.set(12, 20, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const s = 17;
    Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 60 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    sun.shadow.radius = 3;
    this.scene.add(sun);

    this.scene.add(buildTerrain());
    this.scene.add(buildGardenZones());
    this.scene.add(buildPlaceGrass(window.innerWidth < 700 ? 7000 : 14000, this.wind));
    this.house = buildHouse();
    this.scene.add(this.house.group);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(...VIEWS.geral.target);
    this.controls.enableDamping = !opts.reducedMotion;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 45;
    this.controls.maxPolarAngle = Math.PI / 2.15; // não vai para baixo do chão
    this.controls.listenToKeyEvents(canvas); // setas movem a câmera quando a cena tem foco
    this.controls.addEventListener('change', () => this.invalidate());
    this.controls.update();

    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointerup', this.onPointerUp);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    const start = this.framed('geral');
    this.camera.position.copy(start.to);
    this.controls.update();
    this.loop();
  }

  // ---------- API ----------

  setObjects(list: SceneObject[]) {
    const keep = new Set(list.map((o) => o.code));
    for (const [code, entry] of this.objects) {
      if (!keep.has(code)) {
        this.scene.remove(entry.group);
        disposeTree(entry.group);
        this.objects.delete(code);
      }
    }
    for (const spec of list) {
      if (this.objects.has(spec.code)) continue;
      const group = buildObject(spec.model);
      group.position.set(...spec.position);
      // modelos de jardim (árvores, bichos, água) ficam apoiados no chão
      if (group.userData.grounded) group.position.y = 0;
      group.rotation.y = spec.rotation;
      group.scale.setScalar(spec.scale);
      const anchorY = Math.max(0.4, new THREE.Box3().setFromObject(group).max.y - group.position.y);
      group.scale.setScalar(spec.isNew && !this.opts.reducedMotion ? 0.01 : spec.scale);
      group.userData.code = spec.code;
      group.traverse((o) => {
        o.userData.code = spec.code;
        if ((o as THREE.Mesh).isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      if (spec.model === 'picture' && this.interior) group.position.y = Math.min(spec.position[1], 0.45);
      this.scene.add(group);
      this.objects.set(spec.code, { group, spec, born: performance.now(), anchorY, phase: this.objects.size * 1.7 });
    }
    this.renderer.shadowMap.needsUpdate = true;
    this.invalidate();
    if (!this.ready) {
      const done = () => {
        this.ready = true;
        this.invalidate();
        window.setTimeout(() => this.buildReflections(), 800);
      };
      this.renderer.compileAsync(this.scene, this.camera).then(done, done);
    }
  }

  /** Reflexo do céu na água (lago e fonte), gerado depois que a casa aparece. */
  private buildReflections() {
    if (this.envTarget) return;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const skyScene = new THREE.Scene();
    skyScene.add(buildSky());
    this.envTarget = pmrem.fromScene(skyScene, 0, 0.1, 400, { size: 64 });
    disposeTree(skyScene, true);
    pmrem.dispose();
    const water = waterMaterial();
    water.envMap = this.envTarget.texture;
    water.envMapIntensity = 1.2;
    water.needsUpdate = true;
    this.invalidate();
  }

  /** "Ver por dentro": tira o telhado e baixa as paredes (casa de bonecas). */
  setInterior(on: boolean) {
    this.interior = on;
    this.house.roof.visible = !on;
    const factor = on ? 0.3 : 1;
    for (const w of this.house.walls) {
      // cada bloco vai de y0 a y1: escalado a partir do chão, vai de y0·f a y1·f
      const baseY = (w.userData.baseY ??= w.position.y) as number;
      w.scale.y = factor;
      w.position.y = baseY * factor;
    }
    // objetos de parede (quadro) descem junto com a parede rebaixada
    for (const { group, spec } of this.objects.values()) {
      if (spec.model === 'picture') group.position.y = on ? Math.min(spec.position[1], 0.45) : spec.position[1];
    }
    // janelas e portas somem no modo aberto (ficariam flutuando)
    this.house.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && !this.house.walls.includes(m) && m.parent !== this.house.group && m.parent !== this.house.roof) {
        m.visible = !on;
      }
    });
    this.invalidate();
  }

  /** Em telas estreitas (celular em pé), as vistas amplas se afastam para caber a propriedade inteira. */
  private framed(target: FocusTarget) {
    const v = VIEWS[target];
    const tTo = new THREE.Vector3(...v.target);
    const to = new THREE.Vector3(...v.pos);
    if (target === 'geral' || target === 'jardim') {
      const factor = Math.min(1.8, Math.max(1, 1.35 / Math.max(this.camera.aspect, 0.3)));
      to.sub(tTo).multiplyScalar(factor).add(tTo);
    }
    return { to, tTo };
  }

  focus(target: FocusTarget) {
    if (target !== 'geral' && target !== 'jardim' && !this.interior) this.setInterior(true);
    const { to, tTo } = this.framed(target);
    if (this.opts.reducedMotion) {
      this.camera.position.copy(to);
      this.controls.target.copy(tTo);
      this.controls.update();
      this.invalidate();
      return;
    }
    this.flight = { from: this.camera.position.clone(), to, tFrom: this.controls.target.clone(), tTo, start: performance.now() };
    this.invalidate();
  }

  zoom(direction: 1 | -1) {
    const dir = this.camera.position.clone().sub(this.controls.target);
    const len = THREE.MathUtils.clamp(dir.length() * (direction > 0 ? 0.8 : 1.25), this.controls.minDistance, this.controls.maxDistance);
    this.camera.position.copy(this.controls.target).add(dir.setLength(len));
    this.controls.update();
  }

  rotate(direction: 1 | -1) {
    const offset = this.camera.position.clone().sub(this.controls.target);
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), (direction * Math.PI) / 8);
    this.camera.position.copy(this.controls.target).add(offset);
    this.controls.update();
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.onPointerDown);
    canvas.removeEventListener('pointerup', this.onPointerUp);
    this.controls.dispose();
    disposeTree(this.scene, true);
    this.envTarget?.dispose();
    this.renderer.dispose();
    canvas.remove();
  }

  // ---------- internos ----------

  private invalidate() {
    this.needsRender = true;
  }

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.invalidate();
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    const t = this.clock.getElapsedTime();

    if (this.flight) {
      const k = Math.min(1, (now - this.flight.start) / 700);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      this.camera.position.lerpVectors(this.flight.from, this.flight.to, e);
      this.controls.target.lerpVectors(this.flight.tFrom, this.flight.tTo, e);
      if (k >= 1) this.flight = null;
      this.needsRender = true;
    }
    if (this.controls.update()) this.needsRender = true;

    // objetos novos crescem
    for (const { group, spec, born } of this.objects.values()) {
      if (spec.isNew && !this.opts.reducedMotion) {
        const k = Math.min(1, (now - born) / 900);
        const s = spec.scale * (k < 1 ? 1 - Math.pow(1 - k, 3) : 1);
        if (group.scale.x !== s) {
          group.scale.setScalar(Math.max(0.01, s));
          this.renderer.shadowMap.needsUpdate = true;
          this.needsRender = true;
        }
      }
    }
    // vento, água e bichos (desligado com redução de movimento), a ~30 quadros/s
    if (!this.opts.reducedMotion && document.visibilityState === 'visible' && now - this.lastAnimAt >= 33) {
      this.lastAnimAt = now;
      this.wind.uniforms.uTime.value = t;
      waterClock.uniforms.uTime.value = t;
      for (const { group, phase } of this.objects.values()) animateModel(group, t, phase);
      for (const cloud of this.clouds.children) {
        cloud.position.x += cloud.userData.speed * 0.033;
        if (cloud.position.x > 130) cloud.position.x = -130;
      }
      this.needsRender = true;
    }

    if (!this.needsRender || !this.ready) return;
    this.needsRender = false;
    this.renderer.render(this.scene, this.camera);
    this.emitHotspots();
  };

  /** Posição na tela de cada objeto → botões acessíveis por cima da cena. */
  private emitHotspots() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    const v = new THREE.Vector3();
    const spots: Hotspot[] = [];
    for (const { group, spec, anchorY } of this.objects.values()) {
      v.setFromMatrixPosition(group.matrixWorld);
      v.y += Math.min(anchorY, 4) * (group.scale.x / spec.scale) + 0.15;
      v.project(this.camera);
      const visible = v.z < 1 && Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1;
      spots.push({ code: spec.code, label: spec.label, x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h, visible });
    }
    this.opts.onHotspots(spots);
  }

  private onPointerDown = (e: PointerEvent) => {
    this.downAt = { x: e.clientX, y: e.clientY };
  };

  /** Toque/clique (sem arrastar) seleciona o objeto sob o ponteiro. */
  private onPointerUp = (e: PointerEvent) => {
    if (!this.downAt || Math.hypot(e.clientX - this.downAt.x, e.clientY - this.downAt.y) > 6) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects([...this.objects.values()].map((o) => o.group), true);
    const code = hits[0]?.object.userData.code as string | undefined;
    if (code) this.opts.onSelect(code);
  };
}

/** Libera geometrias e materiais. Materiais compartilhados só saem quando a cena inteira sai. */
function disposeTree(root: THREE.Object3D, all = false) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const list = ([] as THREE.Material[]).concat((m.material as THREE.Material | THREE.Material[] | undefined) ?? []);
    for (const x of list) if (all || !x.userData.shared) x.dispose();
  });
}

export { GARDEN, HOUSE, ROOMS };
