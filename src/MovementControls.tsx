import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";

export type ControlCode = "KeyW" | "KeyA" | "KeyS" | "KeyD" | "KeyE";
export type ControlInput = { code: ControlCode; down: boolean; source: string };
export const CONTROL_EVENT = "game-control";
export const RESET_CONTROLS_EVENT = "game-controls-reset";

const controls: Array<{ code: ControlCode; key: string; label: string; className: string }> = [
  { code: "KeyW", key: "W", label: "Forward", className: "move-up" },
  { code: "KeyA", key: "A", label: "Left", className: "move-left" },
  { code: "KeyS", key: "S", label: "Backward", className: "move-down" },
  { code: "KeyD", key: "D", label: "Right", className: "move-right" },
];

function sendInput(code: ControlCode, source: string, down: boolean) {
  window.dispatchEvent(new CustomEvent<ControlInput>(CONTROL_EVENT, { detail: { code, source, down } }));
}

export default function MovementControls({ active }: { active: boolean }) {
  const heldInputs = useRef(new Map<string, ControlCode>());
  const [pressed, setPressed] = useState<ControlCode[]>([]);

  const syncPressed = () => setPressed([...new Set(heldInputs.current.values())]);
  const press = (code: ControlCode, source: string) => {
    if (!active || heldInputs.current.has(source)) return;
    heldInputs.current.set(source, code);
    sendInput(code, source, true);
    syncPressed();
  };
  const release = (source: string) => {
    const code = heldInputs.current.get(source);
    if (!code) return;
    heldInputs.current.delete(source);
    sendInput(code, source, false);
    syncPressed();
  };

  useEffect(() => {
    const clear = () => {
      heldInputs.current.forEach((code, source) => sendInput(code, source, false));
      heldInputs.current.clear();
      setPressed([]);
    };
    if (!active) clear();
    const visibility = () => { if (document.hidden) clear(); };
    window.addEventListener("blur", clear);
    window.addEventListener(RESET_CONTROLS_EVENT, clear);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("blur", clear);
      window.removeEventListener(RESET_CONTROLS_EVENT, clear);
      document.removeEventListener("visibilitychange", visibility);
      heldInputs.current.forEach((code, source) => sendInput(code, source, false));
      heldInputs.current.clear();
    };
  }, [active]);

  const pointerDown = (event: ReactPointerEvent<HTMLButtonElement>, code: ControlCode) => {
    if (event.button !== 0 && event.pointerType !== "touch") return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    press(code, `pointer:${event.pointerId}`);
  };
  const pointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    release(`pointer:${event.pointerId}`);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const keyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, code: ControlCode) => {
    if (event.code !== "Space" && event.code !== "Enter") return;
    event.preventDefault();
    event.stopPropagation();
    press(code, `button:${code}:${event.code}`);
  };
  const keyUp = (event: ReactKeyboardEvent<HTMLButtonElement>, code: ControlCode) => {
    if (event.code !== "Space" && event.code !== "Enter") return;
    event.preventDefault();
    event.stopPropagation();
    release(`button:${code}:${event.code}`);
  };
  const button = (code: ControlCode, key: string, label: string, className: string) => (
    <button
      type="button"
      key={code}
      className={`movement-button ${className} ${pressed.includes(code) ? "is-pressed" : ""}`}
      data-control={code}
      aria-label={`${key} - ${label}`}
      aria-pressed={pressed.includes(code)}
      aria-keyshortcuts={key}
      title={`${key}: ${label}. Hold to ${code === "KeyE" ? "interact" : "move"}.`}
      onPointerDown={(event) => pointerDown(event, code)}
      onPointerUp={pointerUp}
      onPointerCancel={pointerUp}
      onLostPointerCapture={(event) => release(`pointer:${event.pointerId}`)}
      onKeyDown={(event) => keyDown(event, code)}
      onKeyUp={(event) => keyUp(event, code)}
      onBlur={() => {
        release(`button:${code}:Space`);
        release(`button:${code}:Enter`);
      }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <strong>{key}</strong>
      <span>{label}</span>
    </button>
  );

  if (!active) return null;
  return (
    <div className="movement-controls" role="group" aria-label="Movement controls">
      <div className="movement-pad">
        {controls.map(({ code, key, label, className }) => button(code, key, label, className))}
        <span className="movement-hint">HOLD TO MOVE</span>
      </div>
      <div className="interaction-control">{button("KeyE", "E", "Interact", "interact-button")}</div>
    </div>
  );
}