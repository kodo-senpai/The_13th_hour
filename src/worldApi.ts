import * as THREE from "three";

export type Collider = { minX: number; maxX: number; minZ: number; maxZ: number };
export type Era = "present" | "past" | "wrong";

export type ExpansionApi = {
  scene: THREE.Scene;
  interactables: THREE.Mesh[];
  animated: Array<(time: number, dt: number) => void>;
  colliders: Collider[];
  era: Era;
};

type MaterialOpts = {
  map?: THREE.Texture | null;
  color?: number;
  roughness?: number;
  metalness?: number;
  emissive?: number;
  emissiveMap?: THREE.Texture | null;
  emissiveIntensity?: number;
  opacity?: number;
  side?: THREE.Side;
  bumpMap?: THREE.Texture | null;
  bumpScale?: number;
};

export function pbr(opts: MaterialOpts = {}) {
  const mat = new THREE.MeshStandardMaterial({
    color: opts.color ?? 0xffffff,
    map: opts.map ?? null,
    roughness: opts.roughness ?? 0.82,
    metalness: opts.metalness ?? 0.04,
    emissive: opts.emissive ?? 0x000000,
    emissiveMap: opts.emissiveMap ?? null,
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    side: opts.side ?? THREE.FrontSide,
    bumpMap: opts.bumpMap ?? null,
    bumpScale: opts.bumpScale ?? 0.02,
  });
  if (opts.opacity !== undefined) {
    mat.transparent = true;
    mat.opacity = opts.opacity;
    mat.depthWrite = false;
  }
  return mat;
}

export function addCollider(api: ExpansionApi, minX: number, maxX: number, minZ: number, maxZ: number) {
  api.colliders.push({ minX, maxX, minZ, maxZ });
}

export function interactive(api: ExpansionApi, mesh: THREE.Mesh, id: string, label: string) {
  mesh.userData.interactionId = id;
  mesh.userData.interactionLabel = label;
  api.interactables.push(mesh);
  return mesh;
}

export function slab(
  api: ExpansionApi,
  size: [number, number, number],
  position: [number, number, number],
  mat: THREE.Material,
  opts: { rotation?: [number, number, number]; cast?: boolean; receive?: boolean } = {},
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), mat);
  mesh.position.set(position[0], position[1], position[2]);
  if (opts.rotation) mesh.rotation.set(opts.rotation[0], opts.rotation[1], opts.rotation[2]);
  mesh.castShadow = opts.cast ?? false;
  mesh.receiveShadow = opts.receive ?? true;
  api.scene.add(mesh);
  return mesh;
}

export function plane(
  api: ExpansionApi,
  size: [number, number],
  position: [number, number, number],
  rotation: [number, number, number],
  mat: THREE.Material,
) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1]), mat);
  mesh.position.set(position[0], position[1], position[2]);
  mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  mesh.receiveShadow = true;
  api.scene.add(mesh);
  return mesh;
}

export function cylinder(
  api: ExpansionApi,
  radiusTop: number,
  radiusBottom: number,
  height: number,
  position: [number, number, number],
  mat: THREE.Material,
  rotation?: [number, number, number],
  segments = 16,
) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), mat);
  mesh.position.set(position[0], position[1], position[2]);
  if (rotation) mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  api.scene.add(mesh);
  return mesh;
}

export function sphere(api: ExpansionApi, radius: number, position: [number, number, number], mat: THREE.Material) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 9), mat);
  mesh.position.set(position[0], position[1], position[2]);
  api.scene.add(mesh);
  return mesh;
}

let glowMap: THREE.CanvasTexture | null = null;
export function glowTexture() {
  if (glowMap) return glowMap;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.16, "rgba(255,255,255,.55)");
  gradient.addColorStop(0.5, "rgba(255,255,255,.13)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  glowMap = new THREE.CanvasTexture(canvas);
  return glowMap;
}

export function glow(
  api: ExpansionApi,
  position: [number, number, number],
  color: number,
  size: number,
  opacity: number,
) {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  sprite.position.set(position[0], position[1], position[2]);
  sprite.scale.setScalar(size);
  api.scene.add(sprite);
  return sprite;
}

export function lamp(
  api: ExpansionApi,
  position: [number, number, number],
  color: number,
  intensity: number,
  distance: number,
  opts: { flicker?: number; seed?: number; glowSize?: number; shadeColor?: number } = {},
) {
  const light = new THREE.PointLight(color, intensity, distance, 1.8);
  light.position.set(position[0], position[1], position[2]);
  api.scene.add(light);
  const halo = glow(api, position, color, opts.glowSize ?? 1.4, Math.min(0.75, intensity * 0.15));
  const shade = new THREE.Mesh(
    new THREE.ConeGeometry(0.24, 0.24, 12, 1, true),
    pbr({ color: opts.shadeColor ?? 0x252c28, roughness: 0.55, metalness: 0.4, side: THREE.DoubleSide }),
  );
  shade.position.set(position[0], position[1] + 0.18, position[2]);
  api.scene.add(shade);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), new THREE.MeshBasicMaterial({ color }));
  bulb.position.set(position[0], position[1] + 0.02, position[2]);
  api.scene.add(bulb);
  const flicker = opts.flicker ?? 0;
  const seed = opts.seed ?? 1;
  const base = intensity;
  api.animated.push((time) => {
    if (flicker <= 0) return;
    const pulse = Math.sin(time * 17 + seed) * Math.sin(time * 5.3 + seed * 2.1);
    let level = 1 + pulse * flicker * 0.25;
    if (Math.sin(time * 0.7 + seed * 4.3) > 0.995) level *= 0.22;
    light.intensity = base * level;
    halo.material.opacity = Math.min(0.75, base * 0.15) * level;
  });
  return light;
}

export function signPlane(
  api: ExpansionApi,
  texture: THREE.Texture,
  size: [number, number],
  position: [number, number, number],
  rotation: [number, number, number],
  opts: { emissive?: number; emissiveIntensity?: number; interactiveId?: string; label?: string } = {},
) {
  const mat = pbr({ map: texture, roughness: 0.7, emissive: opts.emissive ?? 0xffffff, emissiveMap: texture, emissiveIntensity: opts.emissiveIntensity ?? 0.16 });
  const mesh = plane(api, size, position, rotation, mat);
  if (opts.interactiveId) interactive(api, mesh, opts.interactiveId, opts.label ?? "Inspect");
  return mesh;
}

export function imagePlane(
  api: ExpansionApi,
  url: string,
  size: [number, number],
  position: [number, number, number],
  rotation: [number, number, number],
  opts: { id?: string; label?: string; frameColor?: number } = {},
) {
  const group = new THREE.Group();
  group.position.set(position[0], position[1], position[2]);
  group.rotation.set(rotation[0], rotation[1], rotation[2]);
  api.scene.add(group);
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(size[0] + 0.14, size[1] + 0.14, 0.05),
    pbr({ color: opts.frameColor ?? 0x2e2119, roughness: 0.5 }),
  );
  group.add(frame);
  const mat = pbr({ color: 0xa39a83, roughness: 0.75 });
  const picture = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1]), mat);
  picture.position.z = 0.03;
  group.add(picture);
  if (opts.id) interactive(api, picture, opts.id, opts.label ?? "Inspect photograph");
  new THREE.TextureLoader().load(url, (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    mat.map = texture;
    mat.color.set(0xffffff);
    mat.emissive.set(0xffffff);
    mat.emissiveMap = texture;
    mat.emissiveIntensity = 0.1;
    mat.needsUpdate = true;
  });
  return group;
}

export function rainField(
  api: ExpansionApi,
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number; top: number },
  count: number,
  color = 0xa9c8c2,
  opacity = 0.3,
  speed = 7,
) {
  const positions = new Float32Array(count * 3);
  const random = () => Math.random();
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = bounds.minX + random() * (bounds.maxX - bounds.minX);
    positions[i * 3 + 1] = random() * bounds.top;
    positions[i * 3 + 2] = bounds.minZ + random() * (bounds.maxZ - bounds.minZ);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ color, size: 0.028, transparent: true, opacity, depthWrite: false }),
  );
  api.scene.add(points);
  api.animated.push((_time, dt) => {
    const attr = geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < count; i += 1) {
      let y = attr.getY(i) - speed * dt;
      if (y < 0) y = bounds.top;
      attr.setY(i, y);
    }
    attr.needsUpdate = true;
  });
  return points;
}

export function steamField(api: ExpansionApi, origin: [number, number, number], count = 26, color = 0xd8ded4, opacity = 0.16) {
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = origin[0] + (Math.random() - 0.5) * 0.2;
    positions[i * 3 + 1] = origin[1] + Math.random() * 0.7;
    positions[i * 3 + 2] = origin[2] + (Math.random() - 0.5) * 0.2;
    seeds[i] = Math.random();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ color, size: 0.11, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  api.scene.add(points);
  api.animated.push((time) => {
    const attr = geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < count; i += 1) {
      const cycle = (time * 0.22 + seeds[i]) % 1;
      attr.setY(i, origin[1] + cycle * 1.8);
      attr.setX(i, origin[0] + Math.sin(time + i) * 0.13 * cycle);
      attr.setZ(i, origin[2] + Math.cos(time * 0.8 + i) * 0.13 * cycle);
    }
    attr.needsUpdate = true;
  });
  return points;
}

export function puddle(api: ExpansionApi, position: [number, number, number], size: [number, number], color = 0x25312f) {
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.06,
    metalness: 0.95,
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(1, 22), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.scale.set(size[0], size[1], 1);
  mesh.position.set(position[0], position[1], position[2]);
  api.scene.add(mesh);
  return mesh;
}

export function catenary(api: ExpansionApi, from: THREE.Vector3, to: THREE.Vector3, sag: number, mat: THREE.Material) {
  const mid = new THREE.Vector3((from.x + to.x) / 2, Math.min(from.y, to.y) - sag, (from.z + to.z) / 2);
  const curve = new THREE.CatmullRomCurve3([from, mid, to]);
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 18, 0.014, 5, false), mat);
  api.scene.add(tube);
  return curve;
}
