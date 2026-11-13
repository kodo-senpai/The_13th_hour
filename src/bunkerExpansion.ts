import * as THREE from "three";
import { signTexture, textures, tiled } from "./worldTextures";
import { addCollider, cylinder, glow, interactive, lamp, pbr, plane, puddle, signPlane, slab, sphere, steamField } from "./worldApi";
import type { ExpansionApi } from "./worldApi";

function hazardMat() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#c8a13c";
  ctx.fillRect(0, 0, 256, 64);
  ctx.strokeStyle = "#1c1b17";
  ctx.lineWidth = 22;
  for (let x = -64; x < 320; x += 56) {
    ctx.beginPath();
    ctx.moveTo(x, 64);
    ctx.lineTo(x + 64, 0);
    ctx.stroke();
  }
  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2, 1);
  map.colorSpace = THREE.SRGBColorSpace;
  return pbr({ map, roughness: 0.75, metalness: 0.15 });
}

function pipeRun(api: ExpansionApi, from: [number, number, number], to: [number, number, number], radius = 0.09) {
  const start = new THREE.Vector3(...from);
  const end = new THREE.Vector3(...to);
  const mid = start.clone().add(end).multiplyScalar(0.5);
  const length = start.distanceTo(end);
  const direction = end.clone().sub(start).normalize();
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, 8),
    pbr({ map: tiled(textures.rust(), 2, 1), metalness: 0.65, roughness: 0.5 }),
  );
  mesh.position.copy(mid);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  api.scene.add(mesh);
  return mesh;
}

function cageLamp(api: ExpansionApi, position: [number, number, number], color: number, intensity: number, powered: boolean, seed: number, flicker = 0.5) {
  cylinder(api, 0.01, 0.01, 0.4, [position[0], position[1] + 0.25, position[2]], pbr({ color: 0x1d1c18, metalness: 0.7 }));
  const cage = cylinder(api, 0.15, 0.13, 0.22, position, pbr({ color: 0x30352f, metalness: 0.6, roughness: 0.4 }), undefined, 10);
  cage.material = new THREE.MeshStandardMaterial({ color: 0x3a3f38, wireframe: true, metalness: 0.6, roughness: 0.4 });
  const light = lamp(api, position, color, powered ? intensity : 0, 8, { flicker: powered ? flicker : 0, seed, glowSize: 0.9, shadeColor: 0x21251f });
  api.animated.push((time) => {
    if (!powered) {
      light.intensity = 0;
      return;
    }
    if (Math.sin(time * 0.5 + seed) > 0.992) light.intensity *= 0.18;
  });
  return light;
}

export function expandBunker(api: ExpansionApi, powered: boolean) {
  const concrete = pbr({ map: tiled(textures.concrete("#4d5652"), 4, 8), roughness: 0.88, bumpMap: textures.concrete("#4d5652"), bumpScale: 0.025 });
  const wetConcrete = pbr({ map: tiled(textures.concrete("#3f4a46"), 3, 7), roughness: 0.55, metalness: 0.12 });
  plane(api, [14.9, 30.9], [0, 0.004, 0], [-Math.PI / 2, 0, 0], wetConcrete);
  plane(api, [14.9, 30.9], [0, 4.3, 0], [Math.PI / 2, 0, 0], concrete);
  plane(api, [14.9, 4.3], [0, 2.15, -14.78], [0, 0, 0], pbr({ map: tiled(textures.concrete("#454e4a"), 3, 1.2), roughness: 0.9 }));
  plane(api, [31, 4.3], [-7.18, 2.15, 0], [0, Math.PI / 2, 0], pbr({ map: tiled(textures.concrete("#414a46"), 6, 1.2), roughness: 0.9 }));
  plane(api, [31, 4.3], [7.18, 2.15, 0], [0, -Math.PI / 2, 0], pbr({ map: tiled(textures.concrete("#414a46"), 6, 1.2), roughness: 0.9 }));

  // Concrete ribs, pipe runs, cable trays.
  for (let z = -13; z <= 13; z += 6.5) {
    slab(api, [0.24, 4.2, 0.45], [-6.9, 2.1, z], concrete);
    slab(api, [0.24, 4.2, 0.45], [6.9, 2.1, z], concrete);
  }
  pipeRun(api, [-6.85, 3.82, -14], [-6.85, 3.82, 14], 0.12);
  pipeRun(api, [-6.55, 3.65, -14], [-6.55, 3.65, 14], 0.07);
  pipeRun(api, [6.85, 3.75, -14], [6.85, 3.75, 14], 0.1);
  for (let z = -13; z < 14; z += 2.2) {
    cylinder(api, 0.13, 0.13, 0.08, [-6.85, 3.82, z], pbr({ color: 0x4f5a54, metalness: 0.65 }), [0, 0, Math.PI / 2]);
  }
  const tray = pbr({ map: tiled(textures.rust(), 4, 1), metalness: 0.6, roughness: 0.55 });
  slab(api, [0.5, 0.08, 28], [-5.9, 3.55, 0], tray);
  for (let z = -13; z <= 13; z += 1.4) slab(api, [0.45, 0.05, 0.05], [-5.9, 3.6, z], tray);
  // Warning stripes near the regulator and doors.
  plane(api, [7, 0.9], [0, 0.02, -12.6], [-Math.PI / 2, 0, 0], hazardMat());
  plane(api, [3.2, 0.45], [0, 0.021, -13.3], [-Math.PI / 2, 0, 0], hazardMat());

  // Main junction and breaker cabinets.
  const cabinetMat = pbr({ color: 0x3f4d45, metalness: 0.5, roughness: 0.5 });
  slab(api, [0.35, 1.85, 2.6], [-6.92, 0.95, 1.5], cabinetMat);
  for (let i = 0; i < 4; i += 1) {
    slab(api, [0.03, 0.38, 0.48], [-6.72, 0.55 + (i % 2) * 0.7, 0.6 + i * 0.5], pbr({ color: 0x2c332e, metalness: 0.6, roughness: 0.4 }));
    glow(api, [-6.7, 0.72 + (i % 2) * 0.7, 0.6 + i * 0.5], powered ? 0x7dd6a7 : 0xc23a2b, 0.3, powered ? 0.35 : 0.22);
  }
  interactive(api, slab(api, [0.32, 0.4, 0.5], [-6.7, 1.35, 3.2], pbr({ color: 0x303832 })), "bunker_breaker", "Inspect the breaker panel");
  addCollider(api, -7.15, -6.65, 0.1, 3.6);

  // Overhead catwalk across the main chamber.
  const walkMat = pbr({ map: tiled(textures.rust(), 3, 1), metalness: 0.72, roughness: 0.42 });
  slab(api, [12.2, 0.12, 1.15], [0.4, 2.75, -4.0], walkMat);
  for (let x = -5.5; x <= 6.4; x += 0.55) {
    slab(api, [0.035, 0.85, 0.035], [x, 3.2, -4.55], walkMat);
    slab(api, [0.035, 0.85, 0.035], [x, 3.2, -3.45], walkMat);
  }
  slab(api, [12.2, 0.05, 0.05], [0.4, 3.62, -4.55], pbr({ color: 0xb49b52, roughness: 0.6, metalness: 0.4 }));
  slab(api, [12.2, 0.05, 0.05], [0.4, 3.62, -3.45], pbr({ color: 0xb49b52, roughness: 0.6, metalness: 0.4 }));
  // Ladder up to the catwalk.
  for (let i = 0; i < 9; i += 1) {
    cylinder(api, 0.025, 0.025, 0.75, [5.6, 0.4 + i * 0.32, -5.0], walkMat, [Math.PI / 2, 0, 0], 6);
    slab(api, [0.05, 0.05, 0.05], [5.2, 0.3 + i * 0.32, -5.0], walkMat);
    slab(api, [0.05, 0.05, 0.05], [6.0, 0.3 + i * 0.32, -5.0], walkMat);
  }
  cylinder(api, 0.035, 0.035, 3.2, [5.2, 1.6, -5.0], walkMat);
  cylinder(api, 0.035, 0.035, 3.2, [6.0, 1.6, -5.0], walkMat);

  // Fallen dust, puddles, drums and clutter.
  puddle(api, [-2.4, 0.008, 4.8], [1.4, 0.7], 0x1c2724);
  puddle(api, [3.6, 0.008, -8.5], [0.9, 0.55], 0x1c2724);
  puddle(api, [-8.8, 0.008, 6.6], [1.1, 0.5], 0x1c2724);
  const drumMat = pbr({ map: tiled(textures.rust(), 1.8, 1), roughness: 0.65, metalness: 0.4 });
  [[-5.6, 5.2], [-5.0, 5.5], [-4.4, 5.2], [4.8, 7.2], [5.4, 7.5]].forEach(([x, z]) => {
    const drum = cylinder(api, 0.3, 0.3, 0.9, [x, 0.45, z], drumMat);
    drum.castShadow = true;
    cylinder(api, 0.31, 0.31, 0.05, [x, 0.55, z], pbr({ color: 0x343b35, metalness: 0.5 }));
    cylinder(api, 0.31, 0.31, 0.05, [x, 0.78, z], pbr({ color: 0x343b35, metalness: 0.5 }));
  });
  addCollider(api, -5.95, -4.05, 4.85, 5.85);
  addCollider(api, 4.4, 5.8, 6.8, 7.9);
  const crateMat = pbr({ map: tiled(textures.wood(), 1, 1), color: 0x65533b, roughness: 0.8 });
  [[-3.7, -1.3], [-4.3, -1.0], [-3.9, -2.0], [3.4, 2.2], [4.0, 2.5]].forEach(([x, z], index) => {
    const crate = slab(api, [0.8, 0.66 + (index % 2) * 0.2, 0.8], [x, 0.34 + (index % 2) * 0.1, z], crateMat, { rotation: [0, index * 0.35, 0] });
    crate.castShadow = true;
    interactive(api, crate, "bunker_crate", "Inspect the sealed crate");
  });
  addCollider(api, -4.6, -3.3, -2.4, -0.6);
  addCollider(api, 3.0, 4.5, 1.8, 3.0);

  // Machine room east.
  slab(api, [0.22, 4.2, 3.1], [7.2, 2.1, -8.45], concrete);
  slab(api, [0.22, 4.2, 2.9], [7.2, 2.1, -3.75], concrete);
  slab(api, [0.22, 0.8, 1.9], [7.2, 3.8, -6.0], concrete);
  addCollider(api, 7.0, 7.3, -10.1, -6.9);
  addCollider(api, 7.0, 7.3, -5.2, -2.3);
  plane(api, [4.4, 7.4], [9.4, 0.008, -6.0], [-Math.PI / 2, 0, 0], pbr({ map: tiled(textures.concrete("#3d4843"), 3, 5), roughness: 0.6, metalness: 0.1 }));
  plane(api, [4.4, 7.4], [9.4, 3.9, -6.0], [Math.PI / 2, 0, 0], concrete);
  slab(api, [0.24, 4.1, 7.6], [11.6, 2.05, -6.0], concrete);
  slab(api, [4.5, 4.1, 0.24], [9.4, 2.05, -10.1], concrete);
  slab(api, [4.5, 4.1, 0.24], [9.4, 2.05, -1.9], concrete);
  addCollider(api, 11.45, 11.75, -9.9, -2.1);
  addCollider(api, 7.2, 11.6, -10.25, -9.95);
  addCollider(api, 7.2, 11.6, -2.05, -1.75);
  signPlane(api, signTexture({ title: "MACHINE ROOM", sub: "DANGER / 415 VOLTS", lines: ["DO NOT RESTORE BY FEELING"], accent: "#c9a548", wear: true }), [1.6, 0.6], [7.15, 2.55, -5.95], [0, -Math.PI / 2, 0], { emissiveIntensity: powered ? 0.3 : 0.08 });

  const pumpMat = pbr({ map: tiled(textures.rust(), 2, 1), metalness: 0.6, roughness: 0.45 });
  [[-8.8], [-6.4]].forEach(([z], index) => {
    const pump = new THREE.Group();
    pump.position.set(10.2, 0, z as number);
    api.scene.add(pump);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.3, 16), pumpMat);
    body.rotation.z = Math.PI / 2;
    body.position.y = 0.75;
    pump.add(body);
    [-0.58, 0.58].forEach((offset) => {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.1, 16), pbr({ color: 0x2f3832, metalness: 0.6, roughness: 0.4 }));
      cap.rotation.z = Math.PI / 2;
      cap.position.set(offset, 0.75, 0);
      pump.add(cap);
    });
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.16, 1.1), pbr({ color: 0x2d3631, metalness: 0.4, roughness: 0.6 }));
    base.position.y = 0.08;
    pump.add(base);
    if (index === 0) {
      interactive(api, body, "bunker_pump", "Inspect the coolant pump");
      const flywheel = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 6, 18), pbr({ color: 0x262c28, metalness: 0.7, roughness: 0.4 }));
      flywheel.name = "bunker-flywheel";
      flywheel.position.set(0.75, 0.75, 0);
      pump.add(flywheel);
    }
    addCollider(api, 9.3, 11.1, -9.6, -7.9);
    if (index === 1) addCollider(api, 9.3, 11.1, -7.2, -5.5);
  });
  pipeRun(api, [10.2, 1.25, -8.0], [10.2, 3.6, -8.0], 0.16);
  pipeRun(api, [10.2, 1.25, -8.0], [7.4, 1.25, -8.0], 0.16);
  pipeRun(api, [11.4, 3.55, -9.8], [11.4, 3.55, -2.2], 0.12);
  const tank = cylinder(api, 0.72, 0.72, 2.1, [8.4, 1.05, -2.9], pbr({ map: tiled(textures.rust(), 2, 2), metalness: 0.55, roughness: 0.55 }));
  tank.castShadow = true;
  sphere(api, 0.72, [8.4, 2.1, -2.9], tank.material as THREE.Material);
  addCollider(api, 7.65, 9.15, -3.65, -2.15);
  interactive(api, tank, "bunker_tank", "Read the pressure tank");
  for (let i = 0; i < 3; i += 1) {
    const gauge = cylinder(api, 0.11, 0.11, 0.04, [8.95 + i * 0.28, 1.5, -2.2], pbr({ color: 0xb9c3b8, emissive: powered ? 0x3f6f5b : 0x151b18, roughness: 0.3 }), [Math.PI / 2, 0, 0]);
    gauge.rotation.x = Math.PI / 2;
  }
  steamField(api, [9.6, 1.4, -9.8], 20, 0xbfd4cd, 0.18);
  cageLamp(api, [9.5, 3.4, -5.4], 0xb8e2c8, 2.8, powered, 31, 0.6);
  if (powered) {
    api.animated.push((time) => {
      const flywheel = api.scene.getObjectByName("bunker-flywheel");
      if (flywheel) flywheel.rotation.x = time * 1.4;
    });
  }

  // Control room west.
  slab(api, [0.22, 4.2, 3.0], [-7.2, 2.1, -8.5], concrete);
  slab(api, [0.22, 4.2, 2.9], [-7.2, 2.1, -3.8], concrete);
  slab(api, [0.22, 0.8, 1.8], [-7.2, 3.8, -6.0], concrete);
  addCollider(api, -7.3, -7.0, -10.1, -6.9);
  addCollider(api, -7.3, -7.0, -5.35, -2.3);
  plane(api, [4.4, 7.4], [-9.4, 0.008, -6.0], [-Math.PI / 2, 0, 0], pbr({ map: tiled(textures.tiles("#525b52", "#363d37"), 4, 5), roughness: 0.65 }));
  plane(api, [4.4, 7.4], [-9.4, 3.9, -6.0], [Math.PI / 2, 0, 0], concrete);
  slab(api, [0.24, 4.1, 7.6], [-11.6, 2.05, -6.0], concrete);
  slab(api, [4.5, 4.1, 0.24], [-9.4, 2.05, -10.1], concrete);
  slab(api, [4.5, 4.1, 0.24], [-9.4, 2.05, -1.9], concrete);
  addCollider(api, -11.75, -11.45, -9.9, -2.1);
  addCollider(api, -11.6, -7.2, -10.25, -9.95);
  addCollider(api, -11.6, -7.2, -2.05, -1.75);
  signPlane(api, signTexture({ title: "CONTROL ROOM", sub: "AUTHORIZED PERSONNEL ONLY", lines: ["THE MACHINE DOES NOT", "NEED YOUR PERMISSION"], accent: "#68a598", wear: true }), [1.6, 0.6], [-7.15, 2.55, -6.05], [0, Math.PI / 2, 0], { emissiveIntensity: powered ? 0.3 : 0.1 });
  // Console desks and screens.
  slab(api, [0.9, 0.85, 3.1], [-8.6, 0.43, -7.2], pbr({ color: 0x303a35, metalness: 0.4, roughness: 0.5 }));
  slab(api, [1.0, 0.08, 3.2], [-8.6, 0.9, -7.2], pbr({ color: 0x3d4841, metalness: 0.4, roughness: 0.5 }));
  addCollider(api, -9.2, -8.0, -8.8, -5.6);
  const screenMat = new THREE.MeshStandardMaterial({ color: 0x0d1714, emissive: powered ? 0x3d8a72 : 0x1a2a24, emissiveIntensity: powered ? 0.75 : 0.12, roughness: 0.25 });
  for (let i = 0; i < 4; i += 1) {
    slab(api, [0.07, 0.52, 0.76], [-9.02, 1.32, -8.6 + i * 0.82], screenMat);
    slab(api, [0.16, 0.09, 0.5], [-8.95, 1.02, -8.6 + i * 0.82], pbr({ color: 0x1f2823, metalness: 0.4 }));
    const row = powered ? 0x73b79b : 0x2c4038;
    for (let j = 0; j < 5; j += 1) slab(api, [0.02, 0.018, 0.3 + Math.random() * 0.34], [-8.98, 1.16 + j * 0.08, -8.6 + i * 0.82], pbr({ color: row, emissive: row, emissiveIntensity: 0.6 }));
  }
  interactive(api, slab(api, [0.2, 0.16, 0.5], [-8.4, 1.0, -6.2], pbr({ color: 0x1d2420, metalness: 0.4 })), "bunker_control_notes", "Read the operator's notes");
  cageLamp(api, [-9.7, 3.4, -7.2], 0x8ec4b3, 2.2, powered, 37, 0.4);
  // Wall map of the loop with pins.
  plane(api, [3.2, 1.8], [-11.45, 2.2, -6.2], [0, Math.PI / 2, 0], pbr({ map: tiled(textures.plaster("#8f8c73"), 2, 1), roughness: 0.85 }));
  const pinMat = pbr({ color: 0xb44935, emissive: 0x50140d, emissiveIntensity: 0.5 });
  for (let i = 0; i < 11; i += 1) {
    const pin = sphere(api, 0.045, [-11.4, 1.5 + (i % 4) * 0.3, -7.2 + Math.floor(i / 4) * 0.8], pinMat);
    pin.scale.z = 0.4;
  }
  // Operator chairs.
  [[-8.1, -8.3], [-8.1, -6.4]].forEach(([x, z]) => {
    slab(api, [0.44, 0.08, 0.44], [x, 0.5, z], pbr({ color: 0x27302b, roughness: 0.8 }));
    slab(api, [0.44, 0.6, 0.08], [x, 0.82, z - 0.24], pbr({ color: 0x27302b, roughness: 0.8 }));
    cylinder(api, 0.035, 0.035, 0.48, [x, 0.25, z], pbr({ color: 0x343d37, metalness: 0.5 }));
  });
  // Hanging loose cables.
  for (let i = 0; i < 7; i += 1) {
    const from = new THREE.Vector3(-10.6 + i * 0.3, 3.7, -9.8);
    const to = new THREE.Vector3(-10.5 + i * 0.32, 2.9 + Math.random() * 0.5, -9.9);
    const curve = new THREE.CatmullRomCurve3([from, new THREE.Vector3((from.x + to.x) / 2, 3.2, (from.z + to.z) / 2), to]);
    api.scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 0.018, 5), pbr({ color: 0x1f2522, roughness: 0.8 })));
  }

  // Store room west-south.
  slab(api, [0.22, 4.2, 3.4], [-7.2, 2.1, 3.0], concrete);
  slab(api, [0.22, 4.2, 4.1], [-7.2, 2.1, 11.6], concrete);
  addCollider(api, -7.3, -7.0, 1.15, 4.75);
  addCollider(api, -7.3, -7.0, 9.5, 13.7);
  plane(api, [5.0, 9.0], [-9.9, 0.008, 7.2], [-Math.PI / 2, 0, 0], pbr({ map: tiled(textures.concrete("#464f4a"), 3, 6), roughness: 0.85 }));
  plane(api, [5.0, 9.0], [-9.9, 3.8, 7.2], [Math.PI / 2, 0, 0], concrete);
  slab(api, [0.24, 4.1, 9.2], [-12.4, 2.05, 7.2], concrete);
  slab(api, [5.3, 4.1, 0.24], [-9.9, 2.05, 2.6], concrete);
  slab(api, [5.3, 4.1, 0.24], [-9.9, 2.05, 11.8], concrete);
  addCollider(api, -12.4, -7.2, 2.45, 2.75);
  addCollider(api, -12.4, -7.2, 11.65, 11.95);
  signPlane(api, signTexture({ title: "STORES", sub: "SPARE PARTS / SPARE YEARS", lines: ["IF IT IS MISSING", "IT WAS NEVER HERE"], accent: "#b9a36c", wear: true }), [1.3, 0.5], [-7.15, 2.5, 5.2], [0, Math.PI / 2, 0]);
  for (let i = 0; i < 3; i += 1) {
    slab(api, [0.65, 0.05, 1.7], [-12.0, 0.6 + i * 0.82, 4.1], pbr({ color: 0x4a3d2c, roughness: 0.75 }));
    slab(api, [0.65, 0.05, 2.3], [-12.0, 0.6 + i * 0.82, 10.0], pbr({ color: 0x4a3d2c, roughness: 0.75 }));
    for (let j = 0; j < 14; j += 1) {
      const boxZ = 3.6 + j * 0.5;
      if (boxZ > 5.2 && boxZ < 8.4) continue;
      const boxMesh = slab(api, [0.5, 0.28 + (j % 3) * 0.1, 0.4], [-12.0, 0.78 + i * 0.82, boxZ], pbr({ color: [0x7c6e50, 0x5d5b45, 0x8a7f5f][j % 3], roughness: 0.9 }));
      boxMesh.rotation.y = (j % 2) * 0.04;
    }
  }
  addCollider(api, -12.4, -11.6, 3.3, 5.2);
  addCollider(api, -12.4, -11.6, 8.4, 11.2);
  const barrelMat = pbr({ map: tiled(textures.rust(), 1, 1), metalness: 0.5, roughness: 0.6 });
  [[-10.6, 4.0], [-10.3, 4.5], [-10.9, 4.8]].forEach(([x, z]) => cylinder(api, 0.3, 0.3, 0.9, [x, 0.45, z], barrelMat));
  addCollider(api, -11.2, -10.0, 3.6, 5.1);
  cageLamp(api, [-10.8, 3.3, 8.4], 0xe0c38d, 1.7, powered, 41, 0.65);
  interactive(api, slab(api, [0.55, 0.35, 0.5], [-11.3, 0.7, 9.8], pbr({ color: 0x5a4b34, roughness: 0.8 })), "bunker_store_box", "Open the quartermaster's box");

  // Hidden terminal room behind a false wall.
  slab(api, [0.18, 4.1, 2.4], [-12.4, 2.05, 4.1], concrete);
  slab(api, [0.18, 4.1, 2.4], [-12.4, 2.05, 9.5], concrete);
  slab(api, [0.18, 1.1, 4.4], [-12.4, 3.55, 6.8], concrete);
  addCollider(api, -12.5, -12.3, 2.8, 5.4);
  addCollider(api, -12.5, -12.3, 8.3, 10.8);
  plane(api, [2.6, 4.4], [-13.8, 0.008, 6.9], [-Math.PI / 2, 0, 0], pbr({ map: tiled(textures.concrete("#333d38"), 1, 2), roughness: 0.9 }));
  plane(api, [2.6, 4.4], [-13.8, 3.7, 6.9], [Math.PI / 2, 0, 0], concrete);
  slab(api, [0.2, 4.1, 4.6], [-15.1, 2.05, 6.9], concrete);
  slab(api, [2.7, 4.1, 0.2], [-13.8, 2.05, 4.65], concrete);
  slab(api, [2.7, 4.1, 0.2], [-13.8, 2.05, 9.15], concrete);
  addCollider(api, -15.2, -15.0, 4.55, 9.25);
  addCollider(api, -15.2, -12.4, 4.55, 4.75);
  addCollider(api, -15.2, -12.4, 9.05, 9.25);
  const terminal = slab(api, [0.75, 0.9, 0.8], [-14.6, 0.65, 6.9], pbr({ color: 0x9d9380, roughness: 0.7 }));
  const terminalScreen = slab(api, [0.06, 0.5, 0.66], [-14.2, 1.05, 6.9], new THREE.MeshStandardMaterial({ color: 0x08110c, emissive: 0x2d7e52, emissiveIntensity: 0.8, roughness: 0.3 }));
  interactive(api, terminalScreen, "bunker_ascii", "Play the tiny ASCII version");
  interactive(api, terminal, "bunker_ascii", "Play the tiny ASCII version");
  for (let i = 0; i < 6; i += 1) {
    slab(api, [0.02, 0.018, 0.2 + Math.random() * 0.4], [-14.16, 0.86 + i * 0.06, 6.9], pbr({ color: 0x6fbf8a, emissive: 0x3f9f68, emissiveIntensity: 0.5 }));
  }
  lamp(api, [-14.4, 2.9, 6.9], 0x70b98c, powered ? 1.8 : 0.2, 5, { flicker: powered ? 0.2 : 0, seed: 51, glowSize: 0.7 });
  slab(api, [1.2, 0.06, 0.7], [-13.7, 0.6, 6.9], pbr({ color: 0x5a513f, roughness: 0.8 }));
  cylinder(api, 0.03, 0.03, 0.65, [-13.7, 0.3, 7.15], pbr({ color: 0x2e3630, metalness: 0.5 }));
  addCollider(api, -15.0, -14.0, 6.3, 7.5);

  // Wall clock in the main chamber, stopped at 13:13.
  const clockGroup = new THREE.Group();
  clockGroup.position.set(6.95, 2.55, 9.2);
  clockGroup.rotation.y = -Math.PI / 2;
  api.scene.add(clockGroup);
  const clockBody = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.12, 24), pbr({ color: 0x2d332f, metalness: 0.5, roughness: 0.5 }));
  clockBody.rotation.x = Math.PI / 2;
  clockGroup.add(clockBody);
  const clockFace = new THREE.Mesh(new THREE.CircleGeometry(0.52, 24), pbr({ color: 0xb9b8a2, emissive: powered ? 0x5b5b42 : 0x1c1d17, emissiveIntensity: 0.3, roughness: 0.5 }));
  clockFace.position.z = 0.08;
  clockGroup.add(clockFace);
  const handA = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.34, 0.02), pbr({ color: 0x171713 }));
  handA.position.set(0.06, 0.12, 0.1);
  handA.rotation.z = -0.72;
  clockGroup.add(handA);
  const handB = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.24, 0.02), pbr({ color: 0x171713 }));
  handB.position.set(-0.08, 0.06, 0.11);
  handB.rotation.z = 1.9;
  clockGroup.add(handB);
  interactive(api, clockBody, "bunker_clock", "Check the stopped clock");

  // Regulator cables and warning ring.
  for (let i = 0; i < 9; i += 1) {
    const angle = (i / 9) * Math.PI * 2;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(angle) * 1.7, 1.9 + Math.sin(angle) * 1.7, -14.2),
      new THREE.Vector3(Math.cos(angle) * 2.9, 0.3, -13.2),
      new THREE.Vector3(Math.cos(angle) * 3.8, 0.06, -11.4 + Math.sin(angle) * 0.8),
    ]);
    api.scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.065, 6), pbr({ color: 0x22201b, roughness: 0.7 })));
  }
  glow(api, [0, 0.06, -13.6], powered ? 0x5bbfa4 : 0x8c2b22, 6, powered ? 0.24 : 0.12);
  steamField(api, [-2.1, 0.4, -12.9], 18, 0xc7d6ce, 0.14);
}
