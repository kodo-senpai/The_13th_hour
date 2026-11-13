import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

// Run after npm run build. Install Playwright locally with npm install --no-save playwright.
const port = 4187;
const baseUrl = `http://127.0.0.1:${port}/?debug=controls`;
const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], { stdio: "pipe" });
let browser;
const errors = [];

const saveFor = (scene) => ({
  scene,
  inventory: ["ticket", "fuse", "brass-key", "maintenance-log"],
  collected: ["ticket", "fuse", "brass-key", "maintenance-log", ...Array.from({ length: 5 }, (_, index) => `recording-${index + 1}`)],
  evidence: ["diary", "maintenance-log", "face", "sealed-room", "register"],
  flags: { fuseInstalled: true, powerOn: true, gateOpen: true, boardSolved: true, bunkerPower: true, commentary: false, photoLooks: 0, registerDecision: "restore" },
  elapsed: 0,
});

async function createPage(scene, options = {}) {
  const context = await browser.newContext({ viewport: { width: 900, height: 600 }, deviceScaleFactor: 1, ...options });
  await context.addInitScript((save) => {
    if (!sessionStorage.getItem("controls-test-seeded")) {
      localStorage.setItem("the-13th-hour-save-v1", JSON.stringify(save));
      sessionStorage.setItem("controls-test-seeded", "true");
    }
  }, saveFor(scene));
  const page = await context.newPage();
  page.setDefaultTimeout(45000);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "CONTINUE FROM AUTOSAVE" }).click();
  await waitScene(page, scene);
  return { page, context };
}

async function waitScene(page, scene) {
  await page.waitForFunction((expected) => {
    const view = document.querySelector(".world-root canvas");
    return view?.dataset.scene === expected && view.dataset.inputActive === "true";
  }, scene);
}

const pose = (page) => page.locator(".world-root canvas").evaluate((canvas) => ({
  x: Number(canvas.dataset.playerX), z: Number(canvas.dataset.playerZ), yaw: Number(canvas.dataset.yaw), pitch: Number(canvas.dataset.pitch),
}));

function axisFor(code, yaw) {
  const forward = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
  const right = { x: Math.cos(yaw), z: -Math.sin(yaw) };
  if (code === "KeyW") return forward;
  if (code === "KeyS") return { x: -forward.x, z: -forward.z };
  if (code === "KeyD") return right;
  return { x: -right.x, z: -right.z };
}

async function waitMovement(page, start, axis, distance = 0.25) {
  await page.waitForFunction(({ start, axis, distance }) => {
    const view = document.querySelector(".world-root canvas");
    if (!view) return false;
    return (Number(view.dataset.playerX) - start.x) * axis.x + (Number(view.dataset.playerZ) - start.z) * axis.z >= distance;
  }, { start, axis, distance });
  const end = await pose(page);
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  assert(dx * axis.x + dz * axis.z >= distance - 0.001, "Character must move in the requested direction");
  assert(Math.abs(dx * axis.z - dz * axis.x) < 0.03, "Movement must follow the camera-relative axis");
}

async function waitFrames(page, count = 3) {
  await page.evaluate((frames) => new Promise((resolve) => {
    let left = frames;
    const tick = () => { if (--left <= 0) resolve(); else requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }), count);
}

async function assertStopped(page) {
  await waitFrames(page, 2);
  const start = await pose(page);
  await waitFrames(page, 4);
  const end = await pose(page);
  assert(Math.hypot(end.x - start.x, end.z - start.z) < 0.001, "Character must stop after release");
}

async function keyboardStep(page, code) {
  const start = await pose(page);
  await page.keyboard.down(code);
  try { await waitMovement(page, start, axisFor(code, start.yaw)); }
  finally { await page.keyboard.up(code); }
  await assertStopped(page);
  console.log(`PASS keyboard ${code}`);
}

async function buttonStep(page, code, releaseOutside = false) {
  const start = await pose(page);
  const control = page.locator(`[data-control="${code}"]`);
  const rect = await control.boundingBox();
  assert(rect, `${code} button must be visible`);
  const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  assert(await page.evaluate(({ x, y, code }) => document.elementFromPoint(x, y)?.closest("[data-control]")?.getAttribute("data-control") === code, { ...center, code }), `${code} must not be covered by another panel`);
  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  try {
    await waitMovement(page, start, axisFor(code, start.yaw));
    assert.equal(await control.getAttribute("aria-pressed"), "true");
    if (releaseOutside) await page.mouse.move(450, 280);
  } finally { await page.mouse.up(); }
  await assertStopped(page);
  assert.equal(await control.getAttribute("aria-pressed"), "false");
  console.log(`PASS on-screen ${code}${releaseOutside ? " (release outside)" : ""}`);
}

async function assertLayout(page) {
  const boxes = {};
  for (const code of ["KeyW", "KeyA", "KeyS", "KeyD"]) boxes[code] = await page.locator(`[data-control="${code}"]`).boundingBox();
  assert(Math.abs(boxes.KeyW.x - boxes.KeyS.x) < 1, "W is directly above S");
  assert(boxes.KeyW.y + boxes.KeyW.height < boxes.KeyS.y, "W has its own top row");
  assert(Math.abs(boxes.KeyA.y - boxes.KeyS.y) < 1 && Math.abs(boxes.KeyS.y - boxes.KeyD.y) < 1, "A, S, D share a row");
  assert(boxes.KeyA.x < boxes.KeyS.x && boxes.KeyS.x < boxes.KeyD.x, "Bottom row is A, S, D");
  console.log("PASS W / A S D layout");
}

async function touchStep(page, code) {
  const session = await page.context().newCDPSession(page);
  const box = await page.locator(`[data-control="${code}"]`).boundingBox();
  const start = await pose(page);
  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 }] });
  try { await waitMovement(page, start, axisFor(code, start.yaw)); }
  finally { await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); }
  await assertStopped(page);
  await session.detach();
  console.log(`PASS touch ${code}`);
}

try {
  for (let i = 0; i < 60; i += 1) {
    try { if ((await fetch(baseUrl)).ok) break; } catch { /* Wait for preview. */ }
    await delay(250);
  }
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--disable-gpu-sandbox"] });
  const { page, context } = await createPage("epilogue-save");
  await page.getByRole("button", { name: /End the story/ }).waitFor({ state: "visible" });
  await assertLayout(page);
  for (const code of ["KeyW", "KeyS", "KeyD", "KeyA"]) await keyboardStep(page, code);
  for (const code of ["KeyW", "KeyS", "KeyD", "KeyA"]) await buttonStep(page, code, code === "KeyA");

  await page.locator('[data-control="KeyW"]').focus();
  const beforeSpace = await pose(page);
  await page.keyboard.down("Space");
  await waitMovement(page, beforeSpace, axisFor("KeyW", beforeSpace.yaw));
  await page.keyboard.up("Space");
  await assertStopped(page);
  await waitScene(page, "epilogue-save");
  console.log("PASS focused movement button works without ending the epilogue");

  // Pausing must discard held input, not replay it on resume.
  await page.keyboard.down("KeyW");
  await waitFrames(page, 2);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.keyboard.up("KeyW");
  await page.locator(".pause-screen").waitFor({ state: "visible" });
  await assertStopped(page);
  await page.getByRole("button", { name: "Return to the platform" }).click();
  await waitScene(page, "epilogue-save");
  await assertStopped(page);
  console.log("PASS pause/resume does not leave movement stuck");

  await page.keyboard.press("KeyI");
  await page.locator(".inventory-modal").waitFor({ state: "visible" });
  await page.keyboard.press("Escape");
  await waitScene(page, "epilogue-save");
  await keyboardStep(page, "KeyW");
  await keyboardStep(page, "KeyS");
  console.log("PASS inventory closes and restores movement");

  // Release on window blur, including a pointer held over a control.
  const w = await page.locator('[data-control="KeyW"]').boundingBox();
  await page.mouse.move(w.x + w.width / 2, w.y + w.height / 2);
  await page.mouse.down();
  await waitFrames(page, 2);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.mouse.up();
  await assertStopped(page);
  console.log("PASS losing focus clears held movement");

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "CONTINUE FROM AUTOSAVE" }).click();
  await waitScene(page, "epilogue-save");
  await page.getByRole("button", { name: /End the story/ }).waitFor({ state: "visible" });
  await keyboardStep(page, "KeyW");
  console.log("PASS autosave resumes Option A as a playable epilogue");

  await page.getByRole("button", { name: /End the story/ }).click();
  await page.locator(".ending-screen").waitFor({ state: "visible" });
  await page.getByRole("button", { name: "Begin another loop" }).click();
  await waitScene(page, "home");
  await page.locator(".chapter-flash").waitFor({ state: "detached" });
  await keyboardStep(page, "KeyW");
  console.log("PASS ending button and new game restore working input");
  await context.close();

  const mobile = await createPage("epilogue-save", { viewport: { width: 390, height: 700 }, isMobile: true, hasTouch: true });
  await assertLayout(mobile.page);
  await buttonStep(mobile.page, "KeyW");
  await buttonStep(mobile.page, "KeyS");
  await buttonStep(mobile.page, "KeyD");
  await buttonStep(mobile.page, "KeyA", true);
  for (const code of ["KeyW", "KeyS", "KeyD", "KeyA"]) await touchStep(mobile.page, code);
  await mobile.context.close();

  // Exercise the real A choice, rather than only loading its epilogue from a save.
  const bunker = await createPage("bunker", { viewport: { width: 480, height: 360 } });
  await bunker.page.keyboard.down("ShiftLeft");
  await bunker.page.keyboard.down("KeyW");
  await bunker.page.waitForFunction(() => Number(document.querySelector(".world-root canvas").dataset.playerZ) < -6.4, null, { timeout: 180000 }).catch(async (error) => {
    console.log("Bunker position at timeout:", await pose(bunker.page));
    throw error;
  });
  await bunker.page.keyboard.up("KeyW");
  await bunker.page.keyboard.up("ShiftLeft");
  await bunker.page.keyboard.down("KeyD");
  await bunker.page.waitForFunction(() => Number(document.querySelector(".world-root canvas").dataset.playerX) > 2.7);
  await bunker.page.keyboard.up("KeyD");
  await bunker.page.locator(".world-root canvas").click();
  await bunker.page.waitForFunction(() => document.pointerLockElement !== null);
  const atConsole = await pose(bunker.page);
  const targetYaw = Math.atan2(atConsole.x - 2.8, atConsole.z + 9);
  const targetPitch = Math.atan2(0.85 - 1.68, Math.hypot(2.8 - atConsole.x, -9 - atConsole.z));
  await bunker.page.evaluate(({ movementX, movementY }) => window.dispatchEvent(new MouseEvent("mousemove", { movementX, movementY })), {
    movementX: (atConsole.yaw - targetYaw) / 0.002,
    movementY: (atConsole.pitch - targetPitch) / 0.002,
  });
  await bunker.page.waitForFunction(() => document.querySelector(".interaction-prompt")?.textContent.includes("Open regulator control"));
  await bunker.page.keyboard.press("KeyE");
  await bunker.page.locator(".regulator-modal").waitFor({ state: "visible" });
  await bunker.page.getByRole("button", { name: /Hold the hour open/ }).click();
  await waitScene(bunker.page, "epilogue-save");
  await keyboardStep(bunker.page, "KeyW");
  await keyboardStep(bunker.page, "KeyS");
  await buttonStep(bunker.page, "KeyD");
  console.log("PASS choosing Option A at the regulator preserves working controls");
  await bunker.context.close();
  assert.deepEqual(errors, [], "No runtime or WebGL errors");
  console.log("PASS all control regressions; no runtime errors");
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}