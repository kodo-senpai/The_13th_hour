import * as THREE from "three";
import { textures, tiled, nightSky } from "./worldTextures";
import { addCollider, cylinder, glow, imagePlane, interactive, lamp, pbr, plane, rainField, slab, sphere } from "./worldApi";
import type { ExpansionApi } from "./worldApi";

function clothMat(tint: string) {
  const map = tiled(textures.cloth(tint), 2, 2);
  return pbr({ map, roughness: 0.94, color: 0xffffff });
}

function bookcase(api: ExpansionApi, x: number, z: number, rotY: number, width: number, height: number) {
  const wood = pbr({ map: tiled(textures.wood(), 1.5, 2), roughness: 0.72 });
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = rotY;
  api.scene.add(group);
  const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.32), wood);
  body.position.y = height / 2 + 0.02;
  body.castShadow = true;
  group.add(body);
  const shelfMat = pbr({ color: 0x2c2018, roughness: 0.8 });
  for (let level = 0; level < 4; level += 1) {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(width - 0.12, 0.05, 0.34), shelfMat);
    shelf.position.set(0, 0.3 + level * (height - 0.4) / 4, 0.02);
    group.add(shelf);
  }
  const colors = [0x6e3b2a, 0x3d5261, 0x5b5a3b, 0x8c7a55, 0x4e2f3b, 0x2f4441, 0x7c613c];
  const total = Math.floor(width / 0.11);
  for (let level = 0; level < 4; level += 1) {
    for (let i = 0; i < total; i += 1) {
      if (Math.random() > 0.88) continue;
      const h = 0.18 + Math.random() * 0.16;
      const book = new THREE.Mesh(new THREE.BoxGeometry(0.06 + Math.random() * 0.035, h, 0.2), pbr({ color: colors[Math.floor(Math.random() * colors.length)], roughness: 0.85 }));
      book.position.set(-width / 2 + 0.1 + i * 0.11, 0.33 + level * (height - 0.4) / 4 + h / 2, 0.02);
      book.rotation.z = Math.random() > 0.92 ? 0.20 : 0;
      group.add(book);
    }
  }
  return group;
}

export function expandHome(api: ExpansionApi) {
  const { scene } = api;

  // Textured floor, ceiling and walls over the base shell.
  plane(api, [11.98, 15.98], [0, 0.005, 0], [-Math.PI / 2, 0, 0], pbr({ map: tiled(textures.wood(), 5, 7), roughness: 0.66, metalness: 0.03 }));
  plane(api, [11.98, 15.98], [0, 4.4, 0], [Math.PI / 2, 0, 0], pbr({ map: tiled(textures.plaster("#6c7062"), 4, 5), roughness: 0.95 }));
  plane(api, [11.9, 4.4], [0, 2.2, -7.885], [0, 0, 0], pbr({ map: tiled(textures.plaster("#8c8c76"), 4, 1.6), roughness: 0.9 }));
  plane(api, [5.9, 4.4], [-5.885, 2.2, -4.9], [0, Math.PI / 2, 0], pbr({ map: tiled(textures.plaster("#94927c"), 2, 1.6), roughness: 0.9 }));
  plane(api, [5.9, 4.4], [-5.885, 2.2, 3.9], [0, Math.PI / 2, 0], pbr({ map: tiled(textures.brick("#6d5748"), 2, 1.6), roughness: 0.9, bumpMap: textures.brick("#6d5748"), bumpScale: 0.03 }));
  plane(api, [15.9, 4.4], [5.885, 2.2, 0], [0, -Math.PI / 2, 0], pbr({ map: tiled(textures.plaster("#878b77"), 5, 1.6), roughness: 0.9 }));

  // Skirting boards and picture rail.
  const trim = pbr({ color: 0x33251b, roughness: 0.6 });
  slab(api, [11.9, 0.18, 0.08], [0, 0.09, -7.86], trim);
  slab(api, [0.08, 0.18, 15.8], [-5.86, 0.09, 0], trim);
  slab(api, [0.08, 0.18, 15.8], [5.86, 0.09, 0], trim);
  slab(api, [11.9, 0.05, 0.05], [0, 3.0, -7.86], pbr({ color: 0x4c3b2a, roughness: 0.7 }));

  // Front wall with door opening and night beyond.
  const frontWall = pbr({ map: tiled(textures.plaster("#8a8871"), 3, 1.5), roughness: 0.9 });
  slab(api, [4.0, 4.4, 0.16], [-3.95, 2.2, 7.92], frontWall);
  slab(api, [3.0, 4.4, 0.16], [1.4, 2.2, 7.92], frontWall);
  slab(api, [2.0, 1.6, 0.16], [-1.4, 3.6, 7.92], frontWall);
  const doorMat = pbr({ map: tiled(textures.wood(), 1, 2), color: 0x8e7b62, roughness: 0.55 });
  slab(api, [1.65, 2.9, 0.1], [-1.4, 1.45, 7.9], doorMat);
  for (let i = 0; i < 3; i += 1) slab(api, [0.85, 0.5, 0.04], [-1.62 + (i % 2) * 0.44, 0.65 + i * 0.7, 7.84], pbr({ color: 0x73624d, roughness: 0.6 }));
  sphere(api, 0.05, [-0.72, 1.35, 7.82], pbr({ color: 0xb99553, metalness: 0.85, roughness: 0.25 }));
  imagePlane(api, "images/rajiv-portrait.jpg", [0.72, 0.96], [-3.4, 2.25, 7.82], [0, Math.PI, 0], { id: "home_rajiv_portrait", label: "Look at the portrait of Rajiv", frameColor: 0x4b3a29 });

  // Partition into the bedroom, with a working doorway.
  const partitionMat = pbr({ map: tiled(textures.plaster("#7e8270"), 1.4, 1.3), roughness: 0.9 });
  slab(api, [1.0, 3.2, 0.16], [2.4, 1.6, 3.95], partitionMat);
  slab(api, [1.95, 3.2, 0.16], [4.93, 1.6, 3.95], partitionMat);
  slab(api, [1.05, 0.85, 0.16], [3.4, 2.78, 3.95], partitionMat);
  addCollider(api, 1.88, 2.92, 3.84, 4.06);
  addCollider(api, 3.94, 5.92, 3.84, 4.06);
  slab(api, [0.07, 2.36, 0.2], [2.9, 1.18, 3.94], pbr({ color: 0x3d2c1f, roughness: 0.55 }));
  slab(api, [0.07, 2.36, 0.2], [3.9, 1.18, 3.94], pbr({ color: 0x3d2c1f, roughness: 0.55 }));
  slab(api, [1.06, 0.08, 0.2], [3.4, 2.35, 3.94], pbr({ color: 0x3d2c1f, roughness: 0.55 }));
  imagePlane(api, "images/family-photo.jpg", [0.62, 0.43], [4.9, 2.15, 3.85], [0, Math.PI, 0], { id: "home_hall_photo", label: "The photograph on the partition wall", frameColor: 0x3a2a1d });

  // Living room: rug, sofa, cushions, coffee table and table lamp.
  plane(api, [4.4, 3.2], [-1.9, 0.012, 2.25], [-Math.PI / 2, 0, 0], clothMat("#55402f"));
  const sofaBase = slab(api, [3.0, 0.45, 1.05], [-2.0, 0.3, 2.75], clothMat("#4a4036"));
  const sofaBack = slab(api, [3.0, 1.0, 0.24], [-2.0, 0.92, 3.26], clothMat("#463c33"));
  slab(api, [0.24, 0.62, 1.0], [-3.42, 0.66, 2.76], clothMat("#42382f"));
  slab(api, [0.24, 0.62, 1.0], [-0.58, 0.66, 2.76], clothMat("#42382f"));
  sofaBase.rotation.x = 0.02;
  sofaBack.rotation.x = -0.06;
  const cushionColors = ["#7d5535", "#6a6350", "#8b5e42"];
  [-2.9, -2.0, -1.1].forEach((x, i) => {
    const cushion = slab(api, [0.72, 0.42, 0.16], [x, 0.72, 3.02], clothMat(cushionColors[i]), { rotation: [-0.24, 0, i % 2 ? 0.06 : -0.06] });
    cushion.castShadow = true;
  });
  addCollider(api, -3.6, -0.4, 2.1, 3.4);
  slab(api, [1.6, 0.08, 0.82], [-1.9, 0.48, 1.25], pbr({ map: tiled(textures.wood(), 1.4, 1), color: 0xa78f74, roughness: 0.5 }));
  [-2.55, -1.25].forEach((x) => [-0.15, 0.25].forEach((offset) => slab(api, [0.07, 0.44, 0.07], [x, 0.24, 1.25 + offset], pbr({ color: 0x35261b, roughness: 0.65 }))));
  addCollider(api, -2.75, -1.05, 0.82, 1.7);
  cylinder(api, 0.12, 0.09, 0.06, [-2.2, 0.55, 1.1], pbr({ color: 0xb9b29d, roughness: 0.4 }));
  cylinder(api, 0.055, 0.075, 0.16, [-2.2, 0.63, 1.1], pbr({ color: 0xa79b82, roughness: 0.35 }));
  cylinder(api, 0.13, 0.18, 0.03, [-1.75, 0.54, 1.45], pbr({ color: 0xc6bda3, roughness: 0.9 }), [0, 0.3, 0]);
  lamp(api, [-0.7, 1.26, 2.9], 0xffc183, 2.2, 5, { glowSize: 0.7, seed: 9 });
  cylinder(api, 0.03, 0.03, 0.55, [-0.7, 1.1, 2.9], pbr({ color: 0x3f362b, roughness: 0.6 }));
  cylinder(api, 0.16, 0.23, 0.24, [-0.7, 1.36, 2.9], pbr({ color: 0xc8a878, roughness: 0.85, side: THREE.DoubleSide }));
  lamp(api, [-0.7, 1.44, 2.9], 0xffb877, 1.6, 4, { glowSize: 0.5, seed: 3 });

  // Ceiling fan.
  const fan = new THREE.Group();
  fan.position.set(-1.8, 4.0, 1.4);
  scene.add(fan);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.55, 8), pbr({ color: 0x3f3a2f, metalness: 0.5, roughness: 0.5 }));
  rod.position.y = 0.3;
  fan.add(rod);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.13, 12), pbr({ color: 0x8b7b5c, metalness: 0.45, roughness: 0.5 }));
  fan.add(hub);
  const blades = new THREE.Group();
  fan.add(blades);
  const bladeMat = pbr({ color: 0x4e3c2d, roughness: 0.7 });
  for (let i = 0; i < 3; i += 1) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.025, 0.24), bladeMat);
    blade.position.x = 0.68;
    blade.rotation.z = 0.08;
    const arm = new THREE.Group();
    arm.rotation.y = (i / 3) * Math.PI * 2;
    arm.add(blade);
    blades.add(arm);
  }
  api.animated.push((time) => {
    blades.rotation.y = time * 2.1;
  });

  // Dining table and chairs.
  const tableTop = slab(api, [1.9, 0.09, 1.0], [2.85, 0.79, 0.9], pbr({ map: tiled(textures.wood(), 1.6, 1), color: 0xa88f70, roughness: 0.45 }));
  tableTop.castShadow = true;
  [[2.05, 0.55], [3.65, 0.55], [2.05, 1.25], [3.65, 1.25]].forEach(([x, z]) => slab(api, [0.08, 0.76, 0.08], [x, 0.39, z], pbr({ color: 0x3e2c1e, roughness: 0.66 })));
  slab(api, [0.9, 0.02, 0.65], [2.75, 0.84, 0.9], pbr({ color: 0xbfb49b, roughness: 0.9 }));
  const diningChairMat = pbr({ map: tiled(textures.wood(), 1, 1), color: 0x7d6145, roughness: 0.6 });
  [[2.85, -0.05], [2.85, 1.85], [1.55, 0.9], [4.15, 0.9]].forEach(([x, z], index) => {
    slab(api, [0.44, 0.07, 0.44], [x, 0.48, z], diningChairMat);
    slab(api, [0.44, 0.5, 0.06], [x, 0.75, z + (index < 2 ? (index === 0 ? -0.22 : 0.22) : 0)], diningChairMat);
    [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]].forEach(([dx, dz]) => slab(api, [0.05, 0.46, 0.05], [x + dx, 0.23, z + dz], diningChairMat));
  });
  addCollider(api, 1.3, 4.4, -0.35, 2.15);
  cylinder(api, 0.15, 0.1, 0.1, [2.75, 0.9, 0.75], pbr({ color: 0xb8ad91, roughness: 0.35 }));
  for (let i = 0; i < 3; i += 1) {
    const fruit = sphere(api, 0.09, [2.7 + i * 0.12, 0.99 + (i === 1 ? 0.05 : 0), 0.78], pbr({ color: i === 1 ? 0x9c7a2b : 0x8f4b2a, roughness: 0.7 }));
    fruit.scale.y = 0.9;
  }

  // Kitchen run with cabinets, counter, sink, stove and hanging utensils.
  const cabinetMat = pbr({ map: tiled(textures.wood(), 1, 1), color: 0x8f7d61, roughness: 0.62 });
  slab(api, [0.72, 0.86, 5.7], [-5.5, 0.44, -4.4], cabinetMat);
  slab(api, [0.84, 0.07, 5.8], [-5.5, 0.9, -4.4], pbr({ map: tiled(textures.tiles("#a6aa97", "#777a6b"), 2, 5), roughness: 0.3, metalness: 0.05 }));
  slab(api, [0.82, 0.04, 5.8], [-5.5, 0.97, -4.4], pbr({ color: 0x3e4642, roughness: 0.30, metalness: 0.35 }));
  addCollider(api, -5.92, -5.05, -7.3, -1.5);
  slab(api, [0.5, 0.03, 4.6], [-5.82, 2.5, -4.3], pbr({ map: tiled(textures.plaster("#8f8d76"), 1, 1), roughness: 0.6 }));
  for (let i = 0; i < 5; i += 1) slab(api, [0.58, 0.64, 0.02], [-5.83, 2.15 + (i % 2) * 0.7, -6.4 + i * 1.0], pbr({ color: 0x6e624c, roughness: 0.7 }));
  const steel = pbr({ color: 0x9aa4a0, metalness: 0.75, roughness: 0.28 });
  slab(api, [0.5, 0.09, 0.66], [-5.5, 0.86, -5.85], steel);
  slab(api, [0.45, 0.02, 0.58], [-5.5, 0.92, -5.85], pbr({ color: 0x515b57, metalness: 0.6, roughness: 0.35 }));
  cylinder(api, 0.028, 0.028, 0.5, [-5.75, 1.16, -5.85], steel, [0, 0, Math.PI / 2]);
  slab(api, [0.55, 0.08, 0.62], [-5.5, 0.88, -2.6], steel);
  [[-5.62, -2.85], [-5.38, -2.85], [-5.62, -2.4]].forEach(([x, z]) => cylinder(api, 0.1, 0.1, 0.02, [x, 0.94, z], pbr({ color: 0x2b2c28, roughness: 0.5 })));
  cylinder(api, 0.15, 0.12, 0.26, [-5.38, 1.05, -2.55], pbr({ color: 0x9d3c2c, metalness: 0.4, roughness: 0.35 }));
  const kettleSpout = cylinder(api, 0.025, 0.025, 0.2, [-5.24, 1.1, -2.55], steel, [0, 0, -0.9]);
  kettleSpout.position.y = 0.1;
  slab(api, [0.03, 0.55, 1.6], [-5.85, 2.05, -2.7], pbr({ color: 0x3b3830, metalness: 0.6, roughness: 0.4 }));
  for (let i = 0; i < 4; i += 1) {
    cylinder(api, 0.055, 0.05, 0.16, [-5.78, 1.74, -2.0 + i * 0.2], pbr({ color: 0x8d8f80, metalness: 0.6, roughness: 0.35 }), [0, 0, 0.1 * i]);
  }
  for (let i = 0; i < 6; i += 1) {
    const jar = cylinder(api, 0.09, 0.09, 0.16 + (i % 3) * 0.03, [-5.55, 0.98, -6.6 + i * 0.42], pbr({ color: [0x8f6c3d, 0x5d7059, 0xa88a5c][i % 3], roughness: 0.5 }));
    jar.castShadow = true;
  }
  interactive(api, slab(api, [0.28, 0.15, 0.28], [-5.45, 1.05, -2.55], pbr({ color: 0xb04d33, emissive: 0x461a10, roughness: 0.6 })), "home_kitchen_kettle", "Inspect the kettle");
  lamp(api, [-5.0, 2.62, -4.2], 0xffbf80, 2.4, 6, { glowSize: 0.9, seed: 12 });
  slab(api, [0.8, 0.06, 1.9], [-4.85, 0.79, -1.6], pbr({ map: tiled(textures.wood(), 1.2, 1), color: 0x9d8060, roughness: 0.55 }));
  [[-5.15, -2.3], [-4.55, -2.3], [-5.15, -0.9], [-4.55, -0.9]].forEach(([x, z]) => slab(api, [0.07, 0.76, 0.07], [x, 0.4, z], pbr({ color: 0x3b2a1f, roughness: 0.62 })));
  addCollider(api, -5.3, -4.4, -2.55, -0.65);

  // Study: chair, papers, typewriter, desk lamp and letters.
  const deskWood = pbr({ map: tiled(textures.wood(), 1.6, 1), color: 0x9e805d, roughness: 0.48 });
  slab(api, [1.1, 0.09, 0.7], [-2.55, 0.9, -4.6], deskWood);
  slab(api, [0.95, 0.03, 0.05], [-2.55, 1.0, -4.9], pbr({ color: 0xb3a687, roughness: 0.9 }));
  slab(api, [0.7, 0.01, 0.4], [-2.75, 0.955, -4.35], pbr({ color: 0xc9bea1, roughness: 0.92 }));
  const chairMat = pbr({ color: 0x3e2f22, roughness: 0.7 });
  slab(api, [0.48, 0.07, 0.48], [-2.55, 0.48, -2.95], chairMat);
  slab(api, [0.48, 0.62, 0.07], [-2.55, 0.85, -2.7], chairMat);
  [[-2.75, -3.15], [-2.35, -3.15], [-2.75, -2.75], [-2.35, -2.75]].forEach(([x, z]) => slab(api, [0.05, 0.46, 0.05], [x, 0.23, z], chairMat));
  const letters = slab(api, [0.42, 0.06, 0.3], [-3.15, 0.98, -3.7], pbr({ color: 0xd1c6aa, roughness: 0.92 }), { rotation: [0, 0.3, 0] });
  interactive(api, letters, "home_letters", "Read the half-finished letters");
  slab(api, [0.3, 0.25, 0.3], [-2.05, 1.12, -4.4], pbr({ color: 0x2e3331, metalness: 0.5, roughness: 0.4 }));
  for (let row = 0; row < 3; row += 1) for (let col = 0; col < 5; col += 1) {
    cylinder(api, 0.022, 0.022, 0.02, [-2.13 + col * 0.04, 1.24, -4.48 + row * 0.04], pbr({ color: 0xd8d0b6, roughness: 0.4 }));
  }
  cylinder(api, 0.05, 0.05, 0.03, [-2.5, 1.0, -4.35], pbr({ color: 0x6f5330, roughness: 0.5 }));
  lamp(api, [-1.35, 1.5, -4.55], 0xffce8e, 2.0, 4, { glowSize: 0.6, seed: 8 });
  bookcase(api, 5.6, -2.2, -Math.PI / 2, 1.8, 2.2);
  addCollider(api, 5.3, 5.9, -3.1, -1.3);
  bookcase(api, 4.8, 3.72, Math.PI, 1.7, 2.1);

  // Bedroom.
  slab(api, [1.65, 0.4, 2.2], [4.55, 0.32, 5.9], pbr({ map: tiled(textures.wood(), 1, 2), color: 0x6e5941, roughness: 0.62 }));
  const mattress = slab(api, [1.58, 0.24, 2.1], [4.55, 0.64, 5.9], clothMat("#a39681"));
  mattress.castShadow = true;
  slab(api, [1.55, 0.1, 1.25], [4.55, 0.8, 6.25], clothMat("#6d5543"), { rotation: [0.02, 0, 0] });
  const pillow = slab(api, [0.62, 0.14, 0.38], [4.28, 0.83, 5.02], clothMat("#c1b49b"), { rotation: [-0.08, 0.08, 0] });
  pillow.castShadow = true;
  slab(api, [1.75, 0.86, 0.1], [4.55, 0.72, 4.82], pbr({ map: tiled(textures.wood(), 1, 1), color: 0x65503b, roughness: 0.6 }));
  addCollider(api, 3.65, 5.45, 4.7, 7.05);
  slab(api, [0.5, 0.52, 0.5], [3.2, 0.28, 5.05], pbr({ map: tiled(textures.wood(), 1, 1), color: 0x6d5740, roughness: 0.6 }));
  addCollider(api, 2.9, 3.5, 4.75, 5.35);
  lamp(api, [3.2, 0.95, 5.05], 0xffb678, 2.0, 4.5, { glowSize: 0.55, seed: 5 });
  slab(api, [0.55, 0.9, 1.7], [2.4, 1.32, 6.7], pbr({ map: tiled(textures.wood(), 1, 2), color: 0x6b563f, roughness: 0.65 }));
  addCollider(api, 2.1, 2.7, 5.8, 7.4);
  plane(api, [2.6, 1.9], [3.9, 0.014, 6.0], [-Math.PI / 2, 0, 0], clothMat("#58453a"));
  imagePlane(api, "images/family-photo.jpg", [0.56, 0.38], [4.85, 1.9, 3.82], [0, Math.PI, 0], { id: "home_bedroom_photo", label: "The photograph above the bed", frameColor: 0x3c2b1d });
  // Window onto the rainy night.
  plane(api, [1.4, 1.25], [5.865, 2.35, 6.1], [0, -Math.PI / 2, 0], pbr({ map: nightSky(), emissive: 0x3d5f5a, emissiveMap: nightSky(), emissiveIntensity: 0.55, roughness: 0.3 }));
  const frameMat = pbr({ color: 0x2b231b, roughness: 0.6 });
  slab(api, [0.06, 1.4, 0.08], [5.8, 2.35, 5.42], frameMat);
  slab(api, [0.06, 1.4, 0.08], [5.8, 2.35, 6.78], frameMat);
  slab(api, [0.06, 0.08, 1.44], [5.8, 3.03, 6.1], frameMat);
  slab(api, [0.06, 0.08, 1.44], [5.8, 1.67, 6.1], frameMat);
  slab(api, [0.04, 1.3, 0.04], [5.79, 2.35, 6.1], frameMat);
  rainField(api, { minX: 6.0, maxX: 6.9, minZ: 5.4, maxZ: 6.8, top: 3.4 }, 90, 0xacc9c1, 0.28, 4.5);

  // Hallway details: shoe rack, mirror, umbrella, coat stand, dim bulb.
  slab(api, [1.1, 0.8, 0.42], [-4.5, 0.4, 6.85], pbr({ map: tiled(textures.wood(), 1, 1), color: 0x6b5640, roughness: 0.6 }));
  addCollider(api, -5.1, -3.9, 6.6, 7.4);
  [-4.85, -4.5, -4.15].forEach((x) => slab(api, [0.26, 0.09, 0.3], [x, 0.1, 6.95], pbr({ color: 0x2d2822, roughness: 0.7 })));
  plane(api, [0.8, 1.25], [-5.86, 1.72, 6.2], [0, Math.PI / 2, 0], pbr({ color: 0x8fa5a0, metalness: 0.75, roughness: 0.12 }));
  slab(api, [0.05, 1.38, 0.92], [-5.83, 1.72, 6.2], pbr({ color: 0x4c3a27, roughness: 0.5 }));
  const umbrella = cylinder(api, 0.035, 0.06, 0.92, [-4.0, 0.46, 7.1], pbr({ color: 0x2c3a44, roughness: 0.7 }), [0.16, 0, 0.1]);
  interactive(api, umbrella, "home_umbrella", "Inspect the umbrella");
  cylinder(api, 0.035, 0.035, 1.85, [-5.25, 0.95, 4.65], pbr({ color: 0x8e764f, metalness: 0.6, roughness: 0.4 }));
  slab(api, [0.9, 0.08, 0.08], [-5.25, 1.82, 4.65], pbr({ color: 0x8e764f, metalness: 0.6, roughness: 0.4 }));
  slab(api, [0.42, 0.85, 0.16], [-5.12, 1.3, 4.65], pbr({ color: 0x3b4045, roughness: 0.9 }), { rotation: [0, 0, 0.03] });
  slab(api, [0.36, 0.86, 0.14], [-5.4, 1.24, 4.65], pbr({ color: 0x5b4a3a, roughness: 0.9 }));
  interactive(api, slab(api, [0.06, 0.06, 0.2], [-3.7, 1.3, 7.8], pbr({ color: 0xc1a05f, metalness: 0.8, roughness: 0.25 })), "home_door", "Inspect the front door");
  lamp(api, [-3.9, 2.7, 7.55], 0xffbd7a, 1.5, 5, { glowSize: 0.7, seed: 6 });

  // Wall clock with pendulum.
  const clockGroup = new THREE.Group();
  clockGroup.position.set(-5.78, 2.8, 0.4);
  clockGroup.rotation.y = Math.PI / 2;
  scene.add(clockGroup);
  const clockBody = new THREE.Mesh(new THREE.BoxGeometry(0.62, 1.1, 0.12), pbr({ color: 0x3e2c1d, roughness: 0.5 }));
  clockGroup.add(clockBody);
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.22, 22), pbr({ color: 0xd2c6a5, roughness: 0.5 }));
  face.position.z = 0.07;
  clockGroup.add(face);
  const minute = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.18, 0.01), pbr({ color: 0x1a1714 }));
  minute.position.set(0, 0.06, 0.085);
  clockGroup.add(minute);
  const pendulumGroup = new THREE.Group();
  pendulumGroup.position.set(0, -0.42, 0.07);
  clockGroup.add(pendulumGroup);
  const pendulum = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.32, 6), pbr({ color: 0x8d7a50, metalness: 0.7, roughness: 0.3 }));
  pendulum.position.y = -0.16;
  pendulumGroup.add(pendulum);
  const bob = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), pbr({ color: 0xb8934f, metalness: 0.85, roughness: 0.25 }));
  bob.position.y = -0.32;
  pendulumGroup.add(bob);
  api.animated.push((time) => {
    pendulumGroup.rotation.z = Math.sin(time * 2.2) * 0.16;
    minute.rotation.z = -time * 0.02;
  });
  interactive(api, clockBody, "home_clock", "Check the wall clock");

  // Plants, books and clutter for a lived-in feel.
  const plantPot = cylinder(api, 0.24, 0.18, 0.4, [4.95, 0.2, 1.9], pbr({ color: 0x7a4a33, roughness: 0.8 }));
  plantPot.castShadow = true;
  for (let i = 0; i < 9; i += 1) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.13, 6, 4), pbr({ color: 0x435c3d, roughness: 0.9 }));
    leaf.scale.set(0.35, 1.5 + Math.random() * 0.6, 0.18);
    leaf.position.set(4.95 + Math.cos(i) * 0.17, 0.62 + Math.random() * 0.32, 1.9 + Math.sin(i) * 0.17);
    leaf.rotation.z = Math.cos(i) * 0.6;
    api.scene.add(leaf);
  }
  for (let i = 0; i < 7; i += 1) {
    const bundle = slab(api, [0.28, 0.06, 0.2], [-3.2 + Math.random() * 0.5, 0.96 + i * 0.055, -3.55 + Math.random() * 0.3], pbr({ color: 0xc9bda2, roughness: 0.95 }), { rotation: [0, Math.random() * 0.5 - 0.25, 0] });
    bundle.castShadow = false;
  }
  // Loose photos in a study box.
  const box = slab(api, [0.42, 0.18, 0.32], [4.2, 1.02, -5.35], pbr({ color: 0x65503b, roughness: 0.8 }));
  interactive(api, box, "home_study_box", "Search the keepsake box");
  for (let i = 0; i < 4; i += 1) {
    const photo = slab(api, [0.16, 0.005, 0.12], [4.1 + i * 0.06, 1.13 + i * 0.002, -5.3], pbr({ color: 0xd3c8ad, roughness: 0.9 }), { rotation: [0, i * 0.35, 0] });
    photo.castShadow = false;
  }
  glow(api, [-5.0, 0.85, -4.2], 0xffc27c, 0.5, 0.2);
}
