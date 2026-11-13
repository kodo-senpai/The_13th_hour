import * as THREE from "three";
import { graffitiTexture, nightSky, noticePoster, signTexture, textures, tiled } from "./worldTextures";
import {
  addCollider,
  catenary,
  cylinder,
  glow,
  imagePlane,
  interactive,
  lamp,
  pbr,
  plane,
  puddle,
  rainField,
  signPlane,
  slab,
  sphere,
  steamField,
} from "./worldApi";
import type { ExpansionApi } from "./worldApi";

const WARM = 0xffb262;
const COOL = 0x9fd8cc;
const SODIUM = 0xffa24d;

function eraColor(api: ExpansionApi, past: number, present: number) {
  return api.era === "past" ? past : present;
}

function bench(api: ExpansionApi, x: number, z: number, rotY = 0, id = "station_bench") {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = rotY;
  api.scene.add(group);
  const wood = pbr({ map: tiled(textures.wood(), 2, 0.5), color: 0x9b7f5c, roughness: 0.65 });
  const iron = pbr({ color: 0x2b3230, metalness: 0.7, roughness: 0.42 });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 0.52), wood);
  seat.position.y = 0.5;
  seat.castShadow = true;
  group.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.5, 0.07), wood);
  back.position.set(0, 0.8, -0.24);
  back.rotation.x = -0.14;
  group.add(back);
  [-0.75, 0.75].forEach((offset) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.5, 0.44), iron);
    leg.position.set(offset, 0.25, 0);
    group.add(leg);
    const backPost = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 0.06), iron);
    backPost.position.set(offset, 0.72, -0.23);
    group.add(backPost);
  });
  interactive(api, seat, id, "Rest on the old platform bench");
  addCollider(api, x - 1.05, x + 1.05, z - 0.36, z + 0.36);
  return group;
}

function platformDetails(api: ExpansionApi) {
  const past = api.era === "past";
  plane(api, [8.95, 41.8], [-0.5, 0.283, 0], [-Math.PI / 2, 0, 0], pbr({ map: tiled(textures.concrete("#707b74"), 5, 22), roughness: 0.93, bumpMap: textures.concrete("#707b74"), bumpScale: 0.015 }));
  // Platform edge line and drainage channel.
  slab(api, [0.14, 0.02, 41.7], [3.72, 0.29, 0], pbr({ color: 0xcfc07c, roughness: 0.8 }));
  slab(api, [0.2, 0.03, 41.7], [-4.4, 0.29, 0], pbr({ color: 0x333c39, roughness: 0.9 }));

  bench(api, 2.35, 7.2);
  bench(api, 2.35, -2.6);
  bench(api, -3.1, 15.4, Math.PI, "station_bench_far");

  // Notice board with missing posters.
  signPlane(api, signTexture({ title: "NOTICES", sub: "NORTHERN RAILWAY", lines: ["SURAJPUR HALT IS CLOSED", "UNTIL FURTHER NOTICE", "THE NOTICE IS ALSO CLOSED"], accent: "#b9a06c", wear: true }), [2.2, 1.15], [-2.55, 2.1, -19.72], [0, 0, 0], { interactiveId: "station_noticeboard", label: "Read the station notice board", emissiveIntensity: 0.08 });
  imagePlane(api, "images/rajiv-portrait.jpg", [0.6, 0.8], [-0.9, 1.95, -19.7], [0, 0, 0], { id: "station_missing_poster", label: "Read the missing-person poster", frameColor: 0x3c2a1d });
  const missingPaper = plane(api, [0.7, 0.9], [-0.9, 1.95, -19.68], [0, 0, 0], pbr({ map: noticePoster({ title: "MISSING", body: ["RAJIV MALHOTRA", "LAST SEEN 14/11/98"], accent: "#8a3327" }), opacity: 0.42, roughness: 0.9 }));
  missingPaper.visible = true;

  // Luggage, bins, water cooler, coolie cart and scattered litter.
  const leather = pbr({ color: 0x4b3326, roughness: 0.78 });
  const trunk = slab(api, [0.85, 0.5, 0.5], [-3.5, 0.55, 9.5], leather);
  trunk.rotation.y = 0.24;
  slab(api, [0.86, 0.06, 0.07], [-3.5, 0.78, 9.25], pbr({ color: 0x9e8248, metalness: 0.7, roughness: 0.35 }));
  interactive(api, trunk, "station_luggage", "Inspect the abandoned luggage");
  addCollider(api, -3.95, -3.05, 9.1, 9.9);
  const bin = cylinder(api, 0.32, 0.36, 0.85, [3.1, 0.28, 12.5], pbr({ color: 0x3d4b42, metalness: 0.5, roughness: 0.6 }));
  bin.castShadow = true;
  cylinder(api, 0.34, 0.34, 0.06, [3.1, 0.72, 12.5], pbr({ color: 0x2e3831, metalness: 0.5, roughness: 0.5 }));
  slab(api, [0.72, 1.15, 0.6], [-3.55, 0.77, 12.3], pbr({ color: 0x6d7f72, metalness: 0.3, roughness: 0.5 }));
  interactive(api, slab(api, [0.6, 0.07, 0.5], [-3.55, 1.32, 12.3], pbr({ color: 0x9aa49d, roughness: 0.35 })), "station_water", "Try the drinking water cooler");
  addCollider(api, -3.95, -3.15, 11.95, 12.65);
  // Coolie cart.
  const cart = new THREE.Group();
  cart.position.set(-1.8, 0, 3.6);
  cart.rotation.y = 0.5;
  api.scene.add(cart);
  const cartWood = pbr({ map: tiled(textures.wood(), 1, 0.5), color: 0x876748, roughness: 0.7 });
  const bed = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.08, 0.8), cartWood);
  bed.position.y = 0.45;
  cart.add(bed);
  [[-0.5, -0.32], [0.5, -0.32], [-0.5, 0.32], [0.5, 0.32]].forEach(([x, z]) => {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 14), pbr({ color: 0x2c2e2a, roughness: 0.6 }));
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.22, z);
    cart.add(wheel);
  });
  for (let i = 0; i < 3; i += 1) {
    const caseMesh = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.2, 0.32), pbr({ color: [0x513c2a, 0x3e4b52, 0x6a4f35][i], roughness: 0.8 }));
    caseMesh.position.set(-0.4 + i * 0.36, 0.6, 0);
    caseMesh.rotation.y = i * 0.2;
    cart.add(caseMesh);
  }
  interactive(api, bed, "station_cart", "Inspect the coolie's trolley");
  addCollider(api, -2.7, -0.9, 2.9, 4.3);

  // Poster display on the pillars.
  imagePlane(api, "images/platform-photo.jpg", [0.74, 0.5], [-3.62, 1.95, 5.0], [0, Math.PI / 2, 0], { id: "station_platform_photo", label: "Study the old platform photograph", frameColor: 0x3a2a1e });
  signPlane(api, signTexture({ title: "THE HOUR IS LATE", sub: "SURAJPUR WELFARE ASSOCIATION", lines: ["PLATFORM 2 REMAINS", "TEMPORARILY PERMANENT"], accent: "#9d3c2c", wear: true }), [1.35, 0.9], [-3.63, 1.6, -6.5], [0, Math.PI / 2, 0]);

  // Direction signs.
  signPlane(api, signTexture({ title: "PLATFORM 2", sub: "MAIL EXPRESS", lines: ["< WAY OUT"], accent: "#c3b070" }), [1.7, 0.6], [-1.1, 3.3, -2], [0, 0, 0], { emissiveIntensity: 0.25 });
  signPlane(api, signTexture({ title: "TICKET HALL", sub: "TOWN / BAZAAR", lines: ["> 40 m"], accent: "#c3b070" }), [1.7, 0.6], [-1.1, 3.3, 5], [0, Math.PI, 0], { emissiveIntensity: 0.25 });

  // Hanging bulbs under the canopy.
  [-12, 6].forEach((z, i) => lamp(api, [-1.1, 3.62, z], eraColor(api, WARM, COOL), past ? 3.1 : 1.8, 9, { flicker: past ? 0.1 : 0.6, seed: i + 2, glowSize: 1.1 }));
  if (past) addStringLights(api, new THREE.Vector3(-2.4, 3.4, -18), new THREE.Vector3(-2.4, 3.4, 17), 16);

  rainField(api, { minX: 4.4, maxX: 8, minZ: -20, maxZ: 20, top: 5 }, 100, 0xa9c7c1, 0.22, 6);
}

function addStringLights(api: ExpansionApi, from: THREE.Vector3, to: THREE.Vector3, count: number) {
  const wire = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([from, new THREE.Vector3((from.x + to.x) / 2, from.y - 0.35, (from.z + to.z) / 2), to]),
    new THREE.LineBasicMaterial({ color: 0x1d201c }),
  );
  api.scene.add(wire);
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffd08a });
  for (let i = 1; i < count; i += 1) {
    const t = i / count;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 4), bulbMat);
    bulb.position.set(from.x, from.y - Math.sin(t * Math.PI) * 0.3, from.z + (to.z - from.z) * t);
    api.scene.add(bulb);
  }
}

function clockTower(api: ExpansionApi) {
  const past = api.era === "past";
  const wrong = api.era === "wrong";
  const brickMat = pbr({ map: tiled(textures.brick("#6b5344"), 2.4, 4), roughness: 0.9, bumpMap: textures.brick("#6b5344"), bumpScale: 0.04 });
  slab(api, [4.1, 6.4, 3.4], [-0.8, 8.0, -22], brickMat);
  slab(api, [4.5, 0.35, 3.8], [-0.8, 11.3, -22], pbr({ color: 0x7b7362, roughness: 0.8 }));
  slab(api, [4.3, 2.9, 3.6], [-0.8, 13.0, -22], brickMat);
  slab(api, [4.8, 0.35, 4.0], [-0.8, 14.6, -22], pbr({ color: 0x827a68, roughness: 0.8 }));
  // Louvred vents.
  for (let i = 0; i < 6; i += 1) slab(api, [0.85, 0.09, 0.08], [-0.8, 11.7 + i * 0.24, -20.16], pbr({ color: 0x24251f, roughness: 0.7 }));
  // Clock face facing the platform.
  const faceGroup = new THREE.Group();
  faceGroup.position.set(-0.8, 13.0, -20.17);
  api.scene.add(faceGroup);
  const face = new THREE.Mesh(new THREE.CylinderGeometry(1.32, 1.32, 0.12, 30), pbr({ color: past ? 0xd8cba6 : 0xaeb8ad, emissive: past ? 0x7b6537 : 0x2d4140, emissiveIntensity: 0.45, roughness: 0.6 }));
  face.rotation.x = Math.PI / 2;
  faceGroup.add(face);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.34, 0.09, 8, 30), pbr({ color: 0x2f2a21, metalness: 0.55, roughness: 0.4 }));
  faceGroup.add(rim);
  for (let i = 0; i < 12; i += 1) {
    const tick = new THREE.Mesh(new THREE.BoxGeometry(0.035, i % 3 === 0 ? 0.15 : 0.08, 0.02), pbr({ color: 0x24201a }));
    const angle = (i / 12) * Math.PI * 2;
    tick.position.set(Math.sin(angle) * 1.05, Math.cos(angle) * 1.05, 0.08);
    tick.rotation.z = -angle;
    faceGroup.add(tick);
  }
  const hourHand = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.62, 0.03), pbr({ color: 0x161410 }));
  hourHand.position.set(0.15, 0.2, 0.1);
  hourHand.rotation.z = -0.9;
  faceGroup.add(hourHand);
  const minuteHand = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.92, 0.02), pbr({ color: 0x161410 }));
  minuteHand.position.set(-0.1, 0.4, 0.12);
  minuteHand.rotation.z = wrong ? 0.2 : 0.55;
  faceGroup.add(minuteHand);
  const secondHand = new THREE.Mesh(new THREE.BoxGeometry(0.015, 1.0, 0.01), pbr({ color: wrong ? 0x9f3127 : 0x7f2a21 }));
  secondHand.position.y = 0.44;
  faceGroup.add(secondHand);
  api.animated.push((time) => {
    if (wrong) secondHand.rotation.z = -time * 0.12;
    else secondHand.rotation.z = time * 0.05;
  });
  // Roof and finial.
  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.2, 2.4, 4), pbr({ color: 0x353b3a, roughness: 0.7, metalness: 0.15 }));
  roof.position.set(-0.8, 15.9, -22);
  roof.rotation.y = Math.PI / 4;
  api.scene.add(roof);
  const spire = cylinder(api, 0.04, 0.07, 1.4, [-0.8, 17.6, -22], pbr({ color: 0x373b38, metalness: 0.5, roughness: 0.4 }));
  spire.castShadow = true;
  glow(api, [-0.8, 18.3, -22], wrong ? 0xb02c22 : 0xe0c98a, wrong ? 1.8 : 0.9, wrong ? 0.8 : 0.4);
  const wrongLight = new THREE.PointLight(0xc23529, 0, 12, 2);
  wrongLight.position.set(-0.8, 15.6, -21);
  api.scene.add(wrongLight);
  if (wrong) {
    wrongLight.intensity = 4;
    api.animated.push((time) => {
      wrongLight.intensity = 2 + 2.2 * Math.pow(Math.max(0, Math.sin(time * 1.9)), 4);
    });
  }
  // Stationmaster office door in the tower base.
  slab(api, [1.55, 2.45, 0.12], [-3.15, 1.24, -19.84], pbr({ map: tiled(textures.wood(), 1, 2), color: 0x41554a, roughness: 0.55 }));
  const officeDoor = slab(api, [1.25, 2.15, 0.06], [-3.15, 1.16, -19.77], pbr({ color: 0x33443b, roughness: 0.55 }));
  interactive(api, officeDoor, "station_stationmaster", "Inspect the stationmaster's office door");
  sphere(api, 0.045, [-2.68, 1.1, -19.72], pbr({ color: 0xc4a05c, metalness: 0.85, roughness: 0.25 }));
  signPlane(api, signTexture({ title: "STATION MASTER", sub: "SURAJPUR HALT", lines: ["NO ADMITTANCE"], accent: "#b39c6c" }), [1.3, 0.55], [-3.15, 2.75, -19.85], [0, 0, 0]);
  if (wrong) {
    const tapeMat = pbr({ color: 0xe4cf3c, roughness: 0.7, emissive: 0x5a4b08, emissiveIntensity: 0.4 });
    for (let i = 0; i < 3; i += 1) {
      const tape = slab(api, [1.6, 0.1, 0.02], [-3.15, 1.0 + i * 0.42, -19.7], tapeMat, { rotation: [0, 0, i % 2 ? 0.34 : -0.28] });
      tape.castShadow = false;
    }
    interactive(api, slab(api, [1.3, 0.75, 0.04], [-3.15, 1.25, -19.68], pbr({ color: 0x151b1a, opacity: 0.25 })), "wrong_police_tape", "Read the fresh police seal");
  }
}

function footbridge(api: ExpansionApi) {
  const steel = pbr({ map: tiled(textures.rust(), 3, 1), metalness: 0.65, roughness: 0.5 });
  slab(api, [14.8, 0.16, 2.2], [-3.1, 4.35, -11.5], steel);
  for (let x = -10.2; x <= 4.1; x += 0.8) {
    slab(api, [0.045, 1.05, 0.045], [x, 4.95, -12.55], steel);
    slab(api, [0.045, 1.05, 0.045], [x, 4.95, -10.45], steel);
  }
  slab(api, [14.8, 0.07, 0.07], [-3.1, 5.46, -12.55], steel);
  slab(api, [14.8, 0.07, 0.07], [-3.1, 5.46, -10.45], steel);
  // Support columns and bracing.
  [-9.5, -5.8, -1.6, 3.4].forEach((x) => {
    slab(api, [0.22, 4.2, 0.22], [x, 2.1, -11.5], steel);
    slab(api, [0.9, 0.1, 0.1], [x, 2.4, -11.5], steel, { rotation: [0, 0, 0.5] });
  });
  // Stairs down to the platform, chained off.
  const steps = 13;
  for (let i = 0; i < steps; i += 1) {
    slab(api, [1.35, 0.15, 0.42], [-2.25, 4.22 - i * 0.3, -8.25 + i * 0.42], steel);
  }
  slab(api, [1.35, 0.08, 0.08], [-2.25, 1.05, -2.85], pbr({ color: 0x8d7c4b, roughness: 0.6 }));
  signPlane(api, signTexture({ title: "FOOTBRIDGE", sub: "UNSAFE", lines: ["NO ENTRY", "STAFF ONLY"], accent: "#8f3328", wear: true }), [1.5, 0.7], [-2.25, 0.6, -2.75], [0, 0, 0]);
  addCollider(api, -2.95, -1.55, -8.4, -2.55);
}

function ticketHall(api: ExpansionApi) {
  const past = api.era === "past";
  const wrong = api.era === "wrong";
  const hallX = -7.08;
  const wallMat = pbr({ map: tiled(textures.plaster("#7e877a"), 2, 1.5), roughness: 0.93 });
  plane(api, [4.45, 11.5], [hallX, 0.012, 3.4], [-Math.PI / 2, 0, 0], pbr({ map: tiled(textures.tiles("#7f8c7b", "#50594e"), 5, 12), roughness: 0.5, metalness: 0.05 }));
  plane(api, [4.45, 11.5], [hallX, 3.55, 3.4], [Math.PI / 2, 0, 0], pbr({ map: tiled(textures.plaster("#6f7769"), 2, 5), roughness: 0.95 }));
  slab(api, [0.18, 3.7, 6.8], [-9.32, 1.85, 1.0], wallMat);
  slab(api, [0.18, 3.7, 1.8], [-9.32, 1.85, 8.3], wallMat);
  slab(api, [4.45, 3.7, 0.18], [hallX, 1.85, -2.38], wallMat);
  slab(api, [4.45, 3.7, 0.18], [hallX, 1.85, 9.18], wallMat);
  slab(api, [0.18, 3.7, 0.9], [-4.84, 1.85, 9.6], wallMat);
  addCollider(api, -9.45, -9.2, -2.5, 4.4);
  addCollider(api, -9.45, -9.2, 7.4, 9.3);
  addCollider(api, -9.4, -4.85, -2.5, -2.2);
  addCollider(api, -9.4, -4.85, 9.1, 9.3);
  addCollider(api, -4.95, -4.7, 9.15, 10.1);

  // Counter and ticket window.
  slab(api, [2.75, 0.98, 0.9], [-7.2, 0.49, -1.83], pbr({ map: tiled(textures.wood(), 1.5, 1), color: 0x5c4a36, roughness: 0.6 }));
  slab(api, [2.95, 0.08, 1.05], [-7.2, 1.0, -1.8], pbr({ map: tiled(textures.tiles("#8b9384", "#5d635a"), 3, 1), roughness: 0.35 }));
  addCollider(api, -8.6, -5.8, -2.3, -1.3);
  const brass = pbr({ color: 0xa98a4f, metalness: 0.78, roughness: 0.3 });
  for (let i = 0; i < 7; i += 1) cylinder(api, 0.012, 0.012, 0.95, [-8.4 + i * 0.4, 1.63, -1.85], brass);
  slab(api, [2.6, 0.05, 0.05], [-7.2, 2.12, -1.85], brass);
  slab(api, [2.6, 0.05, 0.05], [-7.2, 1.12, -1.85], brass);
  interactive(api, slab(api, [2.4, 0.05, 0.55], [-7.2, 1.05, -1.8], pbr({ color: 0xc4bca4, roughness: 0.8 })), "station_counter", "Lean at the ticket counter");
  cylinder(api, 0.06, 0.07, 0.08, [-6.35, 1.1, -1.6], brass);
  signPlane(api, signTexture({ title: "TICKETS / ENQUIRY", sub: "NORTHERN RAILWAY", lines: ["RETURN TICKETS: REGRETTABLY", "ONE WAY: ADVISED"], accent: "#b8a06b", wear: true }), [2.3, 0.8], [-7.2, 2.65, -2.26], [0, 0, 0], { emissiveIntensity: 0.13 });

  // Booth behind the counter with pigeonholes.
  slab(api, [0.7, 1.0, 3.0], [-8.75, 0.5, -0.9], pbr({ map: tiled(textures.wood(), 1, 2), color: 0x5f503c, roughness: 0.65 }));
  for (let row = 0; row < 5; row += 1) for (let col = 0; col < 4; col += 1) {
    slab(api, [0.06, 0.2, 0.2], [-8.86, 1.35 + row * 0.24, -1.9 + col * 0.24], pbr({ color: 0x3e3427, roughness: 0.85 }));
  }

  // Benches, timetable, noticeboard and lost property.
  bench(api, -5.65, 1.6, -Math.PI / 2, "station_hall_bench");
  bench(api, -5.65, 5.9, -Math.PI / 2, "station_hall_bench");
  signPlane(api, signTexture({ title: "DEPARTURES", sub: "14 NOVEMBER 1998", lines: ["23:21 LOCAL 604  ..  ON TIME", "23:58 MAIL EXPRESS ..  ??????", "00:24 GOODS 19  ..  DOES NOT STOP", "00:13 -- NO SERVICE --"], accent: "#b6a06c", wear: true }), [2.35, 1.3], [-7.15, 2.05, 9.05], [0, Math.PI, 0], { interactiveId: "station_timetable", label: "Read the departure board", emissiveIntensity: 0.14 });
  signPlane(api, signTexture({ title: "WAITING ROOM", sub: "LADIES / FAMILIES", lines: ["PLEASE DO NOT SLEEP", "BEYOND YOUR STOP"], accent: "#a89566", wear: true }), [1.6, 0.75], [-9.22, 2.75, 3.0], [0, Math.PI / 2, 0]);
  imagePlane(api, "images/family-photo.jpg", [0.9, 0.6], [-9.2, 1.95, 5.6], [0, Math.PI / 2, 0], { id: "station_family_photo", label: "The stationmaster's family photograph", frameColor: 0x3b2b1d });
  const shelf = slab(api, [0.7, 1.9, 0.16], [-9.0, 0.95, 8.35], pbr({ color: 0x4b4032, roughness: 0.8 }));
  for (let i = 0; i < 3; i += 1) slab(api, [0.6, 0.04, 0.28], [-9.0, 0.5 + i * 0.55, 8.25], pbr({ color: 0x5e5140, roughness: 0.8 }));
  slab(api, [0.5, 0.28, 0.3], [-9.0, 0.68, 8.3], pbr({ color: 0x52392a, roughness: 0.85 }));
  interactive(api, shelf, "station_lost", "Search the lost property shelf");

  // Ceiling fans.
  [1.1, 6.2].forEach((z, index) => {
    const fan = new THREE.Group();
    fan.position.set(hallX, 3.42, z);
    api.scene.add(fan);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.12, 10), pbr({ color: 0x7f7054, metalness: 0.5, roughness: 0.5 }));
    fan.add(hub);
    const blades = new THREE.Group();
    fan.add(blades);
    for (let i = 0; i < 3; i += 1) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.02, 0.18), pbr({ color: 0x4b3c2c, roughness: 0.75 }));
      blade.position.x = 0.5;
      const arm = new THREE.Group();
      arm.rotation.y = (i / 3) * Math.PI * 2;
      arm.add(blade);
      blades.add(arm);
    }
    api.animated.push((time) => {
      blades.rotation.y = time * (0.8 + index * 0.25);
    });
    cylinder(api, 0.018, 0.018, 0.24, [hallX, 3.5, z], pbr({ color: 0x2b2a24 }));
  });

  lamp(api, [-7.2, 3.05, 2.4], past ? WARM : eraColor(api, COOL, 0xb7e0d6), past ? 3.4 : wrong ? 1.7 : 1.3, 8, { flicker: wrong ? 0.85 : past ? 0.05 : 0.25, seed: 4, glowSize: 1.2 });
  lamp(api, [-7.2, 3.0, 6.8], past ? WARM : COOL, past ? 2.6 : 0.9, 7, { flicker: past ? 0.04 : 0.3, seed: 7, glowSize: 1.0 });
  clockFace(api, [-8.2, 2.55, -2.27], wrong);
  puddle(api, [-8.8, 0.02, 6.6], [0.9, 0.5]);
  // Newspapers and litter.
  for (let i = 0; i < 5; i += 1) {
    const paper = plane(api, [0.32, 0.22], [-8.0 + Math.random() * 2.3, 0.016, 0.4 + Math.random() * 7], [-Math.PI / 2, 0, Math.random() * 3], pbr({ color: 0xb8b09a, roughness: 0.95 }));
    paper.rotation.z = Math.random() * 2;
  }
  signPlane(api, signTexture({ title: "TICKET HALL", sub: "PLEASE MIND YOUR BELONGINGS", lines: ["ESPECIALLY THE ONES", "YOU HAVE NOT LOST YET"], accent: "#b39d69", wear: true }), [1.7, 0.8], [-4.89, 2.9, 3.0], [0, -Math.PI / 2, 0]);
  if (wrong) {
    for (let i = 0; i < 2; i += 1) slab(api, [1.1, 0.09, 0.02], [-8.6, 1.4 + i * 0.45, 7.3], pbr({ color: 0xdfcd44, emissive: 0x514708, roughness: 0.8 }), { rotation: [0, 0, i ? 0.4 : -0.4] });
  }
}

function clockFace(api: ExpansionApi, position: [number, number, number], wrong: boolean) {
  const group = new THREE.Group();
  group.position.set(position[0], position[1], position[2]);
  api.scene.add(group);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.72, 0.1), pbr({ color: 0x3b2e22, roughness: 0.55 }));
  group.add(body);
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.27, 22), pbr({ color: 0xd2c6a7, emissive: 0x3d3728, emissiveIntensity: 0.25, roughness: 0.5 }));
  face.position.z = 0.06;
  group.add(face);
  const hour = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.17, 0.01), pbr({ color: 0x1c1812 }));
  hour.position.set(0.06, 0.06, 0.08);
  hour.rotation.z = wrong ? -0.8 : -1.5;
  group.add(hour);
  const minute = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.23, 0.01), pbr({ color: 0x1c1812 }));
  minute.position.set(-0.04, 0.1, 0.085);
  minute.rotation.z = wrong ? 0.1 : 0.6;
  group.add(minute);
  api.animated.push((time) => {
    minute.rotation.z = (wrong ? 0.1 : 0.6) + Math.sin(time * 0.16) * 0.03;
  });
}

function recordsOffice(api: ExpansionApi) {
  const past = api.era === "past";
  const wrong = api.era === "wrong";
  const floorMat = pbr({ map: tiled(textures.wood(), 2, 4), color: 0x8a7756, roughness: 0.7 });
  plane(api, [2.0, 5.0], [-16.4, 0.018, 0.5], [-Math.PI / 2, 0, 0], floorMat);
  plane(api, [2.0, 5.0], [-16.4, 3.2, 0.5], [Math.PI / 2, 0, 0], pbr({ map: tiled(textures.plaster("#8f8873"), 1, 2), roughness: 0.9 }));
  const wallMat = pbr({ map: tiled(textures.plaster("#918a74"), 2, 1.2), roughness: 0.9 });
  slab(api, [0.16, 3.2, 5.1], [-17.35, 1.6, 0.5], wallMat);
  slab(api, [2.0, 3.2, 0.16], [-16.4, 1.6, -2.02], wallMat);
  slab(api, [2.0, 3.2, 0.16], [-16.4, 1.6, 3.02], wallMat);
  slab(api, [0.16, 3.2, 2.0], [-15.4, 1.6, -1.0], wallMat);
  slab(api, [0.16, 3.2, 0.6], [-15.4, 1.6, 2.7], wallMat);
  addCollider(api, -17.45, -17.25, -2.1, 3.1);
  addCollider(api, -17.4, -15.4, -2.12, -1.92);
  addCollider(api, -17.4, -15.4, 2.92, 3.12);
  addCollider(api, -15.5, -15.3, -2.1, 0);
  addCollider(api, -15.5, -15.3, 2.3, 3.1);

  // Faded shop board, above the doorway.
  signPlane(api, signTexture({ title: " DISTRICT RECORDS ", sub: "DEEDS / MAPS / DENIALS", lines: ["ENTER", "THE STATION NEVER EXISTED"], accent: "#b6a272", wear: true }), [2.8, 0.85], [-15.31, 3.35, 0.5], [0, Math.PI / 2, 0], { emissiveIntensity: past ? 0.3 : 0.16 });
  // Door frame and glass.
  slab(api, [0.08, 2.5, 0.08], [-15.38, 1.25, -0.05], pbr({ color: 0x3b3024, roughness: 0.5 }));
  slab(api, [0.08, 2.5, 0.08], [-15.38, 1.25, 2.45], pbr({ color: 0x3b3024, roughness: 0.5 }));
  slab(api, [0.08, 0.1, 2.55], [-15.38, 2.48, 1.2], pbr({ color: 0x3b3024, roughness: 0.5 }));
  const glass = plane(api, [2.2, 2.4], [-15.36, 1.25, 1.2], [0, Math.PI / 2, 0], pbr({ color: 0x9eb5ab, metalness: 0.4, roughness: 0.08, opacity: 0.1 }));
  glass.name = "records-glass";

  // Shelves of files, ledgers and rolled maps.
  for (let i = 0; i < 3; i += 1) {
    slab(api, [0.55, 0.05, 4.2], [-17.0, 0.55 + i * 0.72, 0.5], pbr({ color: 0x4a3b2a, roughness: 0.7 }));
    for (let j = 0; j < 16; j += 1) {
      const file = slab(api, [0.32, 0.42 + (j % 3) * 0.05, 0.18], [-17.03, 0.79 + i * 0.72, -1.5 + j * 0.26], pbr({ color: [0x9d7c4a, 0x7c6c4d, 0x9a8a62, 0x5d5c46][j % 4], roughness: 0.92 }));
      file.rotation.z = (j % 5) * 0.02;
    }
  }
  slab(api, [1.7, 0.08, 1.1], [-16.2, 1.0, 0.7], pbr({ map: tiled(textures.wood(), 1, 1), color: 0x7d6347, roughness: 0.55 }));
  slab(api, [1.7, 0.92, 0.1], [-16.2, 0.52, 1.22], pbr({ color: 0x6d553c, roughness: 0.65 }));
  addCollider(api, -17.1, -15.35, 0.1, 1.3);
  imagePlane(api, "images/souvenir-map.jpg", [0.8, 0.55], [-16.2, 1.08, 0.65], [-Math.PI / 2, 0, 0.18], { id: "records_map", label: "Read the souvenir map" });
  interactive(api, slab(api, [0.3, 0.1, 0.3], [-15.8, 1.08, 1.15], pbr({ color: 0x2f2b24, metalness: 0.4, roughness: 0.4 })), "records_stamp", "Examine the official rubber stamp");
  // Clerk, very cheerful, entirely unhelpful.
  const shirt = pbr({ color: 0xbab6a2, roughness: 0.9 });
  const clerkBody = cylinder(api, 0.2, 0.26, 0.72, [-16.5, 1.4, 2.0], shirt, undefined, 10);
  const clerkHead = sphere(api, 0.17, [-16.5, 1.92, 2.0], pbr({ color: 0x8b644f, roughness: 0.7 }));
  clerkHead.scale.set(1, 1.12, 1);
  sphere(api, 0.025, [-16.57, 1.96, 2.14], pbr({ color: 0x1c1a16 }));
  sphere(api, 0.025, [-16.43, 1.96, 2.14], pbr({ color: 0x1c1a16 }));
  slab(api, [0.15, 0.025, 0.03], [-16.5, 1.86, 2.15], pbr({ color: 0x36302a }));
  const arm = slab(api, [0.09, 0.5, 0.14], [-16.25, 1.45, 2.0], shirt, { rotation: [0, 0, 0.2] });
  interactive(api, clerkBody, "records_clerk", "Ask the records clerk");
  arm.name = "clerk-arm";
  interactive(api, clerkHead, "records_clerk", "Ask the records clerk");
  lamp(api, [-16.35, 2.75, 0.4], past ? WARM : 0xe6f0df, past ? 2.0 : wrong ? 1.1 : 1.5, 5, { flicker: wrong ? 0.9 : 0.12, seed: 13, glowSize: 0.8 });
  const ceilingFan = new THREE.Group();
  ceilingFan.position.set(-16.4, 3.1, 0.5);
  api.scene.add(ceilingFan);
  const fanBlades = new THREE.Group();
  ceilingFan.add(fanBlades);
  for (let i = 0; i < 3; i += 1) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.02, 0.14), pbr({ color: 0x4a3a2a, roughness: 0.8 }));
    blade.position.x = 0.34;
    const armGroup = new THREE.Group();
    armGroup.rotation.y = (i / 3) * Math.PI * 2;
    armGroup.add(blade);
    fanBlades.add(armGroup);
  }
  api.animated.push((time) => {
    fanBlades.rotation.y = time * 1.5;
  });
  if (wrong) {
    slab(api, [0.09, 2.2, 0.02], [-15.3, 1.2, -0.2], pbr({ color: 0xe0cd44, emissive: 0x4d4308, roughness: 0.8 }), { rotation: [0, 0, 0.2] });
    slab(api, [0.09, 2.2, 0.02], [-15.3, 1.2, 0.1], pbr({ color: 0xe0cd44, emissive: 0x4d4308, roughness: 0.8 }), { rotation: [0, 0, -0.16] });
  }
}

function shopFront(
  api: ExpansionApi,
  opts: { z: number; width: number; title: string; sub: string; closed: boolean; warm: boolean; id: string; label: string },
) {
   const brickMat = pbr({ map: tiled(textures.brick("#665445"), 1.4, 2), roughness: 0.95, bumpMap: textures.brick("#665445"), bumpScale: 0.03 });
  slab(api, [0.3, 1.1, opts.width], [-15.35, 0.55, opts.z], brickMat);
  slab(api, [0.3, 0.5, opts.width], [-15.35, 3.55, opts.z], brickMat);
  const shutterMat = pbr({ map: tiled(textures.rust(), 2, 2), metalness: 0.55, roughness: 0.55 });
  if (opts.closed) {
    const shutter = slab(api, [0.12, 2.5, opts.width - 0.3], [-15.3, 1.85, opts.z], shutterMat);
    for (let i = 0; i < 12; i += 1) slab(api, [0.04, 0.035, opts.width - 0.35], [-15.22, 0.72 + i * 0.2, opts.z], pbr({ color: 0x404641, metalness: 0.55, roughness: 0.5 }));
    interactive(api, shutter, opts.id, opts.label);
    cylinder(api, 0.06, 0.06, 0.05, [-15.2, 1.0, opts.z - 0.9], pbr({ color: 0x8f8757, metalness: 0.7, roughness: 0.4 }), [Math.PI / 2, 0, 0]);
  } else {
    slab(api, [0.22, 0.55, opts.width - 0.4], [-15.32, 3.0, opts.z], shutterMat);
    signPlane(api, signTexture({ title: "GENERAL STORE", sub: "ALL THINGS / MOST THINGS", lines: ["UDHAR LEDGER AVAILABLE"], accent: "#b7a168", wear: true }), [opts.width - 0.5, 0.8], [-15.28, 2.5, opts.z], [0, Math.PI / 2, 0], { emissiveIntensity: 0.14 });
    slab(api, [0.3, 0.8, opts.width - 0.6], [-15.3, 0.4, opts.z], pbr({ map: tiled(textures.wood(), 1, 1), color: 0x5c4733, roughness: 0.7 }));
    interactive(api, slab(api, [0.25, 1.4, opts.width - 0.7], [-15.28, 1.3, opts.z], pbr({ color: 0x1b2422, emissive: opts.warm ? 0x57340e : 0x0c1614, emissiveIntensity: 0.4, roughness: 0.6 })), opts.id, opts.label);
    for (let i = 0; i < 4; i += 1) {
      const sack = sphere(api, 0.22, [-15.0, 0.32, opts.z - 1.3 + i * 0.28], pbr({ color: 0x8e7d5c, roughness: 0.95 }));
      sack.scale.set(1, 1.1, 0.8);
    }
  }
  signPlane(api, signTexture({ title: opts.title, sub: opts.sub, lines: [], accent: "#b69f6b", wear: true }), [opts.width - 0.4, 0.65], [-15.12, 3.5, opts.z], [0, Math.PI / 2, 0], { emissiveIntensity: 0.2 });
}

function townStreet(api: ExpansionApi) {
  const past = api.era === "past";
  const wrong = api.era === "wrong";
  // Ground, road, footpaths.
  plane(api, [7.2, 28], [-13.0, 0.01, 0], [-Math.PI / 2, 0, 0], pbr({ map: tiled(textures.asphalt(), 4, 16), roughness: 0.85 }));
  plane(api, [1.3, 28], [-9.95, 0.03, 0], [-Math.PI / 2, 0, 0], pbr({ map: tiled(textures.concrete("#6d746c"), 2, 18), roughness: 0.9 }));
  plane(api, [1.4, 28], [-15.8, 0.03, 0], [-Math.PI / 2, 0, 0], pbr({ map: tiled(textures.concrete("#6d746c"), 2, 18), roughness: 0.9 }));
  slab(api, [0.16, 0.13, 28], [-15.1, 0.06, 0], pbr({ color: 0x8c887a, roughness: 0.9 }));
  slab(api, [0.16, 0.13, 28], [-10.6, 0.06, 0], pbr({ color: 0x8c887a, roughness: 0.9 }));

  // West-side building mass split around the records office.
  const brickMat = pbr({ map: tiled(textures.brick("#645243"), 3, 4), roughness: 0.94, bumpMap: textures.brick("#645243"), bumpScale: 0.03 });
  slab(api, [2.0, 6.2, 12.2], [-16.4, 3.1, -8.0], brickMat);
  slab(api, [2.0, 6.2, 11.1], [-16.4, 3.1, 8.5], brickMat);
  addCollider(api, -17.45, -15.35, -14.1, -1.95);
  addCollider(api, -17.45, -15.35, 3.05, 14.1);
  for (let z = -13; z <= 13; z += 2.6) slab(api, [0.08, 1.1, 0.9], [-15.33, 4.4, z], pbr({ color: 0x1c2321, metalness: 0.3, roughness: 0.4 }));
  signPlane(api, signTexture({ title: "SURAJPUR BAZAAR", sub: "EST. 1954 / NOT ON THE MAP", lines: ["CLOCKS REPAIRED", "PAST PARTICIPLES PURCHASED"], accent: "#b09a66", wear: true }), [3.2, 0.8], [-15.3, 5.2, -1.9], [0, Math.PI / 2, 0]);
  shopFront(api, { z: -11.0, width: 4.0, title: "MISHRA GENERAL", sub: "PROVISIONS / KEROSENE", closed: !past, warm: past, id: "general_store", label: "Inspect the general store" });
  shopFront(api, { z: -5.0, width: 4.0, title: "IDEAL PHOTO STUDIO", sub: "WEDDINGS / FUNERALS / BOTH", closed: !past, warm: past, id: "photo_shop", label: "Look into the photo studio" });
  imagePlane(api, "images/platform-photo.jpg", [1.1, 0.75], [-15.18, 1.75, -5.4], [0, Math.PI / 2, 0], { frameColor: 0x342619 });
  imagePlane(api, "images/family-photo.jpg", [0.8, 0.55], [-15.18, 1.6, -4.2], [0, Math.PI / 2, 0], { frameColor: 0x342619 });
  recordsOffice(api);
  shopFront(api, { z: 7.0, width: 5.0, title: "IDEAL TAILORS", sub: "ALTERATIONS WHILE YOU WAIT", closed: !past, warm: past, id: "tailor_shop", label: "Inspect the tailor's shop" });
  // Graffiti wall between the shops and the gate.
  plane(api, [3.8, 2.1], [-15.29, 1.75, 11.4], [0, Math.PI / 2, 0], pbr({ map: tiled(textures.concrete("#5d625a"), 2, 1), roughness: 0.92 }));
  const graffiti = wrong ? "THE HOUR HAS BLOCKED YOUR NUMBER" : past ? "MIND THE GAP. MIND YOUR BUSINESS." : "THE HOUR IS LATE";
  signPlane(api, graffitiTexture(graffiti, past ? "#d9c48b" : "#b9b3a4"), [3.5, 1.3], [-15.22, 1.82, 11.4], [0, Math.PI / 2, 0], { interactiveId: "station_graffiti", label: "Read the graffiti", emissiveIntensity: 0.06 });
  signPlane(api, noticePoster({ title: "MISSING", body: ["RAJIV MALHOTRA", "IF SEEN, DO NOT", "MENTION THE CLOCK"], accent: "#8a3327", seal: true }), [0.62, 0.9], [-15.26, 1.8, 3.6], [0, Math.PI / 2, 0]);
  // Boundary walls / gates closing the street.
  const endMat = pbr({ map: tiled(textures.brick("#5d5347"), 4, 2), roughness: 0.95 });
  slab(api, [7.2, 3.4, 0.3], [-13.0, 1.7, -14.0], endMat);
  slab(api, [7.2, 3.4, 0.3], [-13.0, 1.7, 14.0], endMat);
  addCollider(api, -16.6, -9.4, -14.2, -13.8);
  addCollider(api, -16.6, -9.4, 13.8, 14.2);
  signPlane(api, signTexture({ title: "SURAJPUR BAZAAR", sub: "POP. 1,313 / OR 1,314", lines: ["THANK YOU FOR NOT ASKING"], accent: "#b29b68", wear: true }), [2.8, 0.9], [-13.0, 2.4, 13.83], [0, Math.PI, 0]);
  glow(api, [-13.0, 2.4, 11.5], 0xe6b267, 1.8, 0.4);
  // East boundary wall outside the ticket hall.
  slab(api, [0.3, 2.4, 11.5], [-9.4, 1.2, -8.3], pbr({ map: tiled(textures.brick("#665748"), 3, 2), roughness: 0.95 }));
  slab(api, [0.3, 2.4, 4.7], [-9.4, 1.2, 11.6], pbr({ map: tiled(textures.brick("#665748"), 2, 2), roughness: 0.95 }));
  addCollider(api, -9.55, -9.25, -14.05, -2.55);
  addCollider(api, -9.55, -9.25, 9.25, 13.95);
  imagePlane(api, "images/rajiv-portrait.jpg", [0.7, 0.92], [-9.24, 1.6, 12.3], [0, Math.PI / 2, 0], { frameColor: 0x3a2a1c });

  // Chai stall, still inexplicably hot.
  slab(api, [1.7, 0.92, 1.0], [-10.5, 0.46, 9.7], pbr({ map: tiled(textures.wood(), 1.4, 1), color: 0x72563a, roughness: 0.72 }));
  slab(api, [1.9, 0.08, 1.15], [-10.5, 0.96, 9.7], pbr({ color: 0x8a7c60, roughness: 0.6 }));
  slab(api, [2.2, 0.06, 2.1], [-10.5, 2.55, 9.7], clothMatSafe());
  [-11.5, -9.5].forEach((_z, index) => {
    cylinder(api, 0.035, 0.035, 2.5, [-11.3, 1.25, 8.7 + index * 2.0], pbr({ color: 0x8a6f45, roughness: 0.8 }));
    cylinder(api, 0.035, 0.035, 2.5, [-9.7, 1.25, 8.7 + index * 2.0], pbr({ color: 0x8a6f45, roughness: 0.8 }));
  });
  const kettle = new THREE.Group();
  kettle.position.set(-10.8, 1.02, 9.45);
  api.scene.add(kettle);
  const kettleBody = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.3, 12), pbr({ color: 0xa1a89d, metalness: 0.75, roughness: 0.3 }));
  kettleBody.position.y = 0.15;
  kettle.add(kettleBody);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.25, 8), pbr({ color: 0x9ca79e, metalness: 0.75, roughness: 0.3 }));
  spout.position.set(0.2, 0.22, 0);
  spout.rotation.z = -0.9;
  kettle.add(spout);
  steamField(api, [-10.8, 1.3, 9.45], 22, 0xdfe6da, 0.2);
  [-10.25, -10.0, -10.7, -10.95].forEach((x, i) => {
    cylinder(api, 0.06, 0.045, 0.1, [x, 1.01, 9.5 + (i % 2) * 0.24], pbr({ color: 0xcfc5aa, roughness: 0.35 }));
    if (i === 0) {
      const cup = cylinder(api, 0.055, 0.042, 0.1, [x, 1.02, 9.5], pbr({ color: 0xc7b28b, roughness: 0.4 }));
      interactive(api, cup, "station_chai_cup", "Inspect the chai cup");
    }
  });
  cylinder(api, 0.18, 0.18, 0.18, [-10.0, 0.4, 10.4], pbr({ color: 0x3a3d38, metalness: 0.5, roughness: 0.5 }));
  glow(api, [-10.0, 0.5, 10.4], 0xc84a24, 0.5, 0.28);
  signPlane(api, signTexture({ title: "RAMESH CHAI", sub: "HOT TEA / COLD TRUTH", lines: ["TODAY: YES", "TOMORROW: ALSO YES"], accent: "#d3ac6c", wear: true }), [1.9, 0.7], [-10.5, 2.2, 8.65], [0, 0, 0], { interactiveId: "station_chai", label: "Order a tea you may regret", emissiveIntensity: 0.24 });
  bench(api, -10.9, 11.9, 0, "station_chai_bench");
  lamp(api, [-10.2, 2.35, 9.6], past ? 0xffc27b : 0xffca84, past ? 2.4 : 2.0, 5, { flicker: wrong ? 0.7 : 0.08, seed: 22, glowSize: 0.9 });
  addCollider(api, -11.5, -9.5, 8.5, 10.9);

  // Auto-rickshaw.
  const auto = new THREE.Group();
  auto.position.set(-13.1, 0, 3.7);
  auto.rotation.y = 0.25;
  api.scene.add(auto);
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.55, 2.15), pbr({ color: 0x2e6b4f, roughness: 0.55 }));
  body.position.y = 0.55;
  auto.add(body);
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.75, 1.5), pbr({ color: 0x1d2422, roughness: 0.8 }));
  canopy.position.set(0, 1.2, -0.15);
  auto.add(canopy);
  const autoRoof = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 1.75), pbr({ color: 0xd3b23f, roughness: 0.6 }));
  autoRoof.position.set(0, 1.6, -0.1);
  auto.add(autoRoof);
  const wheelMat = pbr({ color: 0x161716, roughness: 0.85 });
  [[-0.72, 1.25], [0.72, 1.25], [0, -0.75]].forEach(([x, z]) => {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.14, 16), wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.29, z);
    auto.add(wheel);
  });
  const headlight = new THREE.Mesh(new THREE.CircleGeometry(0.11, 12), new THREE.MeshBasicMaterial({ color: 0xffe0a0 }));
  headlight.position.set(0, 0.7, 1.08);
  auto.add(headlight);
  glow(api, [-13.0, 0.72, 4.85], 0xffd18a, 0.7, 0.3);
  interactive(api, body, "street_auto", "Inspect the parked auto-rickshaw");
  addCollider(api, -14.0, -12.2, 2.4, 5.0);

  // Bicycle and the stray dog.
  const bikeWheel = pbr({ color: 0x20231f, roughness: 0.75 });
  const bike = new THREE.Group();
  bike.position.set(-15.0, 0, -8.4);
  bike.rotation.y = 0.1;
  api.scene.add(bike);
  [-0.55, 0.55].forEach((z) => {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.025, 6, 20), bikeWheel);
    rim.rotation.y = Math.PI / 2;
    rim.position.set(0, 0.36, z);
    bike.add(rim);
  });
  const frame = pbr({ color: 0x493d2c, metalness: 0.6, roughness: 0.4 });
  cylinder(api, 0.02, 0.02, 1.1, [-15.0, 0.52, -8.4], frame, [Math.PI / 2, 0, 0], 6);
  slab(api, [0.04, 0.44, 0.04], [-15.0, 0.54, -8.4], frame, { rotation: [0.3, 0, 0] });
  slab(api, [0.45, 0.03, 0.05], [-15.0, 0.92, -8.0], frame);
  const dog = new THREE.Group();
  dog.position.set(-11.7, 0, 11.0);
  dog.rotation.y = -0.6;
  api.scene.add(dog);
  const fur = pbr({ color: 0x8a6a45, roughness: 0.95 });
  const dogBody = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.28, 0.72), fur);
  dogBody.position.y = 0.36;
  dog.add(dogBody);
  const dogHead = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.3), fur);
  dogHead.position.set(0, 0.5, 0.44);
  dog.add(dogHead);
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.2), pbr({ color: 0x5b4530, roughness: 0.9 }));
  snout.position.set(0, 0.46, 0.62);
  dog.add(snout);
  [[-0.12, 0.22], [0.12, 0.22], [-0.12, 0.52], [0.12, 0.52]].forEach(([x, z]) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.24, 0.08), fur);
    leg.position.set(x, 0.14, z);
    dog.add(leg);
  });
  const tailGroup = new THREE.Group();
  tailGroup.position.set(0, 0.42, -0.35);
  dog.add(tailGroup);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.36), fur);
  tail.position.z = -0.16;
  tailGroup.add(tail);
  api.animated.push((time) => {
    tailGroup.rotation.y = Math.sin(time * 2.4) * 0.4;
  });
  interactive(api, dogBody, "street_dog", "Greet the station dog");
  addCollider(api, -12.1, -11.3, 10.5, 11.5);

  // Streelights and sagging wires.
  streetLamp(api, -10.15, -9.0, 0, past, wrong);
  streetLamp(api, -15.7, -2.5, 1, past, wrong);
  const wireMat = pbr({ color: 0x171b18, roughness: 0.8 });
  catenary(api, new THREE.Vector3(-10.3, 5.3, -9), new THREE.Vector3(-15.7, 5.1, -2.5), 0.5, wireMat);
  catenary(api, new THREE.Vector3(-10.3, 5.3, 6.3), new THREE.Vector3(-15.7, 5.1, -2.5), 0.7, wireMat);
  catenary(api, new THREE.Vector3(-10.3, 5.3, -9), new THREE.Vector3(-10.3, 5.3, 6.3), 0.4, wireMat);
  if (past) addStringLights(api, new THREE.Vector3(-10.3, 4.4, -13), new THREE.Vector3(-15.6, 4.5, 13), 22);

  // Puddles and reflection.
  puddle(api, [-12.2, 0.045, 5.2], [1.5, 0.75]);
  puddle(api, [-14.6, 0.045, -3.8], [0.9, 0.5]);
  puddle(api, [-11.4, 0.045, 0.8], [1.1, 0.4]);
  glow(api, [-14.6, 0.1, -3.8], 0xc19a64, 1.0, 0.16);

  // Litter.
  for (let i = 0; i < 12; i += 1) {
    const can = cylinder(api, 0.06, 0.06, 0.14, [-15.0 + Math.random() * 4.4, 0.08, -12 + Math.random() * 24], pbr({ color: [0x9da6a0, 0xb1a58a, 0x8f7d5f][i % 3], metalness: 0.5, roughness: 0.5 }), [Math.PI / 2, 0, Math.random() * 2]);
    can.castShadow = false;
  }
  // Sign over the doorway back to the station.
  signPlane(api, signTexture({ title: "SURAJPUR BAZAAR", sub: "A QUIET STREET SINCE 1998", lines: ["NO PHOTOGRAPHS"], accent: "#b19a67", wear: true }), [2.0, 0.7], [-9.26, 3.25, 5.9], [0, Math.PI / 2, 0], { emissiveIntensity: 0.12 });

  // Weather.
  if (!past) rainField(api, { minX: -17, maxX: -9.5, minZ: -14, maxZ: 14, top: 9 }, 750, 0xb2cdc6, 0.2, 11);
  // A faint train silhouette crossing the moon, far above the town.
  plane(api, [9, 5], [-18.5, 8.5, -13.9], [0, 0, 0], pbr({ map: nightSky(), emissive: 0x3b5852, emissiveMap: nightSky(), emissiveIntensity: 0.42, roughness: 0.5 }));
  const shadowGroup = new THREE.Group();
  shadowGroup.position.set(-13, 8.4, -13.6);
  api.scene.add(shadowGroup);
  const carriageMat = pbr({ color: 0x070c0b, roughness: 0.9, opacity: 0.6 });
  for (let i = 0; i < 3; i += 1) {
    const carriage = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.3, 0.1), carriageMat);
    carriage.position.x = i * 1.9;
    shadowGroup.add(carriage);
  }
  api.animated.push((time) => {
    shadowGroup.position.x = -16 + ((time * 0.35) % 8);
    if (Math.random() > 0.996) {
      carriageMat.opacity = 0.15;
    } else if (carriageMat.opacity < 0.6) {
      carriageMat.opacity = Math.min(0.6, carriageMat.opacity + 0.02);
    }
  });
}

function clothMatSafe() {
  return pbr({ map: tiled(textures.cloth("#54513f"), 2, 2), roughness: 0.95, side: THREE.DoubleSide });
}

function streetLamp(api: ExpansionApi, x: number, z: number, seed: number, past: boolean, wrong: boolean) {
  const pole = pbr({ color: 0x2a3330, metalness: 0.55, roughness: 0.42 });
  cylinder(api, 0.07, 0.1, 4.7, [x, 2.35, z], pole);
  slab(api, [0.75, 0.06, 0.06], [x + (x < -13 ? 0.36 : -0.36), 4.6, z], pole);
  const headX = x + (x < -13 ? 0.7 : -0.7);
  slab(api, [0.42, 0.12, 0.28], [headX, 4.55, z], pbr({ color: 0x272e2a, metalness: 0.5, roughness: 0.45 }));
  const color = past ? 0xffc47c : SODIUM;
  const light = lamp(api, [headX, 4.38, z], color, past ? 3.4 : wrong ? 1.8 : 2.6, 13, { flicker: wrong ? 0.9 : past ? 0.03 : 0.4, seed, glowSize: 1.5 });
  light.position.y = 4.38;
  glow(api, [headX, 3.1, z], color, 2.2, 0.09);
  addCollider(api, x - 0.18, x + 0.18, z - 0.18, z + 0.18);
}

export function expandStation(api: ExpansionApi) {
  platformDetails(api);
  clockTower(api);
  footbridge(api);
  ticketHall(api);
  townStreet(api);
  // Hanging cable trays and pipework along the hall exterior.
  const pipeMat = pbr({ map: tiled(textures.rust(), 3, 1), metalness: 0.6, roughness: 0.55 });
  [-13, -8, -3, 2, 7, 12].forEach((z) => {
    cylinder(api, 0.07, 0.07, 0.5, [-9.15, 2.9, z], pipeMat, [0, 0, Math.PI / 2]);
  });
  cylinder(api, 0.06, 0.06, 16, [-9.2, 3.15, -1], pipeMat, [Math.PI / 2, 0, 0]);
  glow(api, [-9.15, 0.6, 4.8], 0xe6c38a, 1.4, 0.18);
}
