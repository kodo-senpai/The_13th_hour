import * as THREE from "three";

const cache = new Map<string, THREE.Texture>();

function makeCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function finish(canvas: HTMLCanvasElement) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

function cached(key: string, build: () => THREE.CanvasTexture) {
  const hit = cache.get(key);
  if (hit) return hit;
  const texture = build();
  cache.set(key, texture);
  return texture;
}

function noise(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number, seed = 3, alpha = 0.06) {
  const random = rng(seed);
  for (let i = 0; i < amount; i += 1) {
    const shade = Math.floor(random() * 255);
    ctx.fillStyle = `rgba(${shade},${shade},${shade},${alpha})`;
    const size = 1 + random() * 2.5;
    ctx.fillRect(random() * w, random() * h, size, size);
  }
}

function blotches(ctx: CanvasRenderingContext2D, w: number, h: number, color: string, count: number, seed = 8, max = 60) {
  const random = rng(seed);
  for (let i = 0; i < count; i += 1) {
    const x = random() * w;
    const y = random() * h;
    const radius = 8 + random() * max;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, color.replace("ALPHA", (0.1 + random() * 0.22).toFixed(2)));
    gradient.addColorStop(1, color.replace("ALPHA", "0"));
    ctx.fillStyle = gradient;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
}

function wood() {
  return cached("wood-floor", () => {
    const canvas = makeCanvas(512, 512);
    const ctx = canvas.getContext("2d")!;
    const random = rng(42);
    ctx.fillStyle = "#3a2a20";
    ctx.fillRect(0, 0, 512, 512);
    const plankH = 64;
    for (let row = 0; row < 8; row += 1) {
      const offset = row % 2 ? 170 : 0;
      for (let col = -1; col < 4; col += 1) {
        const x = col * 256 + offset;
        const y = row * plankH;
        const tone = 58 + random() * 26;
        ctx.fillStyle = `rgb(${tone + 24},${tone - 4},${tone - 18})`;
        ctx.fillRect(x + 1, y + 1, 254, plankH - 2);
        for (let grain = 0; grain < 12; grain += 1) {
          ctx.strokeStyle = `rgba(${tone - 25},${tone - 35},${tone - 40},${0.16 + random() * 0.2})`;
          ctx.lineWidth = 0.7 + random();
          ctx.beginPath();
          const gy = y + random() * plankH;
          ctx.moveTo(x + 4, gy);
          ctx.bezierCurveTo(x + 70, gy + random() * 5, x + 160, gy - random() * 5, x + 252, gy + random() * 3);
          ctx.stroke();
        }
        if (random() > 0.7) {
          ctx.fillStyle = "rgba(28,18,12,.6)";
          ctx.beginPath();
          ctx.ellipse(x + 40 + random() * 160, y + 18 + random() * 28, 5, 3, 0.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.fillStyle = "rgba(10,7,5,.8)";
      ctx.fillRect(0, row * plankH, 512, 2);
    }
    noise(ctx, 512, 512, 2600, 9, 0.05);
    return finish(canvas);
  });
}

function plaster(tint = "#8f907c") {
  return cached(`plaster-${tint}`, () => {
    const canvas = makeCanvas(512, 512);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, 512, 512);
    blotches(ctx, 512, 512, "rgba(40,42,35,ALPHA)", 24, 11, 120);
    blotches(ctx, 512, 512, "rgba(216,208,185,ALPHA)", 16, 22, 90);
    blotches(ctx, 512, 512, "rgba(112,68,36,ALPHA)", 8, 33, 70);
    const random = rng(77);
    // Hairline cracks and peeling paint.
    for (let i = 0; i < 14; i += 1) {
      let x = random() * 512;
      let y = random() * 512;
      ctx.strokeStyle = `rgba(52,50,41,${0.14 + random() * 0.3})`;
      ctx.lineWidth = 0.6 + random() * 0.9;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let step = 0; step < 8; step += 1) {
        x += (random() - 0.5) * 30;
        y += random() * 24;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    for (let i = 0; i < 7; i += 1) {
      const x = random() * 470;
      const y = random() * 470;
      ctx.fillStyle = "rgba(196,188,166,.4)";
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 12 + random() * 24, y - 4);
      ctx.lineTo(x + 20 + random() * 26, y + 16 + random() * 24);
      ctx.lineTo(x + 3, y + 12);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(70,66,55,.35)";
      ctx.stroke();
    }
    noise(ctx, 512, 512, 4200, 51, 0.05);
    return finish(canvas);
  });
}

function brick(tint = "#6f5647", mortar = "#a29a86") {
  return cached(`brick-${tint}-${mortar}`, () => {
    const canvas = makeCanvas(512, 512);
    const ctx = canvas.getContext("2d")!;
    const random = rng(19);
    ctx.fillStyle = mortar;
    ctx.fillRect(0, 0, 512, 512);
    const rows = 16;
    const height = 512 / rows;
    for (let row = 0; row < rows; row += 1) {
      const offset = row % 2 ? -32 : 0;
      for (let col = 0; col < 9; col += 1) {
        const x = offset + col * 64;
        const y = row * height;
        const jitter = random();
        const base = tint;
        const r = parseInt(base.slice(1, 3), 16);
        const g = parseInt(base.slice(3, 5), 16);
        const b = parseInt(base.slice(5, 7), 16);
        ctx.fillStyle = `rgb(${r + jitter * 26 - 8},${g + jitter * 18 - 10},${b + jitter * 14 - 9})`;
        ctx.fillRect(x + 2, y + 2, 60, height - 4);
        ctx.fillStyle = "rgba(255,255,255,.05)";
        ctx.fillRect(x + 3, y + 3, 58, 2);
      }
    }
    blotches(ctx, 512, 512, "rgba(28,25,20,ALPHA)", 22, 66, 90);
    blotches(ctx, 512, 512, "rgba(196,185,150,ALPHA)", 10, 12, 55);
    noise(ctx, 512, 512, 4000, 3, 0.06);
    return finish(canvas);
  });
}

function concrete(tint = "#5e6662") {
  return cached(`concrete-${tint}`, () => {
    const canvas = makeCanvas(512, 512);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, 512, 512);
    const random = rng(5);
    for (let i = 0; i < 40; i += 1) {
      ctx.strokeStyle = `rgba(30,34,33,${0.05 + random() * 0.18})`;
      ctx.lineWidth = 0.5 + random() * 2;
      ctx.beginPath();
      const y = random() * 512;
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(160, y + random() * 18, 350, y - random() * 14, 512, y + random() * 8);
      ctx.stroke();
    }
    blotches(ctx, 512, 512, "rgba(20,24,22,ALPHA)", 20, 12, 100);
    blotches(ctx, 512, 512, "rgba(150,148,130,ALPHA)", 12, 29, 60);
    ctx.strokeStyle = "rgba(30,32,31,.35)";
    ctx.lineWidth = 2;
    for (let x = 128; x < 512; x += 128) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 4, 512);
      ctx.stroke();
    }
    noise(ctx, 512, 512, 6000, 8, 0.06);
    return finish(canvas);
  });
}

function tiles(tint = "#8e9a91", grout = "#5c665f") {
  return cached(`tiles-${tint}-${grout}`, () => {
    const canvas = makeCanvas(512, 512);
    const ctx = canvas.getContext("2d")!;
    const random = rng(24);
    ctx.fillStyle = grout;
    ctx.fillRect(0, 0, 512, 512);
    const size = 64;
    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < 8; x += 1) {
        const shade = random();
        const r = parseInt(tint.slice(1, 3), 16);
        const g = parseInt(tint.slice(3, 5), 16);
        const b = parseInt(tint.slice(5, 7), 16);
        ctx.fillStyle = `rgb(${r + shade * 18 - 9},${g + shade * 16 - 8},${b + shade * 14 - 7})`;
        ctx.fillRect(x * size + 2, y * size + 2, size - 4, size - 4);
        ctx.fillStyle = "rgba(255,255,255,.1)";
        ctx.fillRect(x * size + 3, y * size + 3, size - 6, 2);
        if (random() > 0.94) {
          ctx.strokeStyle = "rgba(35,40,36,.6)";
          ctx.beginPath();
          ctx.moveTo(x * size + 8, y * size + 10);
          ctx.lineTo(x * size + size - 12, y * size + size - 8);
          ctx.stroke();
        }
      }
    }
    blotches(ctx, 512, 512, "rgba(48,58,48,ALPHA)", 18, 31, 90);
    blotches(ctx, 512, 512, "rgba(116,72,38,ALPHA)", 10, 4, 60);
    noise(ctx, 512, 512, 2600, 41, 0.04);
    return finish(canvas);
  });
}

function asphalt() {
  return cached("asphalt", () => {
    const canvas = makeCanvas(512, 512);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#333633";
    ctx.fillRect(0, 0, 512, 512);
    const random = rng(63);
    for (let i = 0; i < 8000; i += 1) {
      const value = 40 + random() * 50;
      ctx.fillStyle = `rgba(${value},${value + 3},${value},${0.2 + random() * 0.3})`;
      ctx.fillRect(random() * 512, random() * 512, 1 + random() * 2, 1 + random() * 2);
    }
    blotches(ctx, 512, 512, "rgba(12,14,13,ALPHA)", 16, 5, 110);
    ctx.strokeStyle = "rgba(20,22,21,.55)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i += 1) {
      ctx.beginPath();
      let x = random() * 512;
      let y = random() * 512;
      ctx.moveTo(x, y);
      for (let step = 0; step < 6; step += 1) {
        x += (random() - 0.5) * 80;
        y += random() * 50;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    return finish(canvas);
  });
}

function rust() {
  return cached("rust", () => {
    const canvas = makeCanvas(256, 256);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#5b615d";
    ctx.fillRect(0, 0, 256, 256);
    blotches(ctx, 256, 256, "rgba(138,74,30,ALPHA)", 30, 7, 55);
    blotches(ctx, 256, 256, "rgba(52,54,49,ALPHA)", 18, 17, 40);
    const random = rng(88);
    for (let i = 0; i < 1200; i += 1) {
      ctx.fillStyle = `rgba(${110 + random() * 70},${55 + random() * 40},${20 + random() * 20},${random() * 0.4})`;
      ctx.fillRect(random() * 256, random() * 256, 1 + random() * 3, 1 + random() * 2);
    }
    return finish(canvas);
  });
}

function cloth(tint = "#4b4038") {
  return cached(`cloth-${tint}`, () => {
    const canvas = makeCanvas(256, 256);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, 256, 256);
    ctx.globalAlpha = 0.07;
    for (let i = 0; i < 256; i += 4) {
      ctx.fillStyle = i % 8 === 0 ? "#d8c8a8" : "#171310";
      ctx.fillRect(i, 0, 1.2, 256);
      ctx.fillRect(0, i, 256, 1.2);
    }
    ctx.globalAlpha = 1;
    noise(ctx, 256, 256, 1400, 27, 0.05);
    blotches(ctx, 256, 256, "rgba(0,0,0,ALPHA)", 12, 14, 40);
    return finish(canvas);
  });
}

export function nightSky() {
  return cached("night-sky", () => {
    const canvas = makeCanvas(1024, 512);
    const ctx = canvas.getContext("2d")!;
    const random = rng(99);
    const gradient = ctx.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, "#061014");
    gradient.addColorStop(0.55, "#122a2c");
    gradient.addColorStop(1, "#32403a");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 150; i += 1) {
      ctx.fillStyle = `rgba(210,224,216,${0.1 + random() * 0.45})`;
      ctx.fillRect(random() * 1024, random() * 300, 1.2, 1.2);
    }
    const moonX = 760;
    const moonY = 120;
    const halo = ctx.createRadialGradient(moonX, moonY, 10, moonX, moonY, 160);
    halo.addColorStop(0, "rgba(210,228,216,.5)");
    halo.addColorStop(1, "rgba(210,228,216,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(moonX - 170, moonY - 170, 340, 340);
    ctx.fillStyle = "#d6e2d4";
    ctx.beginPath();
    ctx.arc(moonX, moonY, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(150,168,158,.4)";
    ctx.beginPath();
    ctx.arc(moonX - 12, moonY - 8, 8, 0, Math.PI * 2);
    ctx.arc(moonX + 16, moonY + 12, 5, 0, Math.PI * 2);
    ctx.fill();
    // Distant town silhouette and treeline.
    ctx.fillStyle = "#0a1415";
    for (let x = 0; x < 1024; x += 26) {
      const height = 26 + random() * 80;
      ctx.fillRect(x, 512 - height, 22, height);
      if (random() > 0.65) ctx.fillStyle = "rgba(226,183,108,.5)";
      if (random() > 0.65) {
        ctx.fillRect(x + 6, 512 - height + 10, 4, 5);
        ctx.fillStyle = "#0a1415";
      }
    }
    ctx.fillStyle = "#081112";
    ctx.beginPath();
    ctx.moveTo(0, 470);
    for (let x = 0; x <= 1024; x += 32) ctx.lineTo(x, 452 - random() * 30);
    ctx.lineTo(1024, 512);
    ctx.lineTo(0, 512);
    ctx.closePath();
    ctx.fill();
    return finish(canvas);
  });
}

export function signTexture(opts: { title: string; sub?: string; lines?: string[]; accent?: string; bg?: string; fg?: string; wear?: boolean }) {
  const key = `sign-${opts.title}-${opts.sub ?? ""}-${(opts.lines ?? []).join("|")}-${opts.accent ?? ""}-${opts.bg ?? ""}`;
  return cached(key, () => {
    const canvas = makeCanvas(1024, 512);
    const ctx = canvas.getContext("2d")!;
    const random = rng(17);
    ctx.fillStyle = opts.bg ?? "#171d1b";
    ctx.fillRect(0, 0, 1024, 512);
    ctx.strokeStyle = opts.accent ?? "#b9a67e";
    ctx.lineWidth = 5;
    ctx.strokeRect(20, 20, 984, 472);
    ctx.strokeStyle = "rgba(255,255,255,.14)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(32, 32, 960, 448);
    const lines = opts.lines ?? [];
    const titleSize = lines.length > 2 ? 96 : 116;
    ctx.textAlign = "center";
    ctx.fillStyle = opts.fg ?? "#d8cfb9";
    ctx.font = `700 ${titleSize}px Georgia, serif`;
    ctx.fillText(opts.title, 512, lines.length ? 180 : 290, 900);
    if (opts.sub) {
      ctx.font = "500 40px Georgia, serif";
      ctx.fillStyle = opts.accent ?? "#bda877";
      ctx.fillText(opts.sub, 512, 246, 880);
    }
    if (lines.length) {
      ctx.font = "500 34px 'Courier New', monospace";
      ctx.fillStyle = opts.fg ?? "#cfc7b4";
      lines.forEach((line, index) => {
        ctx.fillText(line, 512, 326 + index * 48, 900);
      });
    }
    if (opts.wear) {
      blotches(ctx, 1024, 512, "rgba(20,16,10,ALPHA)", 18, 6, 120);
      ctx.fillStyle = "rgba(10,10,8,.4)";
      ctx.fillRect(0, 470 + random() * 20, 1024, 30);
      for (let i = 0; i < 5; i += 1) {
        ctx.strokeStyle = "rgba(210,200,175,.2)";
        ctx.beginPath();
        ctx.moveTo(random() * 1024, 0);
        ctx.lineTo(random() * 1024, 512);
        ctx.stroke();
      }
    }
    return finish(canvas);
  });
}

export function noticePoster(opts: { title: string; body: string[]; accent?: string; bg?: string; seal?: boolean }) {
  const key = `poster-${opts.title}`;
  return cached(key, () => {
    const canvas = makeCanvas(512, 720);
    const ctx = canvas.getContext("2d")!;
    const random = rng(36);
    ctx.fillStyle = opts.bg ?? "#c7b994";
    ctx.fillRect(0, 0, 512, 720);
    ctx.strokeStyle = "rgba(40,34,24,.5)";
    ctx.lineWidth = 3;
    ctx.strokeRect(15, 15, 482, 690);
    ctx.fillStyle = opts.accent ?? "#8a3327";
    ctx.font = "900 66px 'Arial Narrow', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(opts.title, 256, 102, 470);
    ctx.fillStyle = "#2f2b21";
    ctx.font = "italic 25px Georgia, serif";
    opts.body.forEach((line, index) => ctx.fillText(line, 256, 560 + index * 38, 460));
    // simple portrait silhouette
    ctx.fillStyle = "rgba(46,42,33,.16)";
    ctx.beginPath();
    ctx.arc(256, 320, 92, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(256, 470, 130, 110, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    if (opts.seal) {
      ctx.strokeStyle = "rgba(138,51,39,.65)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(410, 620, 40, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = "700 14px monospace";
      ctx.fillStyle = "rgba(138,51,39,.8)";
      ctx.fillText("NORTHERN", 410, 615);
      ctx.fillText("RAILWAY", 410, 632);
    }
    blotches(ctx, 512, 720, "rgba(70,50,25,ALPHA)", 20, 2, 80);
    for (let i = 0; i < 6; i += 1) {
      ctx.strokeStyle = `rgba(80,66,44,${0.06 + random() * 0.08})`;
      ctx.beginPath();
      ctx.moveTo(random() * 512, 0);
      ctx.lineTo(random() * 512, 720);
      ctx.stroke();
    }
    return finish(canvas);
  });
}

export function graffitiTexture(text: string, color = "#b6ada0") {
  return cached(`graffiti-${text}`, () => {
    const canvas = makeCanvas(1024, 384);
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, 1024, 384);
    ctx.font = "900 88px 'Arial Black', sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.8;
    ctx.fillText(text, 30, 180, 960);
    ctx.globalAlpha = 0.55;
    ctx.fillText(text, 34, 184, 960);
    // Drips
    const random = rng(21);
    for (let i = 0; i < 26; i += 1) {
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.2 + random() * 0.4;
      ctx.fillRect(40 + random() * 880, 180, 3, 20 + random() * 110);
    }
    ctx.globalAlpha = 1;
    return finish(canvas);
  });
}

export function tiled(texture: THREE.Texture, x: number, y: number) {
  const clone = texture.clone();
  clone.wrapS = THREE.RepeatWrapping;
  clone.wrapT = THREE.RepeatWrapping;
  clone.repeat.set(x, y);
  clone.needsUpdate = true;
  return clone;
}

export const textures = { wood, plaster, brick, concrete, tiles, asphalt, rust, cloth };
