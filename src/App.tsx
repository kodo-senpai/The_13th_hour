import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import GameWorld, { type WorldScene } from "./GameWorld";

type RegisterDecision = "restore" | "keep" | null;
type EndingId = "save" | "preserve" | "unwritten";

type GameFlags = {
  fuseInstalled: boolean;
  powerOn: boolean;
  gateOpen: boolean;
  boardSolved: boolean;
  bunkerPower: boolean;
  commentary: boolean;
  photoLooks: number;
  registerDecision: RegisterDecision;
};

type SaveGame = {
  scene: WorldScene;
  inventory: string[];
  collected: string[];
  evidence: string[];
  flags: GameFlags;
  elapsed: number;
};

type ModalId = "diary" | "log" | "register" | "keypad-station" | "keypad-hatch" | "evidence" | "circuit" | "regulator" | "journal" | "photo" | null;

type PhotoView = { title: string; src: string; caption: string };

const SAVE_KEY = "the-13th-hour-save-v1";

const initialGame = (): SaveGame => ({
  scene: "home",
  inventory: [],
  collected: [],
  evidence: [],
  flags: {
    fuseInstalled: false,
    powerOn: false,
    gateOpen: false,
    boardSolved: false,
    bunkerPower: false,
    commentary: false,
    photoLooks: 0,
    registerDecision: null,
  },
  elapsed: 0,
});

const inventoryNames: Record<string, string> = {
  ticket: "Unused 1998 ticket",
  fuse: "60A cartridge fuse",
  "brass-key": "Brass maintenance key",
  "maintenance-log": "Rajiv's maintenance log",
  "recording-1": "Audio reel 01",
  "recording-2": "Audio reel 02",
  "recording-3": "Audio reel 03",
  "recording-4": "Audio reel 04",
  "recording-5": "Audio reel 05",
};

const evidenceNames: Record<string, string> = {
  diary: "Rajiv's final diary entry",
  "maintenance-log": "Maintenance Log 14/11/98",
  face: "The changed family photograph",
  "sealed-room": "Fresh police tape",
  register: "The restored arrival register",
};

const chapterData: Record<WorldScene, { number: string; title: string }> = {
  home: { number: "PROLOGUE", title: "A House Full of Static" },
  station: { number: "CHAPTER I", title: "Platform Zero" },
  past: { number: "CHAPTER II", title: "The Night of 1998" },
  wrong: { number: "CHAPTER III", title: "The Wrong Present" },
  bunker: { number: "CHAPTER IV", title: "The Thirteenth Hour" },
  "epilogue-save": { number: "EPILOGUE A", title: "A Familiar Stranger" },
  "epilogue-preserve": { number: "EPILOGUE B", title: "The Clocks Move Forward" },
  "epilogue-unwritten": { number: "EPILOGUE C", title: "The Unwritten Hour" },
};

function endingForScene(scene: WorldScene): EndingId | null {
  if (scene === "epilogue-save") return "save";
  if (scene === "epilogue-preserve") return "preserve";
  if (scene === "epilogue-unwritten") return "unwritten";
  return null;
}

function objectiveFor(game: SaveGame) {
  if (game.scene === "epilogue-save") return "Explore the changed home. Speak with Rajiv and inspect the family photograph.";
  if (game.scene === "epilogue-preserve") return "Find the unstamped envelope on the coffee table.";
  if (game.scene === "epilogue-unwritten") return "Meet the Conductor and inspect the phone on Platform 2.";
  if (game.scene === "home") return "Find Rajiv's cracked leather diary in the study.";
  if (game.scene === "station") {
    if (!game.collected.includes("fuse")) return "Search the platform for a 60-amp fuse.";
    if (!game.collected.includes("brass-key")) return "Find the brass maintenance key.";
    if (!game.flags.fuseInstalled) return "Install the fuse in the wall cabinet.";
    if (!game.flags.powerOn) return "Throw the main isolator.";
    if (!game.flags.gateOpen) return "Open the clock-room keypad. The clocks remember.";
    return "Cross to the far end and board the spectral train.";
  }
  if (game.scene === "past") {
    if (!game.collected.includes("maintenance-log")) return "Find Rajiv's desk and read his maintenance log.";
    return "Compare the arrival register with what Rajiv recorded.";
  }
  if (game.scene === "wrong") {
    if (!game.flags.boardSolved) return "Meet Meera in the waiting hall and connect the anomalies.";
    return "Open the east maintenance hatch. The old code still works.";
  }
  const recordings = game.collected.filter((id) => id.startsWith("recording-")).length;
  if (!game.flags.bunkerPower) return "Route power through the underground generator.";
  if (recordings < 5) return `Recover the loop recordings. ${recordings}/5 found.`;
  return "Enter the regulator chamber and decide what survives.";
}

function Icon({ name }: { name: "bag" | "journal" | "sound" | "pause" | "flashlight" }) {
  const paths = {
    bag: <><path d="M6 8h12l1 12H5L6 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></>,
    journal: <><path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2V4Z"/><path d="M8 8h7M8 12h7"/></>,
    sound: <><path d="M5 10h3l4-4v12l-4-4H5v-4Z"/><path d="M15 9a4 4 0 0 1 0 6M17 6a8 8 0 0 1 0 12"/></>,
    pause: <><path d="M8 5v14M16 5v14"/></>,
    flashlight: <><path d="m8 4 8 3-2 5-8-3 2-5ZM10 10l-2 9M14 11l2 8"/></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

function Keypad({ context, onClose, onSuccess, onCommentary }: { context: "station" | "hatch"; onClose: () => void; onSuccess: (firstTry: boolean) => void; onCommentary: () => void }) {
  const [value, setValue] = useState("");
  const [message, setMessage] = useState(context === "station" ? "CLOCK ROOM / AUTHORIZED STAFF" : "EAST MAINTENANCE / NO ENTRY");
  const [attempts, setAttempts] = useState(0);
  const enter = () => {
    if (value === "0420") {
      onCommentary();
      setMessage("DEV COMMENTARY: RAJIV IS LISTENING");
      setValue("");
      return;
    }
    if (value === "1313") {
      setMessage(attempts === 0 ? "ACCESS GRANTED / A TINY JINGLE PLAYS" : "ACCESS GRANTED");
      window.setTimeout(() => onSuccess(attempts === 0), 450);
    } else {
      setAttempts((count) => count + 1);
      setMessage(value.includes("9") ? "9 HELD TOO LONG. REGISTERED: 13. OF COURSE." : "ACCESS DENIED / THE CLOCK TICKS BACKWARDS");
      setValue("");
    }
  };
  return (
    <ModalShell onClose={onClose} width="narrow">
      <div className="keypad-head"><span>RLY / 98</span><i className="status-led" /></div>
      <div className="keypad-display">{value || message}</div>
      <div className="key-grid">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((number) => <button key={number} onClick={() => setValue((current) => (current + number).slice(-4))}>{number}</button>)}
        <button onClick={() => setValue("")}>CLR</button>
        <button onClick={() => setValue((current) => (current + "0").slice(-4))}>0</button>
        <button className="key-enter" onClick={enter}>ENT</button>
      </div>
      <p className="keypad-hint">A timetable is only a clock with somewhere to be.</p>
    </ModalShell>
  );
}

function EvidenceBoard({ onClose, onSolved }: { onClose: () => void; onSolved: () => void }) {
  const [placed, setPlaced] = useState<Record<string, string>>({});
  const [dragged, setDragged] = useState<string | null>(null);
  const items = [
    { id: "face", title: "PHOTO / HOME", body: "The blank now has a face." },
    { id: "sealed", title: "OFFICE / 2026", body: "Police tape appeared overnight." },
    { id: "register", title: "REGISTER / 1998", body: "The missing page restored itself." },
  ];
  const targets = [
    { id: "face", title: "IDENTITY CHANGED" },
    { id: "sealed", title: "HISTORY DEFENDED" },
    { id: "register", title: "RECORD REWRITTEN" },
  ];
  const connect = (target: string) => {
    if (dragged === target) setPlaced((current) => ({ ...current, [target]: target }));
    setDragged(null);
  };
  const solved = Object.keys(placed).length === 3;
  return (
    <ModalShell onClose={onClose} width="wide" className="evidence-modal">
      <div className="board-heading"><span className="eyebrow">MEERA'S INVESTIGATION</span><h2>Find what the hour changed.</h2><p>Drag each document to the conclusion it supports.</p></div>
      <div className="evidence-board">
        <div className="evidence-source">
          {items.map((item, index) => (
            <button key={item.id} draggable={!placed[item.id]} onDragStart={() => setDragged(item.id)} onClick={() => setDragged(item.id)} className={`evidence-paper paper-${index + 1} ${placed[item.id] ? "is-placed" : ""} ${dragged === item.id ? "is-selected" : ""}`}>
              <small>{item.title}</small><strong>{item.body}</strong><span>{item.id === "face" ? "14 NOV / HEAT DAMAGED" : item.id === "sealed" ? "CASE ID: NONE" : "ARRIVAL: 23:58"}</span>
            </button>
          ))}
        </div>
        <svg className="board-lines" viewBox="0 0 600 240" preserveAspectRatio="none" aria-hidden="true">
          {targets.map((target, index) => placed[target.id] && <line key={target.id} x1="150" y1={42 + index * 78} x2="450" y2={42 + index * 78} />)}
        </svg>
        <div className="evidence-targets">
          {targets.map((target) => (
            <button key={target.id} onDragOver={(event) => event.preventDefault()} onDrop={() => connect(target.id)} onClick={() => connect(target.id)} className={placed[target.id] ? "matched" : ""}>
              <span>{placed[target.id] ? "CONNECTED" : "DROP EVIDENCE"}</span>{target.title}
            </button>
          ))}
        </div>
      </div>
      <div className="board-footer"><p>{solved ? "Meera: The hour didn't hide the truth. It edited the witnesses." : "Tip: tap a paper, then tap its matching conclusion on touch screens."}</p><button className="primary-action" disabled={!solved} onClick={onSolved}>Mark the east hatch</button></div>
    </ModalShell>
  );
}

function CircuitPuzzle({ onClose, onSolved }: { onClose: () => void; onSolved: () => void }) {
  const [nodes, setNodes] = useState([false, false, false]);
  const [message, setMessage] = useState("ROUTE: PLATFORM > CLOCK / BYPASS REGULATOR");
  const labels = ["PLATFORM RELAY", "CLOCK BUS", "REGULATOR BYPASS"];
  const toggle = (index: number) => setNodes((current) => current.map((state, i) => i === index ? !state : state));
  const test = () => {
    if (nodes[0] && nodes[1] && !nodes[2]) {
      setMessage("CIRCUIT STABLE. THE MACHINE SOUNDS DISAPPOINTED.");
      window.setTimeout(onSolved, 550);
    } else setMessage("GENERATOR: I WAITED 28 YEARS FOR THIS?");
  };
  return (
    <ModalShell onClose={onClose} width="medium" className="circuit-modal">
      <span className="eyebrow">FACILITY POWER / MANUAL ROUTING</span><h2>Close a simple circuit.</h2>
      <div className="circuit-panel">
        <div className="circuit-rail"><i className={nodes[0] ? "live" : ""}/><i className={nodes[0] && nodes[1] ? "live" : ""}/></div>
        {labels.map((label, index) => <button key={label} onClick={() => toggle(index)} className={nodes[index] ? "switch-on" : ""}><span className="switch-track"><i /></span><strong>{label}</strong><small>{nodes[index] ? "CLOSED" : "OPEN"}</small></button>)}
      </div>
      <div className="circuit-readout">{message}</div><button className="primary-action full" onClick={test}>Test route</button>
    </ModalShell>
  );
}

function Regulator({ eligible, recordings, onClose, onEnding }: { eligible: boolean; recordings: number; onClose: () => void; onEnding: (ending: EndingId) => void }) {
  const [hour, setHour] = useState(12);
  const [minute, setMinute] = useState(0);
  const setDial = (setter: React.Dispatch<React.SetStateAction<number>>, max: number, change: number) => setter((value) => (value + change + max) % max);
  const secretReady = eligible && hour === 13 && minute === 13;
  return (
    <ModalShell onClose={onClose} width="wide" className="regulator-modal">
      <div className="regulator-copy"><span className="eyebrow">CHAPTER V / THE CHOICE</span><h2>One hour is missing from the world.</h2><p>Rajiv is alive inside the open circuit. So are eleven versions of the man who tried to save him. The machine will accept one final instruction.</p>
        <div className="ending-actions"><button onClick={() => onEnding("save")}><span>A</span><strong>Hold the hour open</strong><small>Save the past</small></button><button onClick={() => onEnding("preserve")}><span>B</span><strong>Smash the regulator</strong><small>Preserve reality</small></button></div>
      </div>
      <div className={`secret-dials ${eligible ? "eligible" : ""}`}><div className="dial-title"><span>UNLISTED PROCEDURE</span><small>{recordings}/5 REELS</small></div><div className="dial-row"><Dial value={hour} label="HOUR" onMinus={() => setDial(setHour, 14, -1)} onPlus={() => setDial(setHour, 14, 1)} /><b>:</b><Dial value={minute} label="MIN" onMinus={() => setDial(setMinute, 60, -1)} onPlus={() => setDial(setMinute, 60, 1)} /></div><p>{eligible ? "The sixth recording contains no instruction. Only a very tired sigh." : "Complete the evidence board and recover every recording."}</p><button className="secret-action" disabled={!secretReady} onClick={() => onEnding("unwritten")}>Do not open it. Walk away.</button></div>
    </ModalShell>
  );
}

function Dial({ value, label, onMinus, onPlus }: { value: number; label: string; onMinus: () => void; onPlus: () => void }) {
  return <div className="dial"><button onClick={onMinus}>-</button><strong>{String(value).padStart(2, "0")}</strong><button onClick={onPlus}>+</button><small>{label}</small></div>;
}

function ModalShell({ children, onClose, width = "medium", className = "" }: { children: React.ReactNode; onClose: () => void; width?: "narrow" | "medium" | "wide"; className?: string }) {
  return <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><motion.section className={`modal-shell modal-${width} ${className}`} initial={{ opacity: 0, y: 28, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16 }} transition={{ duration: 0.28 }}><button className="modal-close" onClick={onClose} aria-label="Close">ESC</button>{children}</motion.section></motion.div>;
}

function DocumentModal({ type, onClose, onAction }: { type: "diary" | "log" | "register"; onClose: () => void; onAction: (action: string) => void }) {
  if (type === "diary") return (
    <ModalShell onClose={onClose} width="wide" className="document-modal"><div className="document-meta"><span>RAJIV MALHOTRA</span><span>14 NOVEMBER 1998 / 22:41</span></div><h2>The master clock ran backwards again.</h2><div className="document-columns"><p>I thought it was the motor. It is not the motor. At 00:13 the second hand began removing seconds from the room. The signal lamps dimmed, but their shadows stayed lit.</p><p>The Board calls the device a regulator. In the old drawings someone wrote <em>Hour-Glass</em>. It does not move time. It holds one hour out of the world until someone pays the difference.</p><p>If Aarav finds this: the hollow board is not a hiding place. It is an apology.</p></div><div className="ticket-stub"><div><small>NORTHERN RAILWAY / 1998</small><strong>23:58 MAIL EXPRESS</strong><span>SURAJPUR HALT TO [UNPRINTED]</span></div><b>1313</b></div><blockquote>"You can change the past. But the past remembers you."</blockquote><button className="primary-action" onClick={() => onAction("use-ticket")}>Punch the unused ticket</button></ModalShell>
  );
  if (type === "log") return (
    <ModalShell onClose={onClose} width="wide" className="document-modal log-paper"><div className="document-meta"><span>SIGNAL & CLOCK MAINTENANCE</span><span>FORM 13-B / DO NOT DUPLICATE</span></div><h2>Rajiv's maintenance log</h2><div className="log-grid"><span>22:48</span><p>Master clock losing negative seven minutes. Yes, I know how that sounds.</p><span>23:13</span><p>Regulator drawing current with supply isolated.</p><span>23:41</span><p>Ramesh brought tea. Tea arrived cold, became hot after six minutes.</p><span>23:58</span><p>Mail Express recorded at Platform 2. Inspection report says no train scheduled.</p><span>00:13</span><p>IF I AM STILL HERE, DO NOT LET THEM RESTORE THE PAGE.</p></div><button className="primary-action" onClick={() => onAction("take-log")}>Keep as evidence</button></ModalShell>
  );
  return (
    <ModalShell onClose={onClose} width="wide" className="document-modal register-paper"><div className="document-meta"><span>ARRIVAL REGISTER / SURAJPUR HALT</span><span>PAGE 113</span></div><h2>The page is torn exactly around one train.</h2><div className="register-lines"><p><span>23:21</span><b>Local 604</b><i>Platform 1 / 4 min late</i></p><p className="torn"><span>23:58</span><b>MAIL EXPRESS</b><i>Platform 2 / arrival unconfirmed</i></p><p><span>00:24</span><b>Goods 19</b><i>Passed signal / no stop</i></p></div><p className="decision-copy">The torn piece is under Rajiv's blotter. Restoring it may prove the train existed. Keeping it may preserve the warning he left.</p><div className="decision-row"><button onClick={() => onAction("restore")}><strong>Restore the page</strong><span>Make the official record whole</span></button><button onClick={() => onAction("keep")}><strong>Keep the truth</strong><span>Leave the contradiction exposed</span></button></div></ModalShell>
  );
}

function PhotoModal({ view, onClose }: { view: PhotoView; onClose: () => void }) {
  return (
    <ModalShell onClose={onClose} width="wide" className="photo-modal">
      <span className="eyebrow">{view.title}</span>
      <figure className="photo-figure">
        <img src={view.src} alt={view.title} />
        <figcaption>{view.caption}</figcaption>
      </figure>
    </ModalShell>
  );
}


const worldNotes: Record<string, string> = {
  home_rajiv_portrait: "Rajiv, twenty-eight years ago. The moustache is doing most of the smiling.",
  home_hall_photo: "A second copy of the family photograph. The child's face is blank in this one too.",
  home_bedroom_photo: "Someone has tucked the photograph into the frame crookedly. As if it had been moved recently.",
  home_kitchen_kettle: "The kettle is still warm. Nobody has lived here for twenty-eight years, but the kitchen disagrees.",
  home_letters: "Dozens of letters addressed to the Northern Railway Board. Every stamp is cancelled. Every envelope is unopened.",
  home_umbrella: "Still wet. The rain has not started yet.",
  home_door: "The chain is fastened from the inside. There is nobody else in the house.",
  home_clock: "The wall clock is four minutes slow. It has been four minutes slow since 1998.",
  home_study_box: "Photographs of a boy at the Surajpur Halt. Each one has a blurred man standing behind him.",
  station_noticeboard: "NOTICE: Surajpur Halt is closed until further notice. The notice is also closed. A pigeon has signed it.",
  station_missing_poster: "MISSING: Rajiv Malhotra. Last seen 14/11/98, carrying a fuse and a strong opinion about clocks.",
  station_luggage: "A trunk with a tag reading 'A. MALHOTRA — DO NOT OPEN BEFORE 2026'. You are twenty-eight years late.",
  station_water: "The tank is dry, but the tap is dripping perfectly in time with the station clock.",
  station_cart: "A coolie's trolley. The suitcases have labels from stations that were never built.",
  station_platform_photo: "Several blurred figures on the 1998 platform. They all have the same walk.",
  station_stationmaster: "The stationmaster's office. The lock is new, the brass is old, and the doorknob is slightly warm.",
  station_counter: "A bell, a ticket rack, and a smell of peanuts. The ticket window has been closed from the inside.",
  station_timetable: "23:58 Mail Express — arrival unconfirmed. A later hand has written: ARRIVES WHEN YOU DO.",
  station_lost: "Lost property: one umbrella, one tiffin box, eleven identical wristwatches stopped at 13:13.",
  station_hall_bench: "The bench has a dent worn into it by someone who waited a very long time.",
  station_bench: "A platform bench. The graffiti beneath it says 'AARAV WAS HERE — IN 1998'.",
  station_bench_far: "This bench faces the track. Someone has left a still-warm cup of tea and no cup.",
  station_family_photo: "The stationmaster with his family. Every face has been lovingly preserved except one.",
  station_graffiti: "The paint is fresh. The wall beneath it is twenty-eight years old.",
  station_chai: "Ramesh does not remember you, but he has already poured your tea. It is exactly how you like it.",
  station_chai_cup: "The same chai cup you will find in 1998. The rim is chipped in the same place. You decide not to think about it.",
  station_chai_bench: "The dog has claimed the bench. The dog has also claimed the tea. Negotiations are ongoing.",
  general_store: "The shutter is down. The smell of cardamom and kerosene has escaped anyway.",
  photo_shop: "IDEAL PHOTO STUDIO. In the window: a wedding party, a family, and a platform full of blurred men.",
  tailor_shop: "IDEAL TAILORS. A sign promises 'ALTERATIONS WHILE YOU WAIT'. Below it: 'WE HAVE BEEN WAITING SINCE 1998'.",
  records_clerk: "Clerk: 'Surajpur? Never existed. Would you like a souvenir map? It's very detailed, apart from the obvious.'",
  records_map: "The map is beautifully printed. There is a perfect rectangular hole where Surajpur should be.",
  records_stamp: "The official stamp reads: NOT FOUND. It appears well used.",
  wrong_police_tape: "The seal is fresh. The case number has been scraped off, but the adhesive is still warm.",
  street_auto: "The auto-rickshaw's meter says Rs. 13. The driver is missing. The engine is warm.",
  street_dog: "The dog looks at you, then at the chai stall, then at you again. It has seen every loop and is bored of all of them.",
  bunker_breaker: "The breaker panel is labelled in someone's handwriting. One label simply says 'NO'.",
  bunker_crate: "A sealed crate stamped 'RAILWAY PROPERTY — 1998 — DO NOT RESTORE'. The nails are new.",
  bunker_pump: "The coolant pump is warm. Its gauge reads 13.13 and refuses to be corrected.",
  bunker_tank: "A pressure tank. Someone has taped a photograph of Rajiv to it, facing into the dark.",
  bunker_control_notes: "Operator notes: 'Attempt 11. The station is missing again. The teapot is still full.'",
  bunker_store_box: "Inside the quartermaster's box: a whistle, a fuse diagram, and eleven farewell letters written in your father's hand.",
  bunker_ascii: "You play a tiny ASCII version of the entire game. You beat it in four minutes, which makes you feel worse.",
  bunker_clock: "The clock stopped at 13:13. It has stopped so hard that the second hand has bent.",
  bunker_screens: "The projector blurs. Eleven platform photographs overlap. Every blurred man is your father.",
};

const endings: Record<EndingId, { code: string; title: string; subtitle: string; body: string; after: string }> = {
  save: { code: "ENDING A / SAVE THE PAST", title: "A familiar stranger", subtitle: "14 November 2026, somewhere that almost remembers you", body: "Rajiv steps off the 23:58 train with his moustache, his terrible jokes, and twenty-eight years he never had to lose. The house is warmer. The photograph shows a happier boy. When you say your name, your father smiles politely and asks who you came to see.", after: "On the fridge: THE TRAIN WAS ON TIME. YOU WERE NOT." },
  preserve: { code: "ENDING B / PRESERVE REALITY", title: "The clocks move forward", subtitle: "The original, broken world", body: "The regulator breaks like a frozen lake. Every stolen second returns at once. Surajpur Halt collapses into the history it was denied, and Rajiv remains a name in a diary. Years later, an envelope arrives with no stamp. Inside is a fresh ticket for a station that never existed.", after: "Departure: 23:58. Passenger: AARAV MALHOTRA + 1." },
  unwritten: { code: "ENDING C / THE UNWRITTEN HOUR", title: "You owe the hour nothing", subtitle: "13:13, outside the timetable", body: "You align the dials and refuse the machine its final instruction. Then you walk away. The loop waits for a choice that never comes, folds inward, and becomes a blank line in every record. On Platform 2, the Conductor hands you a perfectly ordinary phone.", after: "1 notification: Your father liked your status." },
};

export default function App() {
  const [screen, setScreen] = useState<"menu" | "game" | "epilogue" | "ending">("menu");
  const [game, setGame] = useState<SaveGame>(initialGame);
  const [modal, setModal] = useState<ModalId>(null);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [ending, setEnding] = useState<EndingId | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [flashlight, setFlashlight] = useState(true);
  const [hasSave, setHasSave] = useState(() => Boolean(localStorage.getItem(SAVE_KEY)));
  const [chapterFlash, setChapterFlash] = useState(false);
  const [photoView, setPhotoView] = useState<PhotoView | null>(null);
  const audioRef = useRef<{ context: AudioContext; drone: OscillatorNode; gain: GainNode } | null>(null);
  const elapsedStart = useRef(Date.now());

  const recordings = game.collected.filter((id) => id.startsWith("recording-")).length;
  const objective = useMemo(() => objectiveFor(game), [game]);
  const active = (screen === "game" || screen === "epilogue") && !modal && !inventoryOpen && !paused;

  const initAudio = useCallback(() => {
    if (audioRef.current) { audioRef.current.context.resume(); return; }
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const context = new AudioContextClass();
    const drone = context.createOscillator();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    drone.type = "sawtooth";
    drone.frequency.value = 46;
    filter.type = "lowpass";
    filter.frequency.value = 140;
    gain.gain.setValueAtTime(0, context.currentTime);
    gain.gain.linearRampToValueAtTime(soundOn ? 0.02 : 0, context.currentTime + 0.5);
    drone.connect(filter).connect(gain).connect(context.destination);
    drone.start();
    audioRef.current = { context, drone, gain };
  }, [soundOn]);

  const playTone = useCallback((frequency = 220, duration = 0.12, volume = 0.045) => {
    const audio = audioRef.current;
    if (!audio || !soundOn) return;
    const oscillator = audio.context.createOscillator();
    const gain = audio.context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, audio.context.currentTime);
    gain.gain.setValueAtTime(volume, audio.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.context.currentTime + duration);
    oscillator.connect(gain).connect(audio.context.destination);
    oscillator.start();
    oscillator.stop(audio.context.currentTime + duration);
  }, [soundOn]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.gain.gain.setTargetAtTime(soundOn ? (game.scene === "bunker" ? 0.035 : game.scene === "past" ? 0.018 : 0.02) : 0, audioRef.current.context.currentTime, 0.4);
    audioRef.current.drone.frequency.setTargetAtTime(game.scene === "past" ? 52 : game.scene === "bunker" ? 36 : game.scene === "home" ? 44 : 46, audioRef.current.context.currentTime, 0.6);
  }, [soundOn, game.scene]);

  useEffect(() => {
    if (screen !== "game" && screen !== "epilogue") return;
    const save = { ...game, elapsed: game.elapsed + Math.floor((Date.now() - elapsedStart.current) / 1000) };
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    setHasSave(true);
  }, [game, screen]);

  const closeEpilogue = useCallback(() => {
    if (document.pointerLockElement) document.exitPointerLock();
    setPaused(false);
    setInventoryOpen(false);
    setModal(null);
    setScreen("ending");
  }, []);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (screen !== "game" && screen !== "epilogue") return;
      if (event.repeat) return;
      if (event.code === "Escape") {
        if (modal) setModal(null);
        else if (inventoryOpen) setInventoryOpen(false);
        else setPaused((value) => !value);
        return;
      }
      if (modal || inventoryOpen || paused) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || target.matches("input, textarea, select"))) return;
      if (screen === "epilogue" && event.code === "KeyN") { closeEpilogue(); return; }
      if (event.code === "KeyI") setInventoryOpen(true);
      if (event.code === "KeyJ") setModal("journal");
      if (event.code === "KeyF") setFlashlight((on) => !on);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [screen, modal, inventoryOpen, paused, closeEpilogue]);

  const announce = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((current) => current === message ? null : current), 3200);
  }, []);
  const updateGame = useCallback((recipe: (current: SaveGame) => SaveGame) => setGame((current) => recipe(current)), []);
  const addCollected = useCallback((id: string, inventory = true) => {
    updateGame((current) => ({ ...current, collected: current.collected.includes(id) ? current.collected : [...current.collected, id], inventory: inventory && !current.inventory.includes(id) ? [...current.inventory, id] : current.inventory }));
  }, [updateGame]);
  const addEvidence = useCallback((ids: string[]) => {
    updateGame((current) => ({ ...current, evidence: [...new Set([...current.evidence, ...ids])] }));
  }, [updateGame]);
  const changeScene = useCallback((scene: WorldScene) => {
    setGame((current) => ({ ...current, scene }));
    setChapterFlash(true);
    window.setTimeout(() => setChapterFlash(false), 2400);
    playTone(scene === "past" ? 330 : 115, 0.8, 0.06);
  }, [playTone]);

  const interaction = useCallback((id: string) => {
    playTone(185, 0.1);
    if (id === "epilogue_photo") {
      const changed = game.scene === "epilogue-save";
      setPhotoView({
        title: changed ? "A FAMILY YOU DO NOT REMEMBER" : "THE ORIGINAL FAMILY PHOTOGRAPH",
        src: changed ? "images/family-photo-changed.jpg" : "images/family-photo.jpg",
        caption: changed ? "Rajiv is here. So is a different boy. There is no space in the photograph for you." : "The child's face is still blank. This is the world you chose to keep.",
      });
      setModal("photo");
    }
    else if (id === "epilogue_stranger") announce("Rajiv: I'm sorry, do we know each other? You look like someone I almost remember.");
    else if (id === "epilogue_teacup") announce("The tea is warm. A second cup is set beside it. Neither was made for you.");
    else if (id === "epilogue_magnet") announce("THE TRAIN WAS ON TIME. YOU WERE NOT.");
    else if (id === "epilogue_radio") announce("A familiar song plays on All India Radio. Rajiv hums along, unaware you know every word.");
    else if (id === "epilogue_envelope") announce("Inside: a fresh ticket. Departure 23:58. Passenger: AARAV MALHOTRA + 1.");
    else if (id === "epilogue_conductor") announce("Conductor: A perfectly ordinary phone. Even I draw the line at a railway app.");
    else if (id === "epilogue_phone") announce("1 notification: Your father liked your status.");
    else if (id === "home_diary") setModal("diary");
    else if (id === "home_radio") announce(game.flags.commentary ? "Rajiv: You are tuning a radio. Tremendous progress." : "Static gathers into a whisper: thirteen... thirteen...");
    else if (id === "home_magnet") announce("THE TRAIN IS LATE AGAIN.");
    else if (id === "home_photo") {
      const looks = game.flags.photoLooks + 1;
      updateGame((current) => ({ ...current, flags: { ...current.flags, photoLooks: looks } }));
      setPhotoView({ title: "FAMILY PHOTOGRAPH / HOME", src: "images/family-photo.jpg", caption: looks >= 4 ? "The blank face sticks out its tongue. You blink. It is blank again." : "Rajiv, Aarav, and a child whose face has been burned out by heat." });
      setModal("photo");
    } else if (id === "station_fuse") { addCollected("fuse"); announce("60A FUSE: 'Do Not Use After 1994. Or do. We're not your mother.'"); }
    else if (id === "station_key") { addCollected("brass-key"); announce("Brass maintenance key added to inventory."); }
    else if (id === "station_fusebox") {
      if (!game.inventory.includes("fuse")) announce("One cartridge fuse is missing. Naturally, it is an unusual size.");
      else if (!game.inventory.includes("brass-key")) announce("The cabinet is locked. Maintenance believed in job security.");
      else if (!game.flags.fuseInstalled) { updateGame((current) => ({ ...current, flags: { ...current.flags, fuseInstalled: true } })); announce("Fuse installed. Somewhere in the dark, a relay clears its throat."); }
      else announce("The new old fuse is seated firmly.");
    } else if (id === "station_isolator") {
      if (!game.flags.fuseInstalled) announce("The isolator refuses to energize an empty circuit.");
      else if (!game.flags.powerOn) { updateGame((current) => ({ ...current, flags: { ...current.flags, powerOn: true } })); announce("BZZT. Announcement: Please mind the gap... and your existential dread."); playTone(72, 0.65, 0.08); }
    } else if (id === "station_keypad") { if (!game.flags.powerOn) announce("No power. The sticky 9 key looks smug."); else setModal("keypad-station"); }
    else if (id === "station_photo") {
      setPhotoView({ title: "PLATFORM PHOTOGRAPH / 1998", src: "images/platform-photo.jpg", caption: "Surajpur Halt, some evening in the nineties. Several blurred men on the platform, all wearing the same expression of mild disappointment." });
      setModal("photo");
    }
    else if (id === "wrong_family_photo") {
      setPhotoView({ title: "FAMILY PHOTOGRAPH / UPDATED", src: "images/family-photo-changed.jpg", caption: "The child has a face now. An older boy with Rajiv's moustache. He appears to be judging your life choices." });
      setModal("photo");
    }
    else if (id === "bunker_ghost") announce("The blurred figure turns, sees you, and politely walks through a wall. It is, unmistakably, Rajiv.");
    else if (id === "station_vending") announce("The machine dispenses an expired 1998 ticket. It wants exact change from 1998.");
    else if (id === "station_conductor") announce(game.flags.gateOpen ? "Conductor: Ticket, please. And whatever remains of your confidence." : "The Conductor turns his head too far, then politely turns it back.");
    else if (id === "station_train") { if (game.flags.gateOpen) changeScene("past"); }
    else if (id === "past_guard") announce("Suresh: The Board says clocks cannot get sick. The Board has never met this clock.");
    else if (id === "past_clerk") announce("Clerk: Return ticket? Just in case the past doesn't work out.");
    else if (id === "past_chai") announce("Ramesh: Rajiv talks to the hour like it owes him money. Tea?");
    else if (id === "past_chai_cup") announce("ACHIEVEMENT: Tea Timeline. The multiverse is just one cup poured badly.");
    else if (id === "past_log") setModal("log");
    else if (id === "past_register") { if (!game.collected.includes("maintenance-log")) announce("The entries mean little without Rajiv's maintenance log."); else setModal("register"); }
    else if (id === "wrong_meera") setModal("evidence");
    else if (id === "wrong_hatch") { if (!game.flags.boardSolved) announce("The hatch keypad is dead. Meera thinks the anomalies form a route."); else setModal("keypad-hatch"); }
    else if (id === "home_rajiv_portrait") { setPhotoView({ title: "RAJIV MALHOTRA / 1998", src: "images/rajiv-portrait.jpg", caption: "Signal engineer, Northern Railway. Twenty-eight years missing and still better dressed than you." }); setModal("photo"); }
    else if (id === "home_hall_photo") { setPhotoView({ title: "FAMILY PHOTOGRAPH / COPY", src: "images/family-photo.jpg", caption: "A second copy, found behind the first. The blank face has been carefully preserved." }); setModal("photo"); }
    else if (id === "home_bedroom_photo") { setPhotoView({ title: "FAMILY PHOTOGRAPH / BEDROOM", src: "images/family-photo.jpg", caption: "Rajiv, your mother, and you. The heat damage looks deliberate now that you think about it." }); setModal("photo"); }
    else if (id === "station_missing_poster") { setPhotoView({ title: "MISSING PERSON / 1998", src: "images/rajiv-portrait.jpg", caption: "RAJIV MALHOTRA. Last seen at a station the Board says does not exist." }); setModal("photo"); }
    else if (id === "station_platform_photo") { setPhotoView({ title: "PLATFORM PHOTOGRAPH / 1998", src: "images/platform-photo.jpg", caption: "Every blurred figure on the platform is the same man. You have started counting." }); setModal("photo"); }
    else if (id === "station_family_photo") { setPhotoView({ title: game.scene === "wrong" ? "FAMILY PHOTOGRAPH / CHANGED" : "STATIONMASTER'S FAMILY", src: game.scene === "wrong" ? "images/family-photo-changed.jpg" : "images/family-photo.jpg", caption: "The stationmaster's family photograph. The child has a face now, and the face is judging you." }); setModal("photo"); }
    else if (id === "records_map") { setPhotoView({ title: "SOUVENIR MAP / SURAJPUR DISTRICT", src: "images/souvenir-map.jpg", caption: "A perfect rectangular hole where the station should be. The clerk sold it without blinking." }); setModal("photo"); }
    else if (id === "records_clerk") announce(worldNotes.records_clerk);
    else if (worldNotes[id]) announce(worldNotes[id]);
    else if (id === "bunker_generator") setModal("circuit");
    else if (id.startsWith("bunker_tape_")) {
      const number = id.split("_").at(-1)!;
      addCollected(`recording-${number}`);
      const transcripts = ["Loop 03: Rajiv survived. Aarav did not remember him.", "Loop 06: The station moved three kilometres east.", "Loop 08: Every blurred man in the photographs is me.", "Loop 10: The Conductor asked which version I was.", "Loop 11: Do not open the hour. Set it, then leave."];
      announce(transcripts[Number(number) - 1]);
    } else if (id === "bunker_console") { if (!game.flags.bunkerPower) announce("The console is dead. Its error light somehow looks judgmental."); else setModal("regulator"); }
    else if (id === "bunker_regulator") {
      if (!game.flags.bunkerPower) announce("The Hour-Glass is dormant, but something inside it is counting.");
      else { if (recordings === 5) announce("A hidden sixth recording plays: eleven seconds of the Conductor sighing."); setModal("regulator"); }
    }
  }, [addCollected, announce, changeScene, game, playTone, recordings, updateGame]);

  const documentAction = (action: string) => {
    if (action === "use-ticket") { addCollected("ticket"); addEvidence(["diary"]); setModal(null); changeScene("station"); return; }
    if (action === "take-log") { addCollected("maintenance-log"); addEvidence(["maintenance-log"]); setModal(null); announce("The log and inspection report disagree by one impossible train."); return; }
    if (action === "restore" || action === "keep") {
      updateGame((current) => ({ ...current, flags: { ...current.flags, registerDecision: action as RegisterDecision } }));
      setModal(null); changeScene("wrong"); announce(action === "restore" ? "The paper seals itself. Somewhere, a lock clicks shut." : "You keep the torn page. History restores it anyway.");
    }
  };

  const clearOverlays = () => {
    if (document.pointerLockElement) document.exitPointerLock();
    setPaused(false);
    setInventoryOpen(false);
    setModal(null);
    setToast(null);
    setChapterFlash(false);
  };
  const startNew = () => {
    initAudio();
    clearOverlays();
    setEnding(null);
    setGame(initialGame());
    elapsedStart.current = Date.now();
    setScreen("game");
    setChapterFlash(true);
    window.setTimeout(() => setChapterFlash(false), 2200);
  };
  const continueGame = () => {
    initAudio();
    clearOverlays();
    const raw = localStorage.getItem(SAVE_KEY);
    let loaded = initialGame();
    if (raw) {
      try {
        const saved = JSON.parse(raw) as SaveGame;
        if (saved && Object.prototype.hasOwnProperty.call(chapterData, saved.scene)) loaded = saved;
      } catch { /* An invalid save starts a new game rather than blocking the controls. */ }
    }
    const savedEnding = endingForScene(loaded.scene);
    setGame(loaded);
    setEnding(savedEnding);
    elapsedStart.current = Date.now();
    setScreen(savedEnding ? "epilogue" : "game");
  };
  const finish = (id: EndingId) => {
    playTone(id === "unwritten" ? 392 : id === "save" ? 262 : 98, 1.2, 0.08);
    clearOverlays();
    setEnding(id);
    const epilogueScene: WorldScene = id === "save" ? "epilogue-save" : id === "preserve" ? "epilogue-preserve" : "epilogue-unwritten";
    setGame((current) => ({ ...current, scene: epilogueScene }));
    setScreen("epilogue");
  };
  const completeBoard = () => { updateGame((current) => ({ ...current, flags: { ...current.flags, boardSolved: true } })); addEvidence(["face", "sealed-room", "register"]); setModal(null); announce("Three anomalies, one line. It points to the east maintenance hatch."); };
  const unlockKeypad = (context: "station" | "hatch", firstTry: boolean) => {
    if (firstTry) playTone(523, 0.2, 0.055);
    setModal(null);
    if (context === "station") { updateGame((current) => ({ ...current, flags: { ...current.flags, gateOpen: true } })); announce(firstTry ? "The keypad plays a tiny All India Radio theme. The gate opens." : "Clock-room access granted."); }
    else { changeScene("bunker"); announce("The hatch exhales twenty-eight years of cold air."); }
  };
  const activateCommentary = () => { updateGame((current) => ({ ...current, flags: { ...current.flags, commentary: true } })); announce("Developer Commentary unlocked. Rajiv: This keypad was expensive, apparently."); };
  const solveCircuit = () => { updateGame((current) => ({ ...current, flags: { ...current.flags, bunkerPower: true } })); setModal(null); playTone(82, 0.8, 0.08); announce("Power restored. Generator: Fine. I suppose we're doing this."); };
  const resetToMenu = () => { clearOverlays(); setScreen("menu"); setEnding(null); };

  return (
    <main className={`app-shell scene-${game.scene} ${flashlight ? "flashlight-on" : ""}`}>
      <GameWorld sceneId={screen === "menu" ? "home" : game.scene} active={active} flashlightOn={flashlight} powerOn={game.flags.powerOn} gateOpen={game.scene === "wrong" ? game.flags.boardSolved : game.flags.gateOpen} bunkerPower={game.flags.bunkerPower} collectedIds={game.collected} onInteract={interaction} onPrompt={setPrompt} onNote={announce}/>
      <div className="grain"/><div className="vignette"/>

      <AnimatePresence>{screen === "menu" && (
        <motion.section className="menu-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="menu-topline"><span>A SURAJPUR STORY</span><span>REACT / THREE.JS EDITION</span></div>
          <motion.div className="title-lockup" initial={{ y: 28, opacity: 0, scale: 0.98 }} animate={{ y: 0, opacity: 1, scale: 1 }} transition={{ delay: 0.15, duration: 1.0, ease: "easeOut" }}><span className="title-kicker">THE</span><h1>13<span className="title-th">TH</span><br/>HOUR</h1><p>UPGRADED EDITION</p></motion.div>
          <motion.div className="menu-copy" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7, duration: 0.7, ease: "easeOut" }}><p>Your father vanished from a station that never existed.<br/>Tonight, its last train is running late.</p><div className="menu-actions"><button className="start-button" onClick={startNew}><span>NEW GAME</span><i>Board the 23:58 Mail Express</i></button>{hasSave && <button className="continue-button" onClick={continueGame}>CONTINUE FROM AUTOSAVE</button>}</div></motion.div>
          <div className="menu-footer"><span>WASD MOVE · MOUSE LOOK · E INTERACT</span><span>F FLASHLIGHT · I INVENTORY · J JOURNAL</span><span>HEADPHONES RECOMMENDED</span></div>
        </motion.section>
      )}</AnimatePresence>

      {(screen === "game" || screen === "epilogue") && <><header className="game-header"><div className="brand-small"><b>13</b><span>THE<br/>HOUR</span></div><div className="chapter-small"><span>{chapterData[game.scene].number}</span><strong>{chapterData[game.scene].title}</strong></div><div className="header-actions"><button onClick={() => setFlashlight((on) => !on)} className={flashlight ? "active" : ""} aria-label="Toggle flashlight"><Icon name="flashlight"/></button><button onClick={() => setSoundOn((on) => !on)} className={soundOn ? "active" : ""} aria-label="Toggle sound"><Icon name="sound"/></button><button onClick={() => setPaused(true)} aria-label="Pause"><Icon name="pause"/></button></div></header><aside className="objective-panel"><span>CURRENT OBJECTIVE</span><p>{objective}</p></aside><div className="hud-bottom"><button onClick={() => setInventoryOpen(true)}><Icon name="bag"/><span>INVENTORY</span><kbd>I</kbd></button><button onClick={() => setModal("journal")}><Icon name="journal"/><span>JOURNAL</span><kbd>J</kbd></button></div><div className="crosshair"><i/><i/></div><AnimatePresence>{prompt && active && <motion.div className="interaction-prompt" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}><kbd>E</kbd><span>{prompt}</span></motion.div>}</AnimatePresence></>}

      <AnimatePresence>{toast && (screen === "game" || screen === "epilogue") && <motion.div className="toast" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}><i/><p>{toast}</p></motion.div>}{chapterFlash && (screen === "game" || screen === "epilogue") && <motion.div className="chapter-flash" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><span>{chapterData[game.scene].number}</span><h2>{chapterData[game.scene].title}</h2></motion.div>}</AnimatePresence>

      <AnimatePresence>
        {(inventoryOpen && (screen === "game" || screen === "epilogue")) && <ModalShell onClose={() => setInventoryOpen(false)} width="wide" className="inventory-modal"><div className="inventory-heading"><span className="eyebrow">AARAV'S SATCHEL</span><h2>Inventory</h2><p>Everything you carry remembers where it came from.</p></div><div className="inventory-list">{game.inventory.length === 0 && <p className="empty-state">Nothing but a phone with no signal and several reasonable doubts.</p>}{game.inventory.map((item, index) => <div key={item}><span>{String(index + 1).padStart(2, "0")}</span><strong>{inventoryNames[item] ?? item}</strong><small>{item.startsWith("recording-") ? "MAGNETIC AUDIO / LOOP EVIDENCE" : "KEY ITEM"}</small></div>)}</div></ModalShell>}
        {modal === "diary" && <DocumentModal type="diary" onClose={() => setModal(null)} onAction={documentAction}/>} 
        {modal === "log" && <DocumentModal type="log" onClose={() => setModal(null)} onAction={documentAction}/>} 
        {modal === "register" && <DocumentModal type="register" onClose={() => setModal(null)} onAction={documentAction}/>} 
        {modal === "keypad-station" && <Keypad context="station" onClose={() => setModal(null)} onSuccess={(first) => unlockKeypad("station", first)} onCommentary={activateCommentary}/>} 
        {modal === "keypad-hatch" && <Keypad context="hatch" onClose={() => setModal(null)} onSuccess={(first) => unlockKeypad("hatch", first)} onCommentary={activateCommentary}/>} 
        {modal === "evidence" && <EvidenceBoard onClose={() => setModal(null)} onSolved={completeBoard}/>} 
        {modal === "circuit" && <CircuitPuzzle onClose={() => setModal(null)} onSolved={solveCircuit}/>} 
        {modal === "regulator" && <Regulator eligible={recordings === 5 && game.evidence.length >= 5} recordings={recordings} onClose={() => setModal(null)} onEnding={finish}/>} 
        {modal === "photo" && photoView && <PhotoModal view={photoView} onClose={() => setModal(null)}/>}
        {modal === "journal" && <ModalShell onClose={() => setModal(null)} width="wide" className="journal-modal"><div className="journal-heading"><span className="eyebrow">FIELD JOURNAL / 2026</span><h2>What the past left behind</h2></div><div className="journal-layout"><div><h3>Objective</h3><p>{objective}</p><h3>Known evidence</h3>{game.evidence.length ? game.evidence.map((item) => <p className="evidence-line" key={item}>+ {evidenceNames[item]}</p>) : <p className="muted">No evidence recorded.</p>}</div><div><h3>Timeline</h3><p><b>14 NOV 1998</b> Rajiv disappeared during an unscheduled arrival at 23:58.</p><p><b>14 NOV 2026</b> An unused ticket activated inside Rajiv's diary.</p><p><b>00:13 / UNKNOWN</b> The clocks disagree. The station does not.</p><h3>Accessibility</h3><p className="muted">Evidence uses labels and patterns in addition to color. Story mode hints are active.</p></div></div></ModalShell>}
      </AnimatePresence>

      <AnimatePresence>{paused && (screen === "game" || screen === "epilogue") && <motion.div className="pause-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><span className="eyebrow">THE HOUR IS WAITING</span><h2>Paused</h2><p>Your progress is saved automatically.</p><button className="primary-action" onClick={() => setPaused(false)}>Return to the platform</button><button className="text-button" onClick={resetToMenu}>Exit to title</button></motion.div>}</AnimatePresence>

      <AnimatePresence>
        {screen === "epilogue" && ending && !modal && !inventoryOpen && !paused && (
          <motion.section className="epilogue-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="epilogue-inner">
              <span className="eyebrow">{endings[ending].code}</span>
              <h2>{endings[ending].title}</h2>
              <p>Explore freely. Hold W to go forward, S backward, A left, D right. Click the scene to look around.</p>
            </div>
            <button type="button" className="primary-action" onClick={closeEpilogue} aria-keyshortcuts="N">End the story <kbd>N</kbd></button>
          </motion.section>
        )}
      </AnimatePresence>

      <AnimatePresence>{screen === "ending" && ending && <motion.section className={`ending-screen ending-${ending}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}><motion.div initial={{ y: 28, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.35, duration: 0.9, ease: "easeOut" }}><span className="eyebrow">{endings[ending].code}</span><h2>{endings[ending].title}</h2><small>{endings[ending].subtitle}</small><p>{endings[ending].body}</p><blockquote>{endings[ending].after}</blockquote><div><button className="primary-action" onClick={startNew}>Begin another loop</button><button className="text-button" onClick={resetToMenu}>Return to title</button></div></motion.div></motion.section>}</AnimatePresence>
    </main>
  );
}