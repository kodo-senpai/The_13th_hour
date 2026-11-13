import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { expandHome } from "./homeExpansion";
import { expandStation } from "./stationExpansion";
import { expandBunker } from "./bunkerExpansion";
import type { Collider } from "./worldApi";
import MovementControls, { CONTROL_EVENT, RESET_CONTROLS_EVENT } from "./MovementControls";
import type { ControlInput } from "./MovementControls";

export type WorldScene = "home" | "station" | "past" | "wrong" | "bunker" | "epilogue-save" | "epilogue-preserve" | "epilogue-unwritten";

type GameWorldProps = {
  sceneId: WorldScene;
  active: boolean;
  flashlightOn: boolean;
  powerOn: boolean;
  gateOpen: boolean;
  bunkerPower: boolean;
  collectedIds: string[];
  onInteract: (id: string) => void;
  onPrompt: (label: string | null) => void;
  onNote: (text: string) => void;
};

type Interactive = THREE.Mesh & {
  userData: { interactionId?: string; interactionLabel?: string };
};

type Rig = {
  group: THREE.Group;
  body: Interactive;
  head: Interactive;
  headPivot: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
};

type OwlState = {
  stage: "idle" | "turning" | "holding";
  t: number;
  stare: number;
  cooldown: number;
};

type Walker = {
  id?: string;
  rig: Rig;
  points: THREE.Vector3[];
  pingpong: boolean;
  speed: number;
  pause: [number, number];
  watch: boolean;
  idx: number;
  dir: 1 | -1;
  pauseLeft: number;
  yaw: number;
  walk: number;
  phase: number;
  baseY: number;
  lookYaw: number;
  nextLook: number;
  owl?: OwlState;
};

type StepContext = {
  dt: number;
  time: number;
  player: THREE.Vector3;
  walkers: Walker[];
  aimedId: string | null;
  note: (text: string) => void;
};

type SceneBuild = {
  start: THREE.Vector3;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  colliders: Collider[];
  interactables: Interactive[];
  walkers: Walker[];
  animated: Array<(time: number, dt: number) => void>;
};

type MatOpts = {
  emissive?: number;
  emissiveIntensity?: number;
  roughness?: number;
  metalness?: number;
  opacity?: number;
};

type BoxOpts = {
  id?: string;
  label?: string;
  emissive?: number;
  rotation?: [number, number, number];
  opacity?: number;
  metalness?: number;
};

type RigOpts = {
  coat: number;
  trouser?: number;
  skin?: number;
  hair?: number;
  hat?: "cap" | "turban" | "none";
  moustache?: boolean;
  ghost?: boolean;
  id?: string;
  label?: string;
  scale?: number;
};

type WalkerOpts = RigOpts & {
  points: Array<[number, number]>;
  speed?: number;
  pause?: [number, number];
  pingpong?: boolean;
  watch?: boolean;
  startIndex?: number;
  owl?: boolean;
  base?: number;
};

type Torch = {
  spot: THREE.SpotLight;
  spill: THREE.SpotLight;
  beamMat: THREE.ShaderMaterial;
  lensMat: THREE.MeshStandardMaterial;
  halo: THREE.Sprite;
  level: number;
  stutter: number;
};

const FLOOR_HOME = 0;
const FLOOR_STATION = 0.28;

function newBuild(start: THREE.Vector3, bounds: { minX: number; maxX: number; minZ: number; maxZ: number }): SceneBuild {
  return { start, bounds, colliders: [], interactables: [], walkers: [], animated: [] };
}

function wrapAngle(angle: number) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function lerpAngle(from: number, to: number, t: number) {
  return from + wrapAngle(to - from) * t;
}

function material(color: number, options: MatOpts = {}) {
  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissive !== undefined ? (options.emissiveIntensity ?? 0.45) : 0,
    roughness: options.roughness ?? 0.85,
    metalness: options.metalness ?? 0.04,
  });
  if (options.opacity !== undefined) {
    mat.transparent = true;
    mat.opacity = options.opacity;
    mat.depthWrite = false;
  }
  return mat;
}

let glowTex: THREE.CanvasTexture | null = null;
function glowTexture() {
  if (glowTex) return glowTex;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.22, "rgba(255,255,255,0.4)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(canvas);
  return glowTex;
}

function glowSprite(scene: THREE.Scene, position: [number, number, number], color: number, size: number, opacity: number) {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(),
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  sprite.position.set(position[0], position[1], position[2]);
  sprite.scale.setScalar(size);
  scene.add(sprite);
  return sprite;
}

function box(scene: THREE.Scene, size: [number, number, number], position: [number, number, number], color: number, options: BoxOpts = {}) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(size[0], size[1], size[2]),
    material(color, { emissive: options.emissive, opacity: options.opacity, metalness: options.metalness }),
  ) as Interactive;
  mesh.position.set(position[0], position[1], position[2]);
  if (options.rotation) mesh.rotation.set(options.rotation[0], options.rotation[1], options.rotation[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (options.id) {
    mesh.userData.interactionId = options.id;
    mesh.userData.interactionLabel = options.label ?? "Inspect";
  }
  scene.add(mesh);
  return mesh;
}

function cylinder(
  scene: THREE.Scene,
  radius: number,
  height: number,
  position: [number, number, number],
  color: number,
  options: BoxOpts = {},
) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 16), material(color, { emissive: options.emissive, metalness: 0.25 })) as Interactive;
  mesh.position.set(position[0], position[1], position[2]);
  if (options.rotation) mesh.rotation.set(options.rotation[0], options.rotation[1], options.rotation[2]);
  mesh.castShadow = true;
  if (options.id) {
    mesh.userData.interactionId = options.id;
    mesh.userData.interactionLabel = options.label ?? "Inspect";
  }
  scene.add(mesh);
  return mesh;
}

function textSprite(text: string, color = "#d8ccb2", background = "rgba(5,10,11,.84)", scale = 1) {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 160;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "rgba(200,160,90,.55)";
  ctx.lineWidth = 5;
  ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
  ctx.fillStyle = color;
  ctx.font = "600 54px Georgia";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 2);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true }));
  sprite.scale.set(4.8 * scale, scale, 1);
  return sprite;
}

/* ---------- Lighting helpers ---------- */

// A fluorescent tube (or incandescent source) that flickers with organic noise and occasional stutters.
function tubeLight(
  scene: THREE.Scene,
  animated: SceneBuild["animated"],
  position: [number, number, number],
  color: number,
  intensity: number,
  distance: number,
  on: boolean,
  seed: number,
  flicker = 0.5,
) {
  const tube = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.07, 1.8),
    material(on ? color : 0x20292a, { emissive: on ? color : 0x000000, emissiveIntensity: on ? 1.6 : 0 }),
  );
  tube.position.set(position[0], position[1], position[2]);
  scene.add(tube);
  const light = new THREE.PointLight(color, on ? intensity : 0, distance, 1.6);
  light.position.set(position[0], position[1] - 0.25, position[2]);
  scene.add(light);
  const glow = glowSprite(scene, [position[0], position[1] - 0.1, position[2]], color, 1.7, on ? 0.32 : 0);
  animated.push((t) => {
    if (!on) return;
    const noise = Math.sin(t * 23 + seed) * Math.sin(t * 9.1 + seed * 1.7);
    let level = 1 + noise * flicker * 0.06;
    if (Math.sin(t * 0.9 + seed * 3.1) > 0.993) level *= 0.3;
    light.intensity = intensity * level;
    glow.material.opacity = 0.32 * level;
  });
}

function addDust(scene: THREE.Scene, built: SceneBuild, color: number, count: number, opacity: number) {
  const { minX, maxX, minZ, maxZ } = built.bounds;
  const positions = new Float32Array(count * 3);
  const base = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    base[i * 3] = THREE.MathUtils.randFloat(minX, maxX);
    base[i * 3 + 1] = THREE.MathUtils.randFloat(0.3, 3.8);
    base[i * 3 + 2] = THREE.MathUtils.randFloat(minZ, maxZ);
    positions[i * 3] = base[i * 3];
    positions[i * 3 + 1] = base[i * 3 + 1];
    positions[i * 3 + 2] = base[i * 3 + 2];
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ color, size: 0.03, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  scene.add(points);
  built.animated.push((time) => {
    const attr = geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < count; i += 1) {
      attr.setXYZ(
        i,
        base[i * 3] + Math.sin(time * 0.12 + i * 1.7) * 0.22,
        base[i * 3 + 1] + Math.sin(time * 0.2 + i) * 0.1,
        base[i * 3 + 2] + Math.cos(time * 0.1 + i * 0.9) * 0.22,
      );
    }
    attr.needsUpdate = true;
  });
}

/* ---------- Human rigs & walkers ---------- */

function buildRig(scene: THREE.Scene, position: THREE.Vector3, o: RigOpts): Rig {
  const opacity = o.ghost ? 0.3 : undefined;
  const coatMat = material(o.coat, { roughness: 0.9, opacity });
  const trouserMat = material(o.trouser ?? 0x1c1e20, { roughness: 0.92, opacity });
  const skinMat = material(o.skin ?? 0x8d6651, { roughness: 0.6, opacity });
  const hairMat = material(o.hair ?? 0x121212, { roughness: 0.8, opacity });
  const shoeMat = material(0x0c0b0a, { roughness: 0.5, opacity });
  const eyeMat = material(0x050505, { roughness: 0.3, opacity });
  const hatMat = material(0x181b1b, { roughness: 0.7, opacity });

  const group = new THREE.Group();
  group.position.copy(position);
  group.scale.setScalar(o.scale ?? 1);

  const makeLeg = (x: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.86, 0);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.085, 0.86, 8), trouserMat);
    leg.position.y = -0.43;
    leg.castShadow = true;
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.09, 0.28), shoeMat);
    shoe.position.set(0, -0.88, 0.06);
    pivot.add(leg, shoe);
    group.add(pivot);
    return pivot;
  };

  const makeArm = (x: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 1.44, 0);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.06, 0.7, 8), coatMat);
    arm.position.y = -0.35;
    arm.castShadow = true;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), skinMat);
    hand.position.y = -0.74;
    pivot.add(arm, hand);
    group.add(pivot);
    return pivot;
  };

  const legL = makeLeg(-0.13);
  const legR = makeLeg(0.13);
  const armL = makeArm(-0.33);
  const armR = makeArm(0.33);

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.3, 0.72, 10), coatMat) as Interactive;
  body.position.y = 1.2;
  body.castShadow = true;

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.14, 8), skinMat);
  neck.position.y = 1.55;

  const headPivot = new THREE.Group();
  headPivot.position.y = 1.67;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 11), skinMat) as Interactive;
  head.castShadow = true;
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.45), hairMat);
  hair.position.y = 0.02;
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 5), eyeMat);
  eyeL.position.set(-0.065, 0.02, 0.16);
  const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 5), eyeMat);
  eyeR.position.set(0.065, 0.02, 0.16);
  headPivot.add(head, hair, eyeL, eyeR);

  if (o.hat === "cap") {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.07, 14), hatMat);
    cap.position.y = 0.13;
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.02, 0.14), hatMat);
    brim.position.set(0, 0.11, 0.17);
    headPivot.add(cap, brim);
  }
  if (o.hat === "turban") {
    const turban = new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 9), material(0xa86a2d, { roughness: 0.8, opacity }));
    turban.scale.set(1, 0.7, 1);
    turban.position.y = 0.12;
    headPivot.add(turban);
  }
  if (o.moustache) {
    const moustache = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.028, 0.05), hairMat);
    moustache.position.set(0, -0.07, 0.165);
    headPivot.add(moustache);
  }

  group.add(body, neck, headPivot);
  if (o.id) {
    body.userData.interactionId = o.id;
    body.userData.interactionLabel = o.label ?? "Speak";
    head.userData.interactionId = o.id;
    head.userData.interactionLabel = o.label ?? "Speak";
  }
  scene.add(group);
  return { group, body, head, headPivot, armL, armR, legL, legR };
}

function spawnWalker(scene: THREE.Scene, built: SceneBuild, o: WalkerOpts): Walker {
  const base = o.base ?? FLOOR_STATION;
  const points = o.points.map(([x, z]) => new THREE.Vector3(x, base, z));
  const startIndex = o.startIndex ?? 0;
  const start = points[startIndex];
  const rig = buildRig(scene, start, o);
  const walker: Walker = {
    id: o.id,
    rig,
    points,
    pingpong: o.pingpong ?? false,
    speed: o.speed ?? 0,
    pause: o.pause ?? [2, 5],
    watch: o.watch ?? false,
    idx: startIndex,
    dir: 1,
    pauseLeft: Math.random() * 3,
    yaw: 0,
    walk: 0,
    phase: Math.random() * Math.PI * 2,
    baseY: base,
    lookYaw: 0,
    nextLook: Math.random() * 3,
    owl: o.owl ? { stage: "idle", t: 0, stare: 0, cooldown: 0 } : undefined,
  };
  if (points.length > 1 && walker.speed > 0) {
    const next = points[(startIndex + 1) % points.length];
    walker.yaw = Math.atan2(next.x - start.x, next.z - start.z);
  }
  rig.group.rotation.y = walker.yaw;
  built.walkers.push(walker);
  if (o.id) built.interactables.push(rig.body, rig.head);
  return walker;
}

function stepWalker(w: Walker, ctx: StepContext) {
  const { dt, time, player, walkers } = ctx;
  const group = w.rig.group;
  const pos = group.position;
  let moving = false;

  if (w.pauseLeft > 0) {
    w.pauseLeft -= dt;
  } else if (w.speed > 0 && w.points.length > 1) {
    const target = w.points[w.idx];
    const dx = target.x - pos.x;
    const dz = target.z - pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.12) {
      w.pauseLeft = THREE.MathUtils.randFloat(w.pause[0], w.pause[1]);
      if (w.pingpong) {
        if (w.idx >= w.points.length - 1) w.dir = -1;
        else if (w.idx <= 0) w.dir = 1;
        w.idx += w.dir;
      } else {
        w.idx = (w.idx + 1) % w.points.length;
      }
    } else {
      // Soft separation so people do not walk through each other.
      let sepX = 0;
      let sepZ = 0;
      for (const other of walkers) {
        if (other === w) continue;
        const ox = pos.x - other.rig.group.position.x;
        const oz = pos.z - other.rig.group.position.z;
        const d = Math.hypot(ox, oz);
        if (d > 0.001 && d < 0.8) {
          const force = (0.8 - d) / 0.8;
          sepX += (ox / d) * force;
          sepZ += (oz / d) * force;
        }
      }
      const steerX = dx / dist + sepX * 1.2;
      const steerZ = dz / dist + sepZ * 1.2;
      const desired = Math.atan2(steerX, steerZ);
      w.yaw = lerpAngle(w.yaw, desired, 1 - Math.exp(-5 * dt));
      // Walk slower while still turning, like a real person.
      const alignment = Math.max(0.15, Math.cos(wrapAngle(desired - w.yaw)));
      const step = Math.min(dist, w.speed * dt * alignment);
      pos.x += Math.sin(w.yaw) * step;
      pos.z += Math.cos(w.yaw) * step;
      moving = true;
    }
  }

  // Gait & body motion
  w.walk = THREE.MathUtils.lerp(w.walk, moving ? 1 : 0, 1 - Math.exp(-5.5 * dt));
  if (moving) w.phase += dt * w.speed * 4.8;
  group.rotation.y = w.yaw;
  group.rotation.z = Math.sin(time * 0.6 + w.phase * 0.3) * 0.014 * (1 - w.walk);
  group.position.y = w.baseY + Math.abs(Math.sin(w.phase)) * 0.035 * w.walk;

  const swing = Math.sin(w.phase) * 0.55 * w.walk;
  const breath = Math.sin(time * 1.4 + w.phase) * 0.022;
  w.rig.armL.rotation.x = swing + breath;
  w.rig.armR.rotation.x = -swing + breath;
  w.rig.legL.rotation.x = -swing * 0.9;
  w.rig.legR.rotation.x = swing * 0.9;
  w.rig.body.scale.set(1, 1 + Math.sin(time * 2.1 + w.phase) * 0.006, 1);

  // Head: watch the player when close, otherwise idle look-around.
  const toPlayerX = player.x - pos.x;
  const toPlayerZ = player.z - pos.z;
  const playerDist = Math.hypot(toPlayerX, toPlayerZ);
  const watching = w.watch && playerDist < 5.5;
  let headTarget: number;
  if (watching) {
    headTarget = THREE.MathUtils.clamp(wrapAngle(Math.atan2(toPlayerX, toPlayerZ) - w.yaw), -1.25, 1.25);
  } else {
    if (time > w.nextLook) {
      w.lookYaw = THREE.MathUtils.randFloat(-0.7, 0.7);
      w.nextLook = time + THREE.MathUtils.randFloat(2.5, 6);
    }
    headTarget = w.lookYaw;
  }

  const head = w.rig.headPivot;
  let owlBusy = false;
  if (w.owl) {
    const o = w.owl;
    if (o.cooldown > 0) o.cooldown -= dt;
    if (o.stage === "idle") {
      o.stare = ctx.aimedId !== null && ctx.aimedId === w.id ? o.stare + dt : Math.max(0, o.stare - dt * 0.6);
      if (o.stare > 3 && o.cooldown <= 0) {
        o.stage = "turning";
        o.t = 0;
        ctx.note("The Conductor's head turns, slowly, all the way round. He does not blink. Neither should you.");
      }
    } else if (o.stage === "turning") {
      owlBusy = true;
      o.t += dt;
      const k = Math.min(1, o.t / 3.4);
      head.rotation.y = Math.PI * k * k * (3 - 2 * k);
      if (o.t >= 3.4) {
        o.stage = "holding";
        o.t = 0;
      }
    } else {
      owlBusy = true;
      o.t += dt;
      head.rotation.y = Math.PI;
      if (o.t > 1.8) {
        head.rotation.y = 0;
        o.stage = "idle";
        o.stare = 0;
        o.cooldown = 10;
        ctx.note("The Conductor is facing forward. He has always been facing forward. Please do not mention it.");
      }
    }
  }
  if (!owlBusy) {
    const smoothing = Math.min(1, 3.5 * dt);
    head.rotation.y += (headTarget - head.rotation.y) * smoothing;
  }
}

/* ---------- Props ---------- */

function addClock(scene: THREE.Scene, position: [number, number, number], warm = false) {
  const group = new THREE.Group();
  group.position.set(position[0], position[1], position[2]);
  const face = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.16, 28), material(warm ? 0xd6bf8e : 0xaeb6aa, { emissive: warm ? 0x5a4520 : 0x1e2a2a, emissiveIntensity: 0.5 }));
  face.rotation.x = Math.PI / 2;
  group.add(face);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.16, 0.09, 8, 28), material(0x27231e, { metalness: 0.5 }));
  group.add(rim);
  const minute = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.82, 0.05), material(0x171817));
  minute.position.set(0, 0.34, 0.13);
  minute.rotation.z = -0.25;
  group.add(minute);
  const hour = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.55, 0.06), material(0xa8332d));
  hour.position.set(0.18, 0.18, 0.16);
  hour.rotation.z = -0.78;
  group.add(hour);
  scene.add(group);
  return { group, minute };
}

function addStationShell(scene: THREE.Scene, warm: boolean) {
  const concrete = warm ? 0x8c7656 : 0x374446;
  const platform = warm ? 0x9e895f : 0x4a5654;
  box(scene, [9, 0.55, 42], [-0.5, 0, 0], platform);
  box(scene, [0.28, 0.12, 42], [3.92, 0.34, 0], warm ? 0xd8bd72 : 0xc5b26f);
  box(scene, [8.2, 4.8, 0.3], [-0.6, 2.4, -20], concrete);
  box(scene, [0.3, 4.4, 20], [-4.8, 2.2, -10], concrete);
  box(scene, [0.3, 4.4, 10], [-4.8, 2.2, 15], concrete);
  box(scene, [0.14, 0.14, 42], [5.2, -0.22, 0], 0x585b59);
  box(scene, [0.14, 0.14, 42], [6.25, -0.22, 0], 0x585b59);
  for (let z = -20; z <= 20; z += 1.25) box(scene, [2.4, 0.08, 0.16], [5.72, -0.28, z], 0x41332a);
  box(scene, [4.5, 0.25, 42], [5.72, -0.43, 0], 0x181b1b);
  for (let z = -16; z <= 16; z += 8) {
    box(scene, [0.18, 4.2, 0.18], [-3.7, 2.2, z], 0x303432);
    box(scene, [7.5, 0.16, 3], [-0.1, 4.25, z], 0x343b39, { rotation: [0, 0, -0.03] });
  }
  const sign = textSprite("SURAJPUR HALT", warm ? "#2a2118" : "#d9caaa", warm ? "#d9b968" : "rgba(8,18,19,.9)", 0.82);
  sign.position.set(-0.4, 2.7, -19.75);
  scene.add(sign);
}

function addTrain(scene: THREE.Scene, built: SceneBuild, warm: boolean, doorId?: string) {
  box(scene, [3.55, 3.4, 34], [6.1, 1.3, -1], warm ? 0x8d3f2e : 0x182c30, { emissive: warm ? 0x2f130d : 0x0c262b });
  const windowColor = warm ? 0xf0b65f : 0x5b9b97;
  for (let z = -14; z <= 12; z += 3.1) {
    box(scene, [0.05, 0.82, 1.55], [4.31, 1.82, z], 0x171b1b, { emissive: windowColor });
  }
  if (warm) {
    for (let z = -10; z <= 8; z += 9) {
      const interior = new THREE.PointLight(0xffb866, 2.2, 7, 2);
      interior.position.set(4.6, 2.2, z);
      scene.add(interior);
    }
  }
  if (doorId) {
    const door = box(scene, [0.08, 2.25, 1.45], [4.23, 1.25, -14.7], warm ? 0x8f4b37 : 0x24464a, {
      id: doorId,
      label: "Board the 23:58 Mail Express",
      emissive: warm ? 0x6f321f : 0x285d60,
    });
    built.interactables.push(door);
  }
}

// Framed picture on a wall. The picture plane is interactable and textured once the image loads.
function addPhotoFrame(
  scene: THREE.Scene,
  built: SceneBuild,
  o: { position: [number, number, number]; rotationY: number; width: number; height: number; file: string; id: string; label: string },
) {
  const group = new THREE.Group();
  group.position.set(o.position[0], o.position[1], o.position[2]);
  group.rotation.y = o.rotationY;
  scene.add(group);

  const frame = new THREE.Mesh(new THREE.BoxGeometry(o.width + 0.22, o.height + 0.22, 0.08), material(0x2f2119, { roughness: 0.55 }));
  frame.castShadow = true;
  group.add(frame);

  const picMat = material(0x8f8772, { roughness: 0.7 });
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(o.width, o.height), picMat) as Interactive;
  pic.position.z = 0.045;
  pic.userData.interactionId = o.id;
  pic.userData.interactionLabel = o.label;
  group.add(pic);
  built.interactables.push(pic);

  const glass = new THREE.Mesh(new THREE.PlaneGeometry(o.width, o.height), material(0xffffff, { opacity: 0.07, roughness: 0.1 }));
  glass.position.z = 0.05;
  group.add(glass);

  new THREE.TextureLoader().load("images/" + o.file, (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    picMat.map = texture;
    picMat.color.set(0xffffff);
    picMat.emissive.set(0xffffff);
    picMat.emissiveMap = texture;
    picMat.emissiveIntensity = 0.12;
    picMat.needsUpdate = true;
  });
}

function addStationPhotos(scene: THREE.Scene, built: SceneBuild) {
  addPhotoFrame(scene, built, {
    position: [-4.6, 1.9, -6],
    rotationY: Math.PI / 2,
    width: 1.5,
    height: 1.0,
    file: "platform-photo.jpg",
    id: "station_photo",
    label: "Inspect the 1998 platform photograph",
  });
}

/* ---------- Scenes ---------- */

function buildHome(scene: THREE.Scene): SceneBuild {
  scene.background = new THREE.Color(0x060b0d);
  scene.fog = new THREE.FogExp2(0x060b0d, 0.04);
  const built = newBuild(new THREE.Vector3(0.35, 1.68, 6.55), { minX: -5.5, maxX: 5.5, minZ: -7.45, maxZ: 7.45 });
  scene.add(new THREE.HemisphereLight(0x2a4447, 0x0a0a08, 0.32));

  // Room shell
  box(scene, [12, 0.18, 16], [0, -0.1, 0], 0x30241f);
  for (let i = -5; i <= 5; i += 1) box(scene, [0.03, 0.02, 16], [i + 0.5, 0.01, 0], 0x4f362a);
  box(scene, [12, 0.2, 16], [0, 4.5, 0], 0x161e21);
  box(scene, [12, 4.5, 0.2], [0, 2.15, -8], 0x263033);
  box(scene, [0.2, 4.5, 16], [-6, 2.15, 0], 0x202a2c);
  box(scene, [0.2, 4.5, 16], [6, 2.15, 0], 0x202a2c);
  // Peeling plaster patches
  box(scene, [0.95, 0.7, 0.02], [-4.2, 3.0, -7.88], 0x6f6d5e);
  box(scene, [0.6, 0.45, 0.02], [-1.0, 1.2, -7.88], 0x6a685a);
  box(scene, [0.8, 0.5, 0.02], [4.9, 3.6, -7.88], 0x76735f);

  // Desk, diary, radio
  box(scene, [3.8, 0.18, 1.7], [-2.6, 0.82, -4], 0x3c2920);
  box(scene, [0.18, 1.55, 0.18], [-4.25, 0.05, -4.65], 0x3c2920);
  box(scene, [0.18, 1.55, 0.18], [-0.95, 0.05, -4.65], 0x3c2920);
  const diary = box(scene, [0.95, 0.09, 0.7], [-2.8, 0.97, -3.65], 0x3a1d18, {
    id: "home_diary",
    label: "Read Rajiv's diary",
    rotation: [0, -0.18, 0],
    emissive: 0x461a12,
  });
  built.interactables.push(diary);
  const radio = box(scene, [0.85, 0.52, 0.42], [-1.45, 1.16, -4], 0x2a312f, {
    id: "home_radio",
    label: "Tune shortwave radio",
    emissive: 0x173c35,
  });
  built.interactables.push(radio);
  for (let i = 0; i < 3; i += 1) cylinder(scene, 0.045, 0.05, [-1.7 + i * 0.23, 1.2, -3.77], 0xc69b52, { rotation: [Math.PI / 2, 0, 0] });
  const radioLight = new THREE.PointLight(0x4fa39a, 0.5, 3, 2);
  radioLight.position.set(-1.45, 1.4, -3.5);
  scene.add(radioLight);

  // Family photograph (textured)
  addPhotoFrame(scene, built, {
    position: [2.45, 2.15, -7.84],
    rotationY: 0,
    width: 1.9,
    height: 1.27,
    file: "family-photo.jpg",
    id: "home_photo",
    label: "Look closely at the family photograph",
  });

  // Fridge & magnet
  box(scene, [1.4, 2.55, 1.1], [4.55, 1.28, -5], 0x6c7470);
  const magnet = box(scene, [0.7, 0.35, 0.035], [4.18, 1.65, -4.43], 0xd5c8a9, {
    id: "home_magnet",
    label: "Read fridge magnet",
    rotation: [0, 0, -0.06],
  });
  built.interactables.push(magnet);

  // Window, moon and moonlight shaft
  box(scene, [0.18, 2.35, 2.5], [5.87, 2.25, 1.2], 0x1a252a);
  box(scene, [0.12, 2.05, 2.18], [5.75, 2.25, 1.2], 0x0b151a);
  const moon = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24), material(0xbccac4, { emissive: 0x72827e }));
  moon.position.set(5.67, 2.7, 1.3);
  moon.rotation.y = -Math.PI / 2;
  scene.add(moon);
  glowSprite(scene, [5.5, 2.7, 1.3], 0xaecfc8, 2.2, 0.35);
  const shaft = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 2.8),
    new THREE.MeshBasicMaterial({ color: 0xaecfc8, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  );
  shaft.position.set(3.4, 1.9, 1.3);
  shaft.rotation.set(0, Math.PI / 2, -0.38);
  scene.add(shaft);
  const moonlight = new THREE.DirectionalLight(0xa7c9c3, 0.75);
  moonlight.position.set(12, 6, 1);
  const moonTarget = new THREE.Object3D();
  moonTarget.position.set(-2, 0, 0);
  scene.add(moonlight, moonTarget);
  moonlight.target = moonTarget;
  const trainShadow = box(scene, [0.04, 0.13, 1.4], [5.6, 2.69, 2.8], 0x0a0b0b, { opacity: 0.72 });
  built.animated.push((time) => {
    trainShadow.position.z = 2.8 - ((time * 0.12) % 4.4);
  });

  // Pendant lamp
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.9, 6), material(0x111111));
  cord.position.set(-2.2, 3.95, -3.5);
  scene.add(cord);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.42, 0.3, 14, 1, true), material(0x3a4a3c, { roughness: 0.6 }));
  shade.position.set(-2.2, 2.95, -3.5);
  scene.add(shade);
  const lampLight = new THREE.PointLight(0xffc08a, 4.5, 9, 2);
  lampLight.position.set(-2.2, 2.8, -3.5);
  scene.add(lampLight);
  const lampGlow = glowSprite(scene, [-2.2, 2.85, -3.5], 0xffc08a, 1.0, 0.55);
  built.animated.push((time) => {
    const dying = Math.sin(time * 1.3) > 0.988 ? 0.5 : 1;
    const level = (1 + Math.sin(time * 5.7) * 0.015) * dying;
    lampLight.intensity = 4.5 * level;
    lampGlow.material.opacity = 0.55 * level;
  });

  addDust(scene, built, 0xcdbf9e, 90, 0.16);
  expandHome({ scene, interactables: built.interactables, animated: built.animated, colliders: built.colliders, era: "present" });
  return built;
}

function buildStation(scene: THREE.Scene, powerOn: boolean, gateOpen: boolean, collectedIds: string[], era: "present" | "wrong" = "present"): SceneBuild {
  scene.background = new THREE.Color(0x05100f);
  scene.fog = new THREE.FogExp2(0x05100f, 0.036);
  const built = newBuild(new THREE.Vector3(0, 1.68, 16), { minX: -17.1, maxX: 4.1, minZ: -19, maxZ: 19 });
  built.colliders.push({ minX: -4.95, maxX: -4.65, minZ: -20, maxZ: 0 }, { minX: -4.95, maxX: -4.65, minZ: 10, maxZ: 20 });
  addStationShell(scene, false);
  scene.add(new THREE.HemisphereLight(0x3d6f6d, 0x0a1312, powerOn ? 0.52 : 0.24));

  const clock = addClock(scene, [-0.3, 3.2, -19.55]);
  built.animated.push((time) => {
    clock.minute.rotation.z = -time * 0.08;
  });

  if (!collectedIds.includes("fuse")) {
    built.interactables.push(
      cylinder(scene, 0.12, 0.75, [-2.75, 0.82, 9], 0xd2c8a5, {
        id: "station_fuse",
        label: "Take 60-amp cartridge fuse",
        emissive: 0x594d2b,
        rotation: [0, 0, Math.PI / 2],
      }),
    );
  }
  if (!collectedIds.includes("brass-key")) {
    const key = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.035, 8, 16), material(0xc69a45, { emissive: 0x5a3f12, metalness: 0.8 })) as Interactive;
    key.position.set(1.9, 0.78, 5.5);
    key.rotation.x = Math.PI / 2;
    key.userData.interactionId = "station_key";
    key.userData.interactionLabel = "Take brass maintenance key";
    scene.add(key);
    built.interactables.push(key);
  }

  built.interactables.push(
    box(scene, [0.18, 1.35, 0.9], [-4.58, 1.45, 0.5], powerOn ? 0x355c50 : 0x4f4d47, {
      id: "station_fusebox",
      label: powerOn ? "Inspect humming fuse box" : "Open fuse box",
      emissive: powerOn ? 0x256456 : undefined,
    }),
  );
  built.interactables.push(
    box(scene, [0.25, 0.85, 0.6], [-4.52, 1.5, -3], 0x513c31, {
      id: "station_isolator",
      label: "Throw main isolator",
      emissive: powerOn ? 0x21684f : undefined,
    }),
  );

  box(scene, [0.15, 2.8, 3.8], [3.75, 1.42, -7], gateOpen ? 0x243433 : 0x292e2d, { opacity: gateOpen ? 0.22 : 0.85 });
  built.interactables.push(
    box(scene, [0.2, 0.6, 0.42], [3.62, 1.45, -5.2], 0x1f2625, {
      id: "station_keypad",
      label: "Use clock-room keypad",
      emissive: powerOn ? 0x195b50 : 0x28100d,
    }),
  );
  if (!powerOn) {
    const keypadRed = new THREE.PointLight(0x9a3328, 1.2, 6, 2);
    keypadRed.position.set(3.2, 1.6, -5);
    scene.add(keypadRed);
  }

  built.interactables.push(
    box(scene, [1.25, 2.15, 0.7], [-3.8, 1.08, 13], 0x263638, {
      id: "station_vending",
      label: "Use ticket vending machine",
    }),
  );
  const vendorText = textSprite("TICKETS / PROBABLY", "#c1ab7f", "rgba(15,25,26,.9)", 0.36);
  vendorText.position.set(-3.42, 1.65, 13);
  vendorText.rotation.y = Math.PI / 2;
  scene.add(vendorText);

  // Signal lamps at the track edge
  glowSprite(scene, [4.2, 1.6, -2], 0xff3a2a, 0.9, 0.7);
  glowSprite(scene, [4.2, 1.6, 6], 0x52ff9a, 0.9, powerOn ? 0.6 : 0.1);

  // Fluorescent tubes under the canopy
  [-16, -6, 4, 14].forEach((z, i) => {
    tubeLight(scene, built.animated, [-1.2, 3.92, z], 0xa9e6dc, 4.2, 10, powerOn, i * 1.7 + 0.3, 0.6);
  });

  if (gateOpen) addTrain(scene, built, false, "station_train");

  addStationPhotos(scene, built);
  expandStation({ scene, interactables: built.interactables, animated: built.animated, colliders: built.colliders, era });

  // A few townsfolk in the bazaar and the ticket hall.
  spawnWalker(scene, built, { points: [[-12.4, -8.0], [-12.4, 7.0]], pingpong: true, speed: 0.52, pause: [3, 6], coat: 0x4d5650, hair: 0x25211d, trouser: 0x2c2a25, base: 0 });
  spawnWalker(scene, built, { points: [[-14.3, 6.5], [-14.3, -7.5]], pingpong: true, speed: 0.43, pause: [4, 8], coat: 0x5d4639, hair: 0x1c1815, base: 0, watch: true });
  spawnWalker(scene, built, { points: [[-6.4, 3.4], [-6.4, 7.4]], pingpong: true, speed: 0.36, pause: [5, 9], coat: 0x545b4b, hair: 0x2e2822, base: 0 });

  // The Conductor: stands still, owl head when stared at too long.
  spawnWalker(scene, built, {
    id: "station_conductor",
    label: "Approach the Conductor",
    points: [[0.2, -14.8]],
    coat: 0x1b2220,
    hat: "cap",
    skin: 0x7a5542,
    owl: true,
    watch: true,
    base: FLOOR_STATION,
  });

  // A ghostly passenger who pacing the platform, forever waiting for the 23:58.
  spawnWalker(scene, built, {
    points: [[1.6, -9], [1.6, 9]],
    pingpong: true,
    speed: 0.55,
    pause: [4, 8],
    coat: 0x9aa8a6,
    trouser: 0x6a7472,
    hair: 0x3a3a3a,
    ghost: true,
    scale: 1,
  });

  addDust(scene, built, 0xbfd6cf, 110, 0.14);
  return built;
}

function buildPast(scene: THREE.Scene, collectedIds: string[]): SceneBuild {
  scene.background = new THREE.Color(0x2a1b12);
  scene.fog = new THREE.FogExp2(0x2a1b12, 0.022);
  const built = newBuild(new THREE.Vector3(0, 1.68, 14), { minX: -17.1, maxX: 4.1, minZ: -19, maxZ: 19 });
  built.colliders.push({ minX: -4.95, maxX: -4.65, minZ: -20, maxZ: 0 }, { minX: -4.95, maxX: -4.65, minZ: 10, maxZ: 20 });
  addStationShell(scene, true);
  scene.add(new THREE.HemisphereLight(0xb07440, 0x2a180d, 0.75));
  addTrain(scene, built, true);
  addStationPhotos(scene, built);

  const clock = addClock(scene, [-0.3, 3.2, -19.55], true);
  built.animated.push((time) => {
    clock.minute.rotation.z = time * 0.04;
  });

  // Incandescent bulbs along the canopy
  for (let z = -14; z <= 14; z += 7) {
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), material(0xffc070, { emissive: 0xffb050, emissiveIntensity: 1.4 }));
    bulb.position.set(-2.1, 3.5, z);
    scene.add(bulb);
    const light = new THREE.PointLight(0xffb85a, 5, 13, 2);
    light.position.set(-2.1, 3.4, z);
    scene.add(light);
    const glow = glowSprite(scene, [-2.1, 3.5, z], 0xffb85a, 1.5, 0.7);
    built.animated.push((t) => {
      const level = 1 + Math.sin(t * 2.1 + z) * 0.03 + Math.sin(t * 17 + z) * 0.012;
      light.intensity = 4.8 * level;
      glow.material.opacity = 0.7 * level;
    });
  }

  if (!collectedIds.includes("maintenance-log")) {
    built.interactables.push(
      box(scene, [0.85, 0.08, 0.6], [-2.35, 0.92, -11.3], 0x66543b, {
        id: "past_log",
        label: "Read Rajiv's maintenance log",
        emissive: 0x49351d,
      }),
    );
  }
  built.interactables.push(
    box(scene, [0.95, 0.09, 0.72], [-1.15, 0.92, -11.45], 0x49251e, {
      id: "past_register",
      label: "Examine the arrival register",
      emissive: 0x411a15,
    }),
  );
  box(scene, [3.2, 0.2, 1.4], [-2, 0.75, -11.5], 0x493020);
  box(scene, [0.18, 1.45, 0.18], [-3.3, 0, -11.9], 0x493020);
  box(scene, [0.18, 1.45, 0.18], [-0.7, 0, -11.9], 0x493020);
  for (let i = 0; i < 3; i += 1) {
    const samosa = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.22, 3), material(0xa9672d));
    samosa.position.set(-2.7 + i * 0.25, 1, -11.6);
    samosa.rotation.x = Math.PI;
    scene.add(samosa);
  }

  // Chai stall with tea cup
  box(scene, [1.6, 0.9, 0.9], [1.7, 0.45, 9.4], 0x5a3a22);
  built.interactables.push(
    cylinder(scene, 0.12, 0.24, [1.1, 0.72, 8.1], 0xb7763a, {
      id: "past_chai_cup",
      label: "Inspect the familiar chai cup",
    }),
  );

  // Staff
  spawnWalker(scene, built, {
    id: "past_guard",
    label: "Speak with Suresh, the guard",
    points: [[-2.0, -8], [-1.8, 7]],
    pingpong: true,
    speed: 0.9,
    pause: [3, 6],
    watch: true,
    coat: 0x8b4930,
    hat: "cap",
    moustache: true,
  });
  spawnWalker(scene, built, {
    id: "past_clerk",
    label: "Ask the ticket clerk",
    points: [[-3.65, -3], [-3.4, -2.5]],
    pingpong: true,
    speed: 0.25,
    pause: [6, 12],
    watch: true,
    coat: 0x5b6242,
    hair: 0x2b2420,
  });
  spawnWalker(scene, built, {
    id: "past_chai",
    label: "Have tea with Ramesh",
    points: [[1.8, 7.6], [1.5, 8.9]],
    pingpong: true,
    speed: 0.35,
    pause: [5, 10],
    watch: true,
    coat: 0xb06b32,
    hair: 0x1d1a18,
    moustache: true,
  });

  // Passengers wandering with purpose (or none)
  const coats = [0x64543f, 0x4d5d53, 0x5a3f3a, 0x3b4a5e, 0x6b5c3e, 0x55604a];
  coats.forEach((coat, i) => {
    const x = [-1.2, 0.2, 1.4, -0.4, 0.9, 2.2][i];
    const standing = i === 4;
    spawnWalker(scene, built, {
      points: standing ? [[x, -2]] : [[x, -10 + i * 2.2], [x + (i % 2 ? 0.7 : -0.6), -3 + i * 1.3]],
      pingpong: !standing,
      speed: standing ? 0 : 0.6 + (i % 3) * 0.22,
      pause: [1.5, 4.5],
      coat,
      hair: i % 2 ? 0x1f1b18 : 0x2c2622,
      trouser: 0x2a2622,
      hat: i === 2 ? "cap" : "none",
    });
  });

  expandStation({ scene, interactables: built.interactables, animated: built.animated, colliders: built.colliders, era: "past" });
  // Townsfolk walking the bazaar.
  spawnWalker(scene, built, { points: [[-12.3, -8.5], [-12.3, 6.5]], pingpong: true, speed: 0.68, pause: [2, 5], coat: 0x6b543e, hair: 0x221d19, trouser: 0x2f2922, base: 0 });
  spawnWalker(scene, built, { points: [[-14.4, 8.5], [-14.4, -7]], pingpong: true, speed: 0.55, pause: [3, 6], coat: 0x4d5f55, hair: 0x181614, base: 0 });
  spawnWalker(scene, built, { points: [[-10.8, -4], [-10.8, 10]], pingpong: true, speed: 0.8, pause: [1.5, 4], coat: 0x7d4b39, hair: 0x33261f, moustache: true, base: 0 });
  spawnWalker(scene, built, { points: [[-6.3, 3.7], [-6.3, 7.2]], pingpong: true, speed: 0.45, pause: [4, 8], coat: 0x5d5a42, hair: 0x2b251f, base: 0, watch: true });
  addDust(scene, built, 0xffd08a, 120, 0.22);
  return built;
}

function buildWrong(scene: THREE.Scene, gateOpen: boolean): SceneBuild {
  const built = buildStation(scene, true, false, ["fuse", "brass-key"], "wrong");
  spawnWalker(scene, built, {
    id: "wrong_meera",
    label: "Speak with Meera Sharma",
    points: [[-0.6, 6], [-0.6, -1.5]],
    pingpong: true,
    speed: 0.8,
    pause: [2, 4],
    watch: true,
    coat: 0x5b3540,
    hair: 0x2a1a18,
    trouser: 0x262226,
  });
  built.interactables.push(
    box(scene, [2.1, 0.12, 1.5], [1.8, 0.34, -14], 0x2e3533, {
      id: "wrong_hatch",
      label: gateOpen ? "Descend below Platform 1" : "Inspect sealed maintenance hatch",
      emissive: gateOpen ? 0x285e54 : 0x211817,
    }),
  );
  box(scene, [1.7, 0.07, 0.16], [-2.4, 1.3, -4.65], 0xe3d24a, { rotation: [0.08, 0, 0.04] });
  const changedSign = textSprite("SURAJPUR HALT / FILE UNDER REVIEW", "#ddd2b8", "rgba(25,18,16,.92)", 0.48);
  changedSign.position.set(-0.6, 2.25, -19.52);
  scene.add(changedSign);
  // The family photograph hangs here now, updated.
  addPhotoFrame(scene, built, {
    position: [-4.6, 1.9, -12],
    rotationY: Math.PI / 2,
    width: 1.5,
    height: 1.0,
    file: "family-photo-changed.jpg",
    id: "wrong_family_photo",
    label: "Inspect the updated family photograph",
  });
  return built;
}

function buildBunker(scene: THREE.Scene, bunkerPower: boolean, collectedIds: string[]): SceneBuild {
  scene.background = new THREE.Color(0x050808);
  scene.fog = new THREE.FogExp2(0x050808, 0.047);
  const built = newBuild(new THREE.Vector3(0, 1.68, 12), { minX: -14.9, maxX: 11.4, minZ: -14.1, maxZ: 12.7 });
  scene.add(new THREE.HemisphereLight(0x1f4a44, 0x070909, bunkerPower ? 0.42 : 0.22));

  box(scene, [15, 0.3, 31], [0, -0.15, 0], 0x252a29);
  box(scene, [15, 4.5, 0.35], [0, 2.2, -15], 0x2d3231);
  // Side walls are split around the machine-room, control-room and store-room doorways.
  box(scene, [0.35, 4.5, 8.6], [-7.3, 2.2, -11.2], 0x292e2d);
  box(scene, [0.35, 4.5, 10.7], [-7.3, 2.2, 0.15], 0x292e2d);
  box(scene, [0.35, 4.5, 7.2], [-7.3, 2.2, 11.9], 0x292e2d);
  box(scene, [0.35, 4.5, 8.6], [7.3, 2.2, -11.2], 0x292e2d);
  box(scene, [0.35, 4.5, 20.7], [7.3, 2.2, 5.15], 0x292e2d);
  built.colliders.push(
    { minX: -7.48, maxX: -7.12, minZ: -15.5, maxZ: -6.9 },
    { minX: -7.48, maxX: -7.12, minZ: -5.2, maxZ: 5.5 },
    { minX: -7.48, maxX: -7.12, minZ: 8.3, maxZ: 15.5 },
    { minX: 7.12, maxX: 7.48, minZ: -15.5, maxZ: -6.9 },
    { minX: 7.12, maxX: 7.48, minZ: -5.2, maxZ: 15.5 },
  );
  for (let z = -12; z <= 12; z += 6) {
    box(scene, [14.5, 0.22, 0.22], [0, 3.85, z], 0x414847);
    box(scene, [0.22, 4, 0.22], [-5.7, 2, z], 0x414847);
    box(scene, [0.22, 4, 0.22], [5.7, 2, z], 0x414847);
  }

  built.interactables.push(
    box(scene, [2.8, 1.7, 2], [-4.8, 0.85, 8], 0x424943, {
      id: "bunker_generator",
      label: "Route generator power",
      emissive: bunkerPower ? 0x205b3e : 0x381511,
    }),
  );
  for (let i = 0; i < 3; i += 1) cylinder(scene, 0.28, 1.15, [-5.45 + i * 0.65, 1.75, 8], 0x4f5550, { rotation: [Math.PI / 2, 0, 0] });

  const tapePositions: Array<[number, number, number]> = [
    [-3.2, 0.55, 3],
    [4.9, 0.75, 6],
    [-5.4, 0.62, -2],
    [3.8, 0.7, -5],
    [-2.1, 0.6, -10],
  ];
  tapePositions.forEach((position, index) => {
    const id = `recording-${index + 1}`;
    if (collectedIds.includes(id)) return;
    const tape = box(scene, [0.56, 0.15, 0.38], position, 0x4b3427, {
      id: `bunker_tape_${index + 1}`,
      label: `Collect audio reel ${index + 1}/5`,
      emissive: 0x543018,
    });
    built.interactables.push(tape);
    built.animated.push((time) => {
      tape.rotation.y = time * 0.3 + index;
    });
  });

  built.interactables.push(
    box(scene, [3.2, 1.15, 1.2], [2.8, 0.6, -9], 0x303b3b, {
      id: "bunker_console",
      label: bunkerPower ? "Open regulator control" : "Inspect dead control console",
      emissive: bunkerPower ? 0x246d61 : undefined,
    }),
  );
  for (let i = 0; i < 5; i += 1) {
    cylinder(scene, 0.1, 0.05, [1.9 + i * 0.43, 1.22, -8.7], bunkerPower ? 0x63c797 : 0x481c19, {
      rotation: [Math.PI / 2, 0, 0],
      emissive: bunkerPower ? 0x2a6c50 : 0x28100f,
    });
  }

  const regulator = new THREE.Mesh(new THREE.TorusGeometry(1.65, 0.34, 12, 32), material(0x59615f, { emissive: bunkerPower ? 0x25544c : 0x131817, metalness: 0.75 })) as Interactive;
  regulator.position.set(0, 1.9, -14.35);
  regulator.userData.interactionId = "bunker_regulator";
  regulator.userData.interactionLabel = bunkerPower ? "Approach the Hour-Glass Regulator" : "The regulator is dormant";
  scene.add(regulator);
  built.interactables.push(regulator);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.75, 18, 12), material(0x6ab0a5, { emissive: bunkerPower ? 0x397f75 : 0x101c1b, opacity: 0.72 }));
  core.position.copy(regulator.position);
  scene.add(core);
  const coreGlow = glowSprite(scene, [0, 1.9, -14.2], 0x6ad8c0, 4.2, bunkerPower ? 0.45 : 0.04);
  built.animated.push((time) => {
    regulator.rotation.z = bunkerPower ? time * 0.15 : 0;
    core.scale.setScalar(bunkerPower ? 1 + Math.sin(time * 2.2) * 0.08 : 0.85);
    coreGlow.material.opacity = (bunkerPower ? 0.45 : 0.04) * (1 + Math.sin(time * 2.2) * 0.1);
  });

  // Fluorescent banks, failing emergency tubes or restored power
  tubeLight(scene, built.animated, [-3, 3.7, -8], 0x9fd8c2, 4.5, 11, bunkerPower, 1.1, 0.8);
  tubeLight(scene, built.animated, [3, 3.7, 1], 0x9fd8c2, 4.5, 11, bunkerPower, 2.6, 0.8);
  tubeLight(scene, built.animated, [-3, 3.7, 8], 0x9fd8c2, 4.5, 11, bunkerPower, 4.2, 0.8);

  // Distant red emergency glow when power is still dead.
  if (!bunkerPower) {
    const beaconTarget = new THREE.Object3D();
    scene.add(beaconTarget);
    const beacon = new THREE.SpotLight(0xff3b2b, 2, 14, 0.42, 0.7, 1.8);
    beacon.position.set(-5.6, 3.4, -12.5);
    beacon.target = beaconTarget;
    scene.add(beacon);
    glowSprite(scene, [-5.6, 3.35, -13.8], 0xff3b2b, 1.1, 0.4);
    built.animated.push((t) => {
      beaconTarget.position.set(-5.6 + Math.sin(t * 0.9) * 2.4, 0, -13.8);
      beacon.intensity = 0.8 + 1.7 * Math.pow(Math.max(0, Math.sin(t * 2.2)), 3);
    });
  }

  // The blurred man who is always Rajiv
  spawnWalker(scene, built, {
    id: "bunker_ghost",
    label: "Approach the blurred figure",
    points: [[-3.2, -4], [-3.2, 4], [2.6, 4], [2.6, -4]],
    speed: 0.5,
    pause: [2, 4],
    coat: 0x2c4a6e,
    trouser: 0x1a2530,
    hat: "cap",
    moustache: true,
    ghost: true,
    base: FLOOR_HOME,
  });

  addDust(scene, built, 0x9fd8c2, 80, 0.14);
  expandBunker({ scene, interactables: built.interactables, animated: built.animated, colliders: built.colliders, era: "present" }, bunkerPower);
  return built;
}

/* ---------- Torch ---------- */

function createTorch(camera: THREE.Camera): Torch {
  const hand = new THREE.Group();
  hand.position.set(0.22, -0.23, -0.36);
  camera.add(hand);

  const metal = material(0x2b2f2e, { roughness: 0.4, metalness: 0.7 });
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.034, 0.24, 14), metal);
  barrel.rotation.x = Math.PI / 2;
  const headRing = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.046, 0.08, 16), material(0x47504d, { roughness: 0.3, metalness: 0.8 }));
  headRing.rotation.x = Math.PI / 2;
  headRing.position.z = -0.15;
  const lensMat = new THREE.MeshStandardMaterial({ color: 0x1a1a18, emissive: 0xfff1cf, emissiveIntensity: 0, roughness: 0.2 });
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.05, 16), lensMat);
  lens.rotation.y = Math.PI;
  lens.position.z = -0.192;
  const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.36), material(0x2c3536, { roughness: 0.95 }));
  sleeve.position.set(-0.02, -0.07, 0.2);
  sleeve.rotation.x = 0.12;
  const knuckles = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.12), material(0x8d6651, { roughness: 0.6 }));
  knuckles.position.set(-0.01, -0.03, 0);
  hand.add(barrel, headRing, lens, sleeve, knuckles);

  const spot = new THREE.SpotLight(0xffe9c4, 0, 26, 0.52, 0.62, 2);
  spot.position.set(0.22, -0.23, -0.56);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.bias = -0.0003;
  spot.shadow.normalBias = 0.02;
  spot.shadow.camera.near = 0.1;
  spot.shadow.camera.far = 26;
  const target = new THREE.Object3D();
  target.position.set(0, -0.06, -8);
  camera.add(spot, target);
  spot.target = target;

  // A weaker wide cone fills in the near field so the torch behaves like a real reflector beam.
  const spill = new THREE.SpotLight(0xffefd6, 0, 10, 1.1, 0.9, 2);
  spill.position.set(0.18, -0.2, -0.5);
  const spillTarget = new THREE.Object3D();
  spillTarget.position.set(0, -0.55, -4.5);
  camera.add(spill, spillTarget);
  spill.target = spillTarget;

  // Volumetric beam: additive cone that fades with distance and shimmers.
  const beamGeo = new THREE.CylinderGeometry(0.012, 3.4, 9, 28, 1, true);
  beamGeo.translate(0, -4.5, 0);
  beamGeo.rotateX(Math.PI / 2);
  const beamMat = new THREE.ShaderMaterial({
    uniforms: { uStrength: { value: 0 }, uTime: { value: 0 } },
    vertexShader: `
      varying float vZ;
      void main() {
        vZ = position.z;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform float uStrength;
      uniform float uTime;
      varying float vZ;
      void main() {
        float t = clamp(-vZ / 9.0, 0.0, 1.0);
        float fall = pow(1.0 - t, 2.4);
        float shimmer = 0.94 + 0.06 * sin(uTime * 18.0 + t * 4.0);
        vec3 warm = vec3(1.0, 0.91, 0.72);
        vec3 col = warm * fall * shimmer * 0.08 * uStrength;
        gl_FragColor = vec4(col, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.set(0.22, -0.23, -0.56);
  camera.add(beam);

  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glowTexture(), color: 0xfff1d0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  halo.position.set(0.22, -0.23, -0.6);
  halo.scale.setScalar(0.3);
  camera.add(halo);

  return { spot, spill, beamMat, lensMat, halo, level: 0, stutter: 0 };
}

function updateTorch(torch: Torch, on: boolean, battery: number, time: number, dt: number) {
  torch.stutter = Math.max(0, torch.stutter - dt);
  if (on && battery < 0.18 && torch.stutter <= 0 && Math.random() < dt * 1.4) {
    torch.stutter = THREE.MathUtils.randFloat(0.08, 0.26);
  }
  const stuttering = torch.stutter > 0;
  const wobble = 0.98 + Math.sin(time * 11.3) * 0.01 + Math.sin(time * 3.2 + 1.2) * 0.012;
  const charge = 0.25 + 0.75 * Math.min(1, battery * 4);
  const target = on ? wobble * charge * (stuttering ? 0.15 : 1) : 0;
  torch.level += (target - torch.level) * (1 - Math.exp(-(stuttering ? 36 : 9) * dt));
  torch.spot.intensity = 28 * torch.level;
  torch.spot.visible = torch.level > 0.01;
  torch.spill.intensity = 6.2 * torch.level;
  torch.spill.visible = torch.level > 0.01;
  torch.beamMat.uniforms.uStrength.value = torch.level;
  torch.beamMat.uniforms.uTime.value = time;
  torch.lensMat.emissiveIntensity = on ? 1.0 + 1.4 * torch.level : 0;
  torch.halo.material.opacity = 0.6 * torch.level;
}

/* ---------- Epilogue scenes ---------- */

function buildEpilogueSave(scene: THREE.Scene): SceneBuild {
  scene.background = new THREE.Color(0x2a1d12);
  scene.fog = new THREE.FogExp2(0x2a1d12, 0.055);
  const built = newBuild(new THREE.Vector3(0.4, 1.68, 6.55), { minX: -5.5, maxX: 5.5, minZ: -7.45, maxZ: 7.45 });
  scene.add(new THREE.HemisphereLight(0x8f6240, 0x1a0f08, 0.55));
  box(scene, [12, 0.18, 16], [0, -0.1, 0], 0x3a2b20);
  box(scene, [12, 0.2, 16], [0, 4.5, 0], 0x261a11);
  box(scene, [12, 4.5, 0.2], [0, 2.15, -8], 0x3a2e22);
  box(scene, [0.2, 4.5, 16], [-6, 2.15, 0], 0x322820);
  box(scene, [0.2, 4.5, 16], [6, 2.15, 0], 0x322820);
  box(scene, [4.4, 0.015, 3.2], [-1.9, 0.012, 2.25], 0x6d4a2f);
  box(scene, [3.0, 0.45, 1.05], [-2.0, 0.3, 2.75], 0x5e4432);
  box(scene, [3.0, 1.0, 0.24], [-2.0, 0.92, 3.26], 0x543a2a);
  box(scene, [1.6, 0.08, 0.82], [-1.9, 0.48, 1.25], 0xa38a6e);
  const teacup = cylinder(scene, 0.08, 0.1, [-1.75, 0.57, 1.3], 0xd3c8a9) as Interactive;
  teacup.userData.interactionId = "epilogue_teacup";
  teacup.userData.interactionLabel = "The tea is still warm. It was not made for you.";
  built.interactables.push(teacup);
  box(scene, [1.9, 0.09, 1.0], [2.85, 0.79, 0.9], 0x9e8459);
  for (let i = 0; i < 4; i += 1) cylinder(scene, 0.1, 0.02, [2.5 + (i % 2) * 0.7, 0.85, 0.65 + Math.floor(i / 2) * 0.5], 0xd6c9a6);
  const strangerGroup = new THREE.Group();
  strangerGroup.position.set(2.85, 0.28, 0.9);
  strangerGroup.rotation.y = 0.4;
  scene.add(strangerGroup);
  const strangerBody = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.48, 1.25, 8), material(0x6b4a32)) as Interactive;
  strangerBody.position.y = 0.84;
  strangerBody.castShadow = true;
  const strangerHead = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 9), material(0x8d6651)) as Interactive;
  strangerHead.position.y = 1.64;
  strangerHead.castShadow = true;
  const moustache = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.03, 0.05), material(0x2a221a));
  moustache.position.set(0, 1.58, 0.22);
  strangerGroup.add(strangerBody, strangerHead, moustache);
  strangerBody.userData.interactionId = "epilogue_stranger";
  strangerBody.userData.interactionLabel = "Rajiv looks up. He does not know your name.";
  strangerHead.userData.interactionId = "epilogue_stranger";
  strangerHead.userData.interactionLabel = "Rajiv looks up. He does not know your name.";
  built.interactables.push(strangerBody, strangerHead);
  box(scene, [1.4, 2.55, 1.1], [4.55, 1.28, -5], 0x7c7f7c);
  const magnet = box(scene, [0.95, 0.3, 0.035], [4.18, 1.65, -4.43], 0xe0d6b8, { rotation: [0, 0, -0.05] }) as Interactive;
  magnet.userData.interactionId = "epilogue_magnet";
  magnet.userData.interactionLabel = "Read the fridge magnet: THE TRAIN WAS ON TIME. YOU WERE NOT.";
  built.interactables.push(magnet);
  addPhotoFrame(scene, built, {
    position: [2.45, 2.15, -7.84],
    rotationY: 0,
    width: 1.9,
    height: 1.27,
    file: "family-photo-changed.jpg",
    id: "epilogue_photo",
    label: "The photograph. You are not in it.",
  });
  const pendant = new THREE.PointLight(0xffbd78, 6, 10, 2);
  pendant.position.set(-2.2, 2.8, -3.5);
  scene.add(pendant);
  glowSprite(scene, [-2.2, 2.85, -3.5], 0xffc58a, 1.3, 0.7);
  const lampB = new THREE.PointLight(0xffc58a, 3, 7, 2);
  lampB.position.set(3.2, 1.6, 5.5);
  scene.add(lampB);
  const radio = box(scene, [0.85, 0.52, 0.42], [-1.45, 1.16, -4], 0x3a413d, { emissive: 0x1d4640 }) as Interactive;
  radio.userData.interactionId = "epilogue_radio";
  radio.userData.interactionLabel = "All India Radio is playing a song your father used to hum.";
  built.interactables.push(radio);
  addDust(scene, built, 0xffd89c, 80, 0.28);
  return built;
}

function buildEpiloguePreserve(scene: THREE.Scene): SceneBuild {
  scene.background = new THREE.Color(0x060b0d);
  scene.fog = new THREE.FogExp2(0x060b0d, 0.055);
  const built = newBuild(new THREE.Vector3(0.4, 1.68, 6.55), { minX: -5.5, maxX: 5.5, minZ: -7.45, maxZ: 7.45 });
  scene.add(new THREE.HemisphereLight(0x2a4447, 0x080808, 0.28));
  box(scene, [12, 0.18, 16], [0, -0.1, 0], 0x2d2218);
  box(scene, [12, 0.2, 16], [0, 4.5, 0], 0x141a1b);
  box(scene, [12, 4.5, 0.2], [0, 2.15, -8], 0x243034);
  box(scene, [0.2, 4.5, 16], [-6, 2.15, 0], 0x1f292c);
  box(scene, [0.2, 4.5, 16], [6, 2.15, 0], 0x1f292c);
  box(scene, [4.4, 0.015, 3.2], [-1.9, 0.012, 2.25], 0x4b3a2a);
  box(scene, [3.0, 0.45, 1.05], [-2.0, 0.3, 2.75], 0x3e3830);
  box(scene, [3.0, 1.0, 0.24], [-2.0, 0.92, 3.26], 0x363028);
  box(scene, [1.6, 0.08, 0.82], [-1.9, 0.48, 1.25], 0x7d6a52);
  const envelope = box(scene, [0.55, 0.02, 0.35], [-1.7, 0.53, 1.2], 0xd6c9a6) as Interactive;
  envelope.userData.interactionId = "epilogue_envelope";
  envelope.userData.interactionLabel = "Open the envelope. It has no stamp.";
  built.interactables.push(envelope);
  box(scene, [1.9, 0.09, 1.0], [2.85, 0.79, 0.9], 0x6f5a3e);
  box(scene, [1.4, 2.55, 1.1], [4.55, 1.28, -5], 0x5e6764);
  addPhotoFrame(scene, built, {
    position: [2.45, 2.15, -7.84],
    rotationY: 0,
    width: 1.9,
    height: 1.27,
    file: "family-photo.jpg",
    id: "epilogue_photo",
    label: "The original photograph. The child's face is still blank.",
  });
  const pendant = new THREE.PointLight(0xb3c0b8, 2.8, 8, 2);
  pendant.position.set(-2.2, 2.8, -3.5);
  scene.add(pendant);
  glowSprite(scene, [-2.2, 2.85, -3.5], 0xc5d4c8, 0.9, 0.3);
  const moon = new THREE.DirectionalLight(0xa7c9c3, 0.6);
  moon.position.set(12, 6, 1);
  const moonTarget = new THREE.Object3D();
  moonTarget.position.set(-2, 0, 0);
  scene.add(moon, moonTarget);
  moon.target = moonTarget;
  addDust(scene, built, 0xb9ccc5, 70, 0.14);
  return built;
}

function buildEpilogueUnwritten(scene: THREE.Scene): SceneBuild {
  scene.background = new THREE.Color(0x0a1214);
  scene.fog = new THREE.FogExp2(0x0a1214, 0.036);
  const built = newBuild(new THREE.Vector3(0, 1.68, -12), { minX: -4.2, maxX: 4.1, minZ: -19, maxZ: 6 });
  scene.add(new THREE.HemisphereLight(0x2a3f3f, 0x06090a, 0.42));
  box(scene, [9, 0.55, 26], [-0.5, 0, -6], 0x384240);
  box(scene, [0.28, 0.12, 26], [3.92, 0.34, -6], 0xb9a465);
  box(scene, [8.2, 4.8, 0.3], [-0.6, 2.4, -20], 0x3a4444);
  box(scene, [0.14, 0.14, 26], [5.2, -0.22, -6], 0x5a5d5c);
  box(scene, [0.14, 0.14, 26], [6.25, -0.22, -6], 0x5a5d5c);
  const clockFace = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.12, 24), material(0xd2c6a7, { emissive: 0x3d3728, emissiveIntensity: 0.35 }));
  clockFace.rotation.x = Math.PI / 2;
  clockFace.position.set(-0.3, 3.2, -19.55);
  scene.add(clockFace);
  const minute = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.72, 0.04), material(0x161410));
  minute.position.set(-0.3, 3.34, -19.45);
  minute.rotation.z = -0.38;
  scene.add(minute);
  const hour = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.5, 0.04), material(0x161410));
  hour.position.set(-0.18, 3.35, -19.46);
  hour.rotation.z = -0.38;
  scene.add(hour);
  const sign = textSprite("SURAJPUR HALT / 13:13", "#d9caaa", "rgba(8,18,19,.9)", 0.78);
  sign.position.set(-0.4, 2.7, -19.75);
  scene.add(sign);
  const conductorGroup = new THREE.Group();
  conductorGroup.position.set(0.2, 0.3, -5.2);
  scene.add(conductorGroup);
  const condBody = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.48, 1.25, 8), material(0x1b2220)) as Interactive;
  condBody.position.y = 0.84;
  condBody.castShadow = true;
  const condHead = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 9), material(0x8d6651)) as Interactive;
  condHead.position.y = 1.64;
  condHead.rotation.y = Math.PI;
  condHead.castShadow = true;
  const condCap = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.31, 0.12, 12), material(0x171b1b));
  condCap.position.y = 1.88;
  condCap.rotation.y = Math.PI;
  conductorGroup.add(condBody, condHead, condCap);
  condBody.userData.interactionId = "epilogue_conductor";
  condBody.userData.interactionLabel = "The Conductor offers you a phone. It is perfectly ordinary.";
  condHead.userData.interactionId = "epilogue_conductor";
  condHead.userData.interactionLabel = "The Conductor offers you a phone. It is perfectly ordinary.";
  built.interactables.push(condBody, condHead);
  const phone = box(scene, [0.12, 0.008, 0.07], [0, 0.34, -11], 0x1a1c1c, { emissive: 0x307562, metalness: 0.7 }) as Interactive;
  phone.userData.interactionId = "epilogue_phone";
  phone.userData.interactionLabel = "Pick up the phone. 1 notification: Your father liked your status.";
  built.interactables.push(phone);
  tubeLight(scene, built.animated, [-1.2, 3.92, -10], 0x8fc8bc, 2.4, 9, true, 1, 0.3);
  tubeLight(scene, built.animated, [-1.2, 3.92, 2], 0x8fc8bc, 2.0, 8, true, 3, 0.3);
  glowSprite(scene, [4.2, 1.6, -2], 0xff4a3a, 0.9, 0.5);
  glowSprite(scene, [4.2, 1.6, -10], 0x62ffa4, 0.9, 0.4);
  const moonDisc = new THREE.Mesh(new THREE.CircleGeometry(0.45, 24), material(0xbccac4, { emissive: 0x72827e }));
  moonDisc.position.set(2.8, 5.8, -18);
  scene.add(moonDisc);
  glowSprite(scene, [2.8, 5.8, -18], 0xaecfc8, 1.6, 0.3);
  addDust(scene, built, 0xc5d8d2, 90, 0.18);
  return built;
}

/* ---------- Component ---------- */

export default function GameWorld({
  sceneId,
  active,
  flashlightOn,
  powerOn,
  gateOpen,
  bunkerPower,
  collectedIds,
  onInteract,
  onPrompt,
  onNote,
}: GameWorldProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const onInteractRef = useRef(onInteract);
  const onPromptRef = useRef(onPrompt);
  const onNoteRef = useRef(onNote);
  const activeRef = useRef(active);
  const clearInputRef = useRef<(() => void) | null>(null);
  const flashlightRef = useRef(flashlightOn);
  const batteryRef = useRef(1);
  const viewRef = useRef<{ scene: WorldScene; x: number; z: number; yaw: number; pitch: number } | null>(null);

  useEffect(() => {
    onInteractRef.current = onInteract;
    onPromptRef.current = onPrompt;
    onNoteRef.current = onNote;
    activeRef.current = active;
    flashlightRef.current = flashlightOn;
    if (!active) {
      clearInputRef.current?.();
      if (document.pointerLockElement) document.exitPointerLock();
    }
  }, [active, flashlightOn, onInteract, onPrompt, onNote]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(68, mount.clientWidth / mount.clientHeight, 0.06, 140);
    camera.rotation.order = "YXZ";
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const exposure = sceneId === "past" ? 1.14 : sceneId === "bunker" ? 0.98 : sceneId === "epilogue-save" ? 1.18 : sceneId === "epilogue-unwritten" ? 1.02 : 1.0;
    renderer.toneMappingExposure = exposure;
    mount.appendChild(renderer.domElement);

    let built: SceneBuild;
    if (sceneId === "home") built = buildHome(scene);
    else if (sceneId === "station") built = buildStation(scene, powerOn, gateOpen, collectedIds);
    else if (sceneId === "past") built = buildPast(scene, collectedIds);
    else if (sceneId === "wrong") built = buildWrong(scene, gateOpen);
    else if (sceneId === "bunker") built = buildBunker(scene, bunkerPower, collectedIds);
    else if (sceneId === "epilogue-save") built = buildEpilogueSave(scene);
    else if (sceneId === "epilogue-preserve") built = buildEpiloguePreserve(scene);
    else built = buildEpilogueUnwritten(scene);

    camera.position.copy(built.start);
    const lookTargets: Record<WorldScene, THREE.Vector3> = {
      home: new THREE.Vector3(-1.4, 1.35, -7.8),
      station: new THREE.Vector3(0, 1.4, -7),
      past: new THREE.Vector3(0, 1.4, -7),
      wrong: new THREE.Vector3(0, 1.4, -7),
      bunker: new THREE.Vector3(0, 1.4, -7),
      "epilogue-save": new THREE.Vector3(2.85, 1.3, 0.9),
      "epilogue-preserve": new THREE.Vector3(-1.7, 1.1, 1.2),
      "epilogue-unwritten": new THREE.Vector3(0.2, 1.4, -5.2),
    };
    camera.lookAt(lookTargets[sceneId]);
    const previousView = viewRef.current;
    if (previousView && previousView.scene === sceneId) {
      camera.position.x = THREE.MathUtils.clamp(previousView.x, built.bounds.minX, built.bounds.maxX);
      camera.position.z = THREE.MathUtils.clamp(previousView.z, built.bounds.minZ, built.bounds.maxZ);
      camera.rotation.set(previousView.pitch, previousView.yaw, 0);
    }
    scene.add(camera);
    // Neutral environment reflections make metal, glass and damp concrete read as physical surfaces.
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    scene.environmentIntensity = sceneId === "past" ? 0.24 : sceneId === "epilogue-save" ? 0.19 : 0.17;
    const torch = createTorch(camera);

    let yaw = camera.rotation.y;
    let pitch = camera.rotation.x;
    let currentSpeed = 2.75;
    viewRef.current = { scene: sceneId, x: camera.position.x, z: camera.position.z, yaw, pitch };
    const keys = new Set<string>();
    const buttonInputs = new Map<string, string>();
    let interactionHeld = false;
    let lastPrompt: string | null = null;
    let lastAimedId: string | null = null;
    let touchLook: { pointerId: number; x: number; y: number } | null = null;
    const raycaster = new THREE.Raycaster();
    raycaster.far = 4.5;
    const center = new THREE.Vector2(0, 0);
    const timer = new THREE.Timer();
    timer.connect(document);
    const controlDiagnostics = new URLSearchParams(window.location.search).get("debug") === "controls";
    const direction = new THREE.Vector3();
    const right = new THREE.Vector3();
    const movement = new THREE.Vector3();

    const requestLock = (event: MouseEvent) => {
      if (!activeRef.current || (event as PointerEvent).pointerType === "touch") return;
      renderer.domElement.focus({ preventScroll: true });
      if (document.pointerLockElement !== renderer.domElement && renderer.domElement.requestPointerLock) {
        try {
          const request = renderer.domElement.requestPointerLock();
          request?.catch(() => { /* WASD and touch controls also work without pointer lock. */ });
        } catch {
          // Pointer lock may be unavailable in embedded browsers.
        }
      }
    };
    renderer.domElement.tabIndex = 0;
    renderer.domElement.setAttribute("aria-label", "Game view. W forward, S backward, A left, D right. Click to look around.");
    const mouseMove = (event: MouseEvent) => {
      if (document.pointerLockElement !== renderer.domElement || !activeRef.current) return;
      yaw -= event.movementX * 0.002;
      pitch -= event.movementY * 0.002;
      pitch = THREE.MathUtils.clamp(pitch, -1.2, 1.2);
    };
    const keyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (!activeRef.current || event.metaKey || event.ctrlKey || event.altKey) return;
      if (target instanceof HTMLElement && (target.isContentEditable || target.matches("input, textarea, select"))) return;
      if (!["KeyW", "KeyA", "KeyS", "KeyD", "KeyE", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "ShiftLeft", "ShiftRight"].includes(event.code)) return;
      event.preventDefault();
      keys.add(event.code);
    };
    const keyUp = (event: KeyboardEvent) => keys.delete(event.code);
    const touchStart = (event: PointerEvent) => {
      if (!activeRef.current || event.pointerType === "mouse" || touchLook) return;
      event.preventDefault();
      renderer.domElement.setPointerCapture(event.pointerId);
      touchLook = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    };
    const touchMove = (event: PointerEvent) => {
      if (!activeRef.current || !touchLook || touchLook.pointerId !== event.pointerId) return;
      yaw -= (event.clientX - touchLook.x) * 0.0035;
      pitch -= (event.clientY - touchLook.y) * 0.0035;
      pitch = THREE.MathUtils.clamp(pitch, -1.2, 1.2);
      touchLook = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    };
    const touchEnd = (event: PointerEvent) => {
      if (touchLook?.pointerId === event.pointerId) touchLook = null;
      if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId);
    };
    const mobileControl = (event: Event) => {
      const { code, down, source } = (event as CustomEvent<ControlInput>).detail;
      if (down && activeRef.current) buttonInputs.set(source, code);
      else buttonInputs.delete(source);
    };
    const isHeld = (code: string) => keys.has(code) || [...buttonInputs.values()].includes(code);
    const clearInput = () => {
      keys.clear();
      buttonInputs.clear();
      touchLook = null;
      interactionHeld = false;
      movement.set(0, 0, 0);
      window.dispatchEvent(new Event(RESET_CONTROLS_EVENT));
    };
    clearInputRef.current = clearInput;
    const visibilityChange = () => { if (document.hidden) clearInput(); };
    const pointerLockChange = () => { if (document.pointerLockElement !== renderer.domElement) clearInput(); };

    renderer.domElement.addEventListener("click", requestLock);
    renderer.domElement.addEventListener("pointerdown", touchStart);
    renderer.domElement.addEventListener("pointermove", touchMove);
    renderer.domElement.addEventListener("pointerup", touchEnd);
    renderer.domElement.addEventListener("pointercancel", touchEnd);
    renderer.domElement.addEventListener("lostpointercapture", touchEnd);
    window.addEventListener("mousemove", mouseMove);
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    window.addEventListener(CONTROL_EVENT, mobileControl);
    window.addEventListener("blur", clearInput);
    document.addEventListener("visibilitychange", visibilityChange);
    document.addEventListener("pointerlockchange", pointerLockChange);

    const resize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("resize", resize);

    let frame = 0;
    const animate = (timestamp?: number) => {
      frame = requestAnimationFrame(animate);
      // Timer queries do not advance time. Update it once before every simulation step.
      timer.update(timestamp);
      const delta = Math.min(timer.getDelta(), 0.05);
      const elapsed = timer.getElapsed();
      let wantsInteraction = false;

      if (activeRef.current) {
        let forwardInput = (isHeld("KeyW") || isHeld("ArrowUp") ? 1 : 0) - (isHeld("KeyS") || isHeld("ArrowDown") ? 1 : 0);
        let sideInput = (isHeld("KeyD") || isHeld("ArrowRight") ? 1 : 0) - (isHeld("KeyA") || isHeld("ArrowLeft") ? 1 : 0);
        let gamepadInteract = false;
        const gamepad = navigator.getGamepads?.()[0];
        if (gamepad) {
          const dead = (value: number) => (Math.abs(value) > 0.16 ? value : 0);
          sideInput += dead(gamepad.axes[0] ?? 0);
          forwardInput -= dead(gamepad.axes[1] ?? 0);
          yaw -= dead(gamepad.axes[2] ?? 0) * delta * 2.2;
          pitch -= dead(gamepad.axes[3] ?? 0) * delta * 1.8;
          pitch = THREE.MathUtils.clamp(pitch, -1.25, 1.25);
          gamepadInteract = Boolean(gamepad.buttons[0]?.pressed);
        }

        camera.rotation.set(pitch, yaw, 0);
        camera.getWorldDirection(direction);
        direction.y = 0;
        direction.normalize();
        right.crossVectors(direction, camera.up).normalize();
        movement.set(0, 0, 0).addScaledVector(direction, forwardInput).addScaledVector(right, sideInput);
        if (movement.lengthSq() > 1) movement.normalize();
        const sprint = isHeld("ShiftLeft") || isHeld("ShiftRight");
        const targetSpeed = sprint ? 4.4 : 2.75;
        const accel = 1 - Math.exp(-8 * delta);
        currentSpeed += (targetSpeed - currentSpeed) * accel;
        camera.position.addScaledVector(movement, currentSpeed * delta);
        camera.position.x = THREE.MathUtils.clamp(camera.position.x, built.bounds.minX, built.bounds.maxX);
        camera.position.z = THREE.MathUtils.clamp(camera.position.z, built.bounds.minZ, built.bounds.maxZ);
        // Resolve against world colliders with soft sliding along walls.
        const bodyRadius = 0.32;
        for (let pass = 0; pass < 3; pass += 1) {
          for (const collider of built.colliders) {
            const x = camera.position.x;
            const z = camera.position.z;
            if (x > collider.minX - bodyRadius && x < collider.maxX + bodyRadius && z > collider.minZ - bodyRadius && z < collider.maxZ + bodyRadius) {
              const left = x - (collider.minX - bodyRadius);
              const right = collider.maxX + bodyRadius - x;
              const front = z - (collider.minZ - bodyRadius);
              const back = collider.maxZ + bodyRadius - z;
              const smallest = Math.min(left, right, front, back);
              if (smallest === left) camera.position.x = collider.minX - bodyRadius - 0.001;
              else if (smallest === right) camera.position.x = collider.maxX + bodyRadius + 0.001;
              else if (smallest === front) camera.position.z = collider.minZ - bodyRadius - 0.001;
              else camera.position.z = collider.maxZ + bodyRadius + 0.001;
            }
          }
        }
        camera.position.x = THREE.MathUtils.clamp(camera.position.x, built.bounds.minX, built.bounds.maxX);
        camera.position.z = THREE.MathUtils.clamp(camera.position.z, built.bounds.minZ, built.bounds.maxZ);
        camera.position.y = 1.68 + Math.sin(elapsed * 9) * Math.min(movement.length(), 1) * 0.018;
        wantsInteraction = isHeld("KeyE") || gamepadInteract;
      }
      viewRef.current = { scene: sceneId, x: camera.position.x, z: camera.position.z, yaw, pitch };
      if (controlDiagnostics) {
        renderer.domElement.dataset.playerX = camera.position.x.toFixed(5);
        renderer.domElement.dataset.playerZ = camera.position.z.toFixed(5);
        renderer.domElement.dataset.yaw = yaw.toFixed(5);
        renderer.domElement.dataset.pitch = pitch.toFixed(5);
        renderer.domElement.dataset.scene = sceneId;
        renderer.domElement.dataset.inputActive = String(activeRef.current);
      }

      // Living world: NPCs, animated props, dust.
      const ctx: StepContext = {
        dt: delta,
        time: elapsed,
        player: camera.position,
        walkers: built.walkers,
        aimedId: lastAimedId,
        note: (text: string) => onNoteRef.current(text),
      };
      built.walkers.forEach((walker) => stepWalker(walker, ctx));
      built.animated.forEach((update) => update(elapsed, delta));

      // Torch battery drains only while lit.
      if (flashlightRef.current && activeRef.current) batteryRef.current = Math.max(0, batteryRef.current - delta / 1500);
      updateTorch(torch, flashlightRef.current, batteryRef.current, elapsed, delta);

      scene.updateMatrixWorld();

      if (activeRef.current) {
        raycaster.setFromCamera(center, camera);
        const hits = raycaster.intersectObjects(built.interactables, false);
        const target = hits[0]?.object as Interactive | undefined;
        const prompt = target?.userData.interactionLabel ?? null;
        if (prompt !== lastPrompt) {
          lastPrompt = prompt;
          onPromptRef.current(prompt);
        }
        lastAimedId = target?.userData.interactionId ?? null;
        if (wantsInteraction && !interactionHeld && target?.userData.interactionId) {
          onInteractRef.current(target.userData.interactionId);
        }
      } else {
        lastAimedId = null;
        if (lastPrompt) {
          lastPrompt = null;
          onPromptRef.current(null);
        }
      }
      interactionHeld = wantsInteraction;

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      timer.dispose();
      clearInput();
      clearInputRef.current = null;
      onPromptRef.current(null);
      renderer.domElement.removeEventListener("click", requestLock);
      renderer.domElement.removeEventListener("pointerdown", touchStart);
      renderer.domElement.removeEventListener("pointermove", touchMove);
      renderer.domElement.removeEventListener("pointerup", touchEnd);
      renderer.domElement.removeEventListener("pointercancel", touchEnd);
      renderer.domElement.removeEventListener("lostpointercapture", touchEnd);
      window.removeEventListener("mousemove", mouseMove);
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("resize", resize);
      window.removeEventListener(CONTROL_EVENT, mobileControl);
      window.removeEventListener("blur", clearInput);
      document.removeEventListener("visibilitychange", visibilityChange);
      document.removeEventListener("pointerlockchange", pointerLockChange);
      if (document.pointerLockElement === renderer.domElement) document.exitPointerLock();
      scene.traverse((object) => {
        const drawable = object as THREE.Object3D & { geometry?: THREE.BufferGeometry; material?: THREE.Material | THREE.Material[] };
        drawable.geometry?.dispose();
        const mats = Array.isArray(drawable.material) ? drawable.material : drawable.material ? [drawable.material] : [];
        mats.forEach((mat) => mat.dispose());
      });
      pmrem.dispose();
      envTarget.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [sceneId, powerOn, gateOpen, bunkerPower, collectedIds.join("|")]);

  return (
    <>
      <div ref={mountRef} className="world-root" aria-label="First person game world" />
      <MovementControls active={active} />
    </>
  );
}
