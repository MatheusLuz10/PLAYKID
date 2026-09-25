/**
 * Texturas da casa desenhadas por código (canvas), sem arquivos externos:
 * veio de madeira, tacos, cerâmica, reboco, telhas, tijolos e terra.
 * Cada textura é criada uma vez e reaproveitada (cache).
 */
import * as THREE from 'three';

const cache = new Map<string, THREE.CanvasTexture>();

function rand(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function make(key: string, size: number, draw: (ctx: CanvasRenderingContext2D, r: () => number) => void, repeat: [number, number] = [1, 1]) {
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, rand(key.length * 7919 + size));
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(...repeat);
  tex.anisotropy = 4;
  tex.userData.shared = true;
  cache.set(key, tex);
  return tex;
}

/** Veio de madeira claro/escuro (em tons de cinza: a cor do material tinge). */
export function woodGrain() {
  return make('wood', 256, (ctx, r) => {
    ctx.fillStyle = '#d8d8d8';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 70; i++) {
      const y = r() * 256;
      const shade = 150 + Math.floor(r() * 90);
      ctx.strokeStyle = `rgba(${shade},${shade},${shade},${0.25 + r() * 0.35})`;
      ctx.lineWidth = 1 + r() * 3;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= 256; x += 16) ctx.lineTo(x, y + Math.sin(x * 0.03 + i) * (2 + r() * 3));
      ctx.stroke();
    }
    // nós da madeira
    for (let i = 0; i < 3; i++) {
      const x = r() * 256;
      const y = r() * 256;
      const g = ctx.createRadialGradient(x, y, 1, x, y, 9);
      g.addColorStop(0, 'rgba(90,90,90,0.6)');
      g.addColorStop(1, 'rgba(90,90,90,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 10, y - 10, 20, 20);
    }
  });
}

/** Piso de tacos/tábuas de madeira. */
export function woodFloor(tint: string) {
  return make(`floor-${tint}`, 512, (ctx, r) => {
    const plankH = 64;
    for (let y = 0; y < 512; y += plankH) {
      let x = -Math.floor(r() * 200);
      while (x < 512) {
        const w = 160 + Math.floor(r() * 140);
        const light = 0.85 + r() * 0.3;
        ctx.fillStyle = shadeHex(tint, light);
        ctx.fillRect(x, y, w, plankH);
        ctx.strokeStyle = 'rgba(0,0,0,0.08)';
        for (let k = 0; k < 6; k++) {
          const yy = y + 6 + r() * (plankH - 12);
          ctx.beginPath();
          ctx.moveTo(x, yy);
          ctx.bezierCurveTo(x + w / 3, yy + 3, x + (2 * w) / 3, yy - 3, x + w, yy);
          ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(40,25,10,0.35)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, plankH);
        x += w;
      }
    }
  }, [2, 2]);
}

/** Piso de cerâmica (cozinha). */
export function ceramicTiles(base: string) {
  return make(`tiles-${base}`, 256, (ctx, r) => {
    const n = 4;
    const s = 256 / n;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        ctx.fillStyle = shadeHex(base, 0.93 + r() * 0.1);
        ctx.fillRect(i * s, j * s, s, s);
      }
    }
    ctx.strokeStyle = 'rgba(120,110,95,0.55)';
    ctx.lineWidth = 3;
    for (let i = 0; i <= n; i++) {
      ctx.beginPath();
      ctx.moveTo(i * s, 0);
      ctx.lineTo(i * s, 256);
      ctx.moveTo(0, i * s);
      ctx.lineTo(256, i * s);
      ctx.stroke();
    }
  }, [3, 3]);
}

/** Reboco com textura suave (paredes). */
export function plaster() {
  return make('plaster', 256, (ctx, r) => {
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) {
      const v = 215 + Math.floor(r() * 40);
      ctx.fillStyle = `rgba(${v},${v},${v},0.35)`;
      ctx.fillRect(r() * 256, r() * 256, 1 + r() * 2, 1 + r() * 2);
    }
  }, [2, 1]);
}

/** Telhas de barro em fileiras. */
export function roofTiles() {
  return make('roof', 256, (ctx, r) => {
    ctx.fillStyle = '#9c3f31';
    ctx.fillRect(0, 0, 256, 256);
    const rows = 8;
    const h = 256 / rows;
    for (let row = 0; row < rows; row++) {
      const off = row % 2 ? h / 2 : 0;
      for (let x = -h; x < 256 + h; x += h) {
        const cx = x + off + h / 2;
        const g = ctx.createLinearGradient(cx - h / 2, 0, cx + h / 2, 0);
        const base = 0.85 + r() * 0.3;
        g.addColorStop(0, shadeHex('#b24a3b', base * 0.8));
        g.addColorStop(0.5, shadeHex('#c85b48', base));
        g.addColorStop(1, shadeHex('#b24a3b', base * 0.75));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(cx, row * h + h * 0.55, h / 2, h * 0.62, 0, 0, Math.PI);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(60,20,15,0.35)';
      ctx.fillRect(0, row * h + h - 3, 256, 3);
    }
  }, [5, 3]);
}

/** Tijolinhos (chaminé e base). */
export function bricks() {
  return make('bricks', 256, (ctx, r) => {
    ctx.fillStyle = '#cfc4b0';
    ctx.fillRect(0, 0, 256, 256);
    const bh = 32;
    const bw = 64;
    for (let y = 0; y < 256; y += bh) {
      const off = (y / bh) % 2 ? bw / 2 : 0;
      for (let x = -bw; x < 256; x += bw) {
        ctx.fillStyle = shadeHex('#a5553f', 0.8 + r() * 0.35);
        ctx.fillRect(x + off + 3, y + 3, bw - 6, bh - 6);
      }
    }
  }, [1, 1]);
}

/** Pedra (base da casa, degraus). */
export function stone() {
  return make('stone', 256, (ctx, r) => {
    ctx.fillStyle = '#b7b1a5';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = shadeHex('#a39d90', 0.85 + r() * 0.3);
      ctx.beginPath();
      ctx.ellipse(r() * 256, r() * 256, 12 + r() * 26, 10 + r() * 18, r() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [2, 1]);
}

function shadeHex(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${c((n >> 16) & 255)},${c((n >> 8) & 255)},${c(n & 255)})`;
}
