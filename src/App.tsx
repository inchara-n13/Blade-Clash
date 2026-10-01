import { useCallback, useEffect, useRef, useState } from "react";
import { GameEngine, Mode } from "./game/engine";
import { SWORDS, getSword } from "./game/swords";
import { SwordCard } from "./components/SwordCard";
import { HighScore, isHighScore, loadHighScores, saveHighScore } from "./game/highscores";
import { sfx, setSoundEnabled, isSoundEnabled } from "./game/sound";

type Screen = "start" | "select" | "playing" | "tutorial";

interface HUD {
  p1hp: number;
  p1max: number;
  p2hp: number;
  p2max: number;
  score: number;
  wave: number;
  p1sword: string;
  p2sword: string;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("start");
  const [mode, setMode] = useState<Mode>("ai");
  const [p1Loadout, setP1Loadout] = useState<string[]>(["katana", "flameblade"]);
  const [p2Loadout, setP2Loadout] = useState<string[]>(["frostfang", "stormedge"]);
  const [difficulty, setDifficulty] = useState(2);
  const [selectingFor, setSelectingFor] = useState<1 | 2>(1);
  const [playerWon, setPlayerWon] = useState(false);
  const [paused, setPaused] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [duelMsg, setDuelMsg] = useState("");
  const [hud, setHud] = useState<HUD>({ p1hp: 100, p1max: 100, p2hp: 100, p2max: 100, score: 0, wave: 1, p1sword: "katana", p2sword: "flameblade" });
  const [highScores, setHighScores] = useState<HighScore[]>([]);
  const [newHigh, setNewHigh] = useState(false);
  const [soundOn, setSoundOn] = useState(isSoundEnabled());

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHighScores(loadHighScores());
  }, []);

  // keyboard
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const eng = engineRef.current;
      if (!eng) return;
      const k = e.key.toLowerCase();
      if (k === "p" || k === "escape") {
        if (screen === "playing" && !gameOver) togglePause();
        return;
      }
      // P1: A/D move, W jump, S duck, F/Space attack, Q swap
      if (k === "a") eng.input1.left = true;
      if (k === "d") eng.input1.right = true;
      if (k === "w") eng.input1.jump = true;
      if (k === "s") eng.input1.duck = true;
      if (k === "q") eng.input1.swap = true;
      if (k === "f" || k === " ") {
        e.preventDefault();
        eng.input1.attack = true;
      }
      // P2 (duel): arrows + Enter attack, / duck, . swap
      if (mode === "duel") {
        if (k === "arrowleft") eng.input2.left = true;
        if (k === "arrowright") eng.input2.right = true;
        if (k === "arrowup") eng.input2.jump = true;
        if (k === "arrowdown") eng.input2.duck = true;
        if (k === "/") eng.input2.swap = true;
        if (k === "enter" || k === "shift") {
          e.preventDefault();
          eng.input2.attack = true;
        }
      }
    };
    const up = (e: KeyboardEvent) => {
      const eng = engineRef.current;
      if (!eng) return;
      const k = e.key.toLowerCase();
      if (k === "a") eng.input1.left = false;
      if (k === "d") eng.input1.right = false;
      if (k === "w") eng.input1.jump = false;
      if (k === "s") eng.input1.duck = false;
      if (k === "q") eng.input1.swap = false;
      if (k === "f" || k === " ") eng.input1.attack = false;
      if (mode === "duel") {
        if (k === "arrowleft") eng.input2.left = false;
        if (k === "arrowright") eng.input2.right = false;
        if (k === "arrowup") eng.input2.jump = false;
        if (k === "arrowdown") eng.input2.duck = false;
        if (k === "/") eng.input2.swap = false;
        if (k === "enter" || k === "shift") eng.input2.attack = false;
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [mode, screen, gameOver]);

  // resize
  useEffect(() => {
    const onResize = () => engineRef.current?.resize();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  const finishGame = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;
    setGameOver(true);
    setDuelMsg(eng.duelWinner);
    setPlayerWon(eng.playerWon);
    if (eng.mode === "ai") {
      if (eng.playerWon) {
        sfx.win();
        const sc = eng.score;
        if (isHighScore(sc)) {
          setNewHigh(true);
          const list = saveHighScore({
            score: sc,
            wave: eng.difficulty,
            sword: getSword(p1Loadout[0]).name,
            date: new Date().toLocaleDateString(),
          });
          setHighScores(list);
        } else {
          setNewHigh(false);
          setHighScores(loadHighScores());
        }
      } else {
        sfx.ko();
        setNewHigh(false);
        setHighScores(loadHighScores());
      }
    } else {
      sfx.win();
    }
  }, [p1Loadout]);

  const startGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    engineRef.current?.stop();
    // In VS Robot mode, the bot gets a random loadout (2 swords on hard)
    let botLoadout = p2Loadout;
    if (mode === "ai") {
      const pool = SWORDS.map((s) => s.id).sort(() => Math.random() - 0.5);
      botLoadout = difficulty >= 3 ? [pool[0], pool[1]] : [pool[0]];
    }
    const eng = new GameEngine(canvas, mode, p1Loadout, botLoadout, difficulty);
    eng.onUpdate = () => {
      setHud({
        p1hp: eng.p1.hp,
        p1max: eng.p1.maxHp,
        p2hp: eng.p2.hp,
        p2max: eng.p2.maxHp,
        score: eng.score,
        wave: eng.wave,
        p1sword: eng.p1.sword.id,
        p2sword: eng.p2.sword.id,
      });
    };
    eng.onHit = (heavy) => sfx.hit(heavy);
    eng.onSwing = () => sfx.swing();
    eng.onGameOver = finishGame;
    engineRef.current = eng;
    setGameOver(false);
    setPaused(false);
    setNewHigh(false);
    setDuelMsg("");
    setScreen("playing");
    // start after layout — wait for canvas to become visible
    setTimeout(() => {
      requestAnimationFrame(() => {
        eng.resize();
        eng.start();
      });
    }, 30);
  }, [mode, p1Loadout, p2Loadout, difficulty, finishGame]);

  const togglePause = useCallback(() => {
    const eng = engineRef.current;
    if (!eng || gameOver) return;
    setPaused((p) => {
      const np = !p;
      eng.setPaused(np);
      sfx.ui();
      return np;
    });
  }, [gameOver]);

  const restart = useCallback(() => {
    sfx.select();
    startGame();
  }, [startGame]);

  const quitToMenu = useCallback(() => {
    engineRef.current?.stop();
    engineRef.current = null;
    setScreen("start");
    setPaused(false);
    setGameOver(false);
    setHighScores(loadHighScores());
    sfx.ui();
  }, []);

  const toggleSound = () => {
    const nv = !soundOn;
    setSoundOn(nv);
    setSoundEnabled(nv);
    if (nv) sfx.ui();
  };

  // Touch controls
  const press = (btn: "left" | "right" | "jump" | "attack" | "duck" | "swap", val: boolean, player: 1 | 2 = 1) => {
    const eng = engineRef.current;
    if (!eng) return;
    const input = player === 1 ? eng.input1 : eng.input2;
    input[btn] = val;
  };

  return (
    <div ref={wrapRef} className="relative flex h-full w-full flex-col overflow-hidden bg-[#0a0a14]">
      {/* Canvas always mounted so ref exists */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        style={{ display: screen === "playing" ? "block" : "none" }}
      />

      {screen === "start" && (
        <StartScreen
          onPlay={() => { sfx.select(); setScreen("select"); }}
          onTutorial={() => { sfx.ui(); setScreen("tutorial"); }}
          highScores={highScores}
          soundOn={soundOn}
          toggleSound={toggleSound}
        />
      )}

      {screen === "tutorial" && (
        <TutorialScreen
          onDone={() => { sfx.select(); setScreen("select"); }}
          onBack={() => { sfx.ui(); setScreen("start"); }}
        />
      )}

      {screen === "select" && (
        <SelectScreen
          mode={mode}
          setMode={setMode}
          p1Loadout={p1Loadout}
          setP1Loadout={setP1Loadout}
          p2Loadout={p2Loadout}
          setP2Loadout={setP2Loadout}
          difficulty={difficulty}
          setDifficulty={setDifficulty}
          selectingFor={selectingFor}
          setSelectingFor={setSelectingFor}
          onStart={() => { sfx.select(); startGame(); }}
          onTutorial={() => { sfx.ui(); setScreen("tutorial"); }}
          onBack={() => { sfx.ui(); setScreen("start"); }}
        />
      )}

      {screen === "playing" && (
        <PlayingOverlay
          hud={hud}
          mode={mode}
          p1Loadout={p1Loadout}
          p2Loadout={p2Loadout}
          paused={paused}
          gameOver={gameOver}
          duelMsg={duelMsg}
          playerWon={playerWon}
          difficulty={difficulty}
          newHigh={newHigh}
          highScores={highScores}
          onPause={togglePause}
          onRestart={restart}
          onQuit={quitToMenu}
          onResume={togglePause}
          press={press}
          soundOn={soundOn}
          toggleSound={toggleSound}
        />
      )}
    </div>
  );
}

/* ---------------- Start Screen ---------------- */
function StartScreen({
  onPlay,
  onTutorial,
  highScores,
  soundOn,
  toggleSound,
}: {
  onPlay: () => void;
  onTutorial: () => void;
  highScores: HighScore[];
  soundOn: boolean;
  toggleSound: () => void;
}) {
  return (
    <div className="relative z-10 flex h-full w-full flex-col items-center justify-center overflow-y-auto bg-gradient-to-b from-[#1a1030] via-[#2a1a4a] to-[#0f0a1e] px-6 py-10 text-center">
      <div className="pointer-events-none absolute inset-0 opacity-40" style={{ background: "radial-gradient(circle at 50% 30%, rgba(167,139,250,0.3), transparent 60%)" }} />
      <button
        onClick={toggleSound}
        className="absolute right-4 top-4 z-20 rounded-full bg-white/10 px-3 py-2 text-lg backdrop-blur hover:bg-white/20"
      >
        {soundOn ? "🔊" : "🔇"}
      </button>

      <div className="relative z-10 flex flex-col items-center">
        <div className="mb-3 flex items-center gap-3 text-5xl sm:text-6xl">
          <span className="pulse-glow" style={{ color: "#a5b4fc" }}>⚔️</span>
        </div>
        <h1
          className="title-shimmer bg-clip-text text-5xl font-black tracking-tighter text-transparent sm:text-7xl"
          style={{ backgroundImage: "linear-gradient(90deg,#a5b4fc,#f0abfc,#fde047,#a5b4fc)" }}
        >
          BLADE CLASH
        </h1>
        <p className="mt-2 text-sm font-semibold uppercase tracking-[0.3em] text-violet-300/80">Sword Fighting Arena</p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <button
            onClick={onPlay}
            className="group rounded-2xl border-2 border-violet-400/60 bg-gradient-to-r from-violet-600 to-fuchsia-600 px-12 py-4 text-2xl font-black tracking-wide text-white shadow-[0_0_30px_rgba(167,139,250,0.6)] transition-all hover:scale-105 active:scale-95"
          >
            ▶ PLAY
          </button>
          <button
            onClick={onTutorial}
            className="rounded-2xl border-2 border-cyan-400/50 bg-cyan-500/10 px-8 py-4 text-lg font-black tracking-wide text-cyan-200 transition-all hover:scale-105 hover:bg-cyan-500/20 active:scale-95"
          >
            🎓 TUTORIAL
          </button>
        </div>

        <div className="mt-8 max-w-md rounded-xl border border-white/10 bg-black/30 p-4 text-left text-xs text-slate-300 backdrop-blur">
          <p className="mb-2 font-bold uppercase tracking-wide text-violet-300">Controls</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <span>🏃 Move: <b className="text-white">A / D</b></span>
            <span>🦘 Jump: <b className="text-white">W</b></span>
            <span>🛡️ Duck/Dodge: <b className="text-white">S</b></span>
            <span>⚔️ Attack: <b className="text-white">F / Space</b></span>
            <span>🔄 Swap sword: <b className="text-white">Q</b></span>
            <span>💥 Air strike: <b className="text-white">Jump + Attack</b></span>
            <span>⏸️ Pause: <b className="text-white">P / Esc</b></span>
          </div>
          <p className="mt-2 text-slate-400">On mobile, use the on-screen buttons. Beat waves of bots, pick swords with unique powers!</p>
        </div>

        {highScores.length > 0 && (
          <div className="mt-6 w-full max-w-md rounded-xl border border-yellow-400/20 bg-black/30 p-4 backdrop-blur">
            <p className="mb-2 flex items-center justify-center gap-2 font-black uppercase tracking-widest text-yellow-300">
              🏆 High Scores
            </p>
            <div className="space-y-1">
              {highScores.slice(0, 5).map((h, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-1.5 text-sm">
                  <span className="font-bold text-slate-400">#{i + 1}</span>
                  <span className="text-white">{h.sword} · {["Easy", "Normal", "Hard"][h.wave - 1] ?? "Normal"}</span>
                  <span className="font-black text-yellow-300">{h.score}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Select Screen ---------------- */
const MAX_LOADOUT = 2;
function SelectScreen({
  mode,
  setMode,
  p1Loadout,
  setP1Loadout,
  p2Loadout,
  setP2Loadout,
  difficulty,
  setDifficulty,
  selectingFor,
  setSelectingFor,
  onStart,
  onTutorial,
  onBack,
}: {
  mode: Mode;
  setMode: (m: Mode) => void;
  p1Loadout: string[];
  setP1Loadout: (s: string[]) => void;
  p2Loadout: string[];
  setP2Loadout: (s: string[]) => void;
  difficulty: number;
  setDifficulty: (n: number) => void;
  selectingFor: 1 | 2;
  setSelectingFor: (n: 1 | 2) => void;
  onStart: () => void;
  onTutorial: () => void;
  onBack: () => void;
}) {
  // In VS Robot mode you always edit your own (P1) loadout — the robot picks its own blade.
  const editing = mode === "ai" ? 1 : selectingFor;
  const loadout = editing === 1 ? p1Loadout : p2Loadout;
  const setLoadout = editing === 1 ? setP1Loadout : setP2Loadout;
  const accent = editing === 1 ? "#60a5fa" : "#f87171";

  const toggleSword = (id: string) => {
    if (loadout.includes(id)) {
      if (loadout.length === 1) return; // keep at least one
      sfx.ui();
      setLoadout(loadout.filter((s) => s !== id));
    } else {
      sfx.select();
      if (loadout.length >= MAX_LOADOUT) {
        // replace the first (oldest) slot
        setLoadout([loadout[1], id]);
      } else {
        setLoadout([...loadout, id]);
      }
    }
  };

  return (
    <div className="relative z-10 flex h-full w-full flex-col overflow-y-auto bg-gradient-to-b from-[#1a1030] to-[#0f0a1e] px-4 py-5">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-4 flex items-center justify-between">
          <button onClick={onBack} className="rounded-lg bg-white/10 px-3 py-2 text-sm font-bold text-white hover:bg-white/20">
            ← Back
          </button>
          <h2 className="text-lg font-black tracking-wide text-white sm:text-2xl">BUILD YOUR LOADOUT</h2>
          <button onClick={onTutorial} className="rounded-lg bg-cyan-500/20 px-3 py-2 text-sm font-bold text-cyan-200 hover:bg-cyan-500/30">
            🎓
          </button>
        </div>

        {/* Mode toggle */}
        <div className="mb-3 flex justify-center gap-2">
          <ModeBtn active={mode === "ai"} onClick={() => { sfx.ui(); setMode("ai"); setSelectingFor(1); }} label="🤖 VS Robot" />
          <ModeBtn active={mode === "duel"} onClick={() => { sfx.ui(); setMode("duel"); }} label="👥 2P Duel" />
        </div>

        {/* Difficulty (AI only) */}
        {mode === "ai" && (
          <div className="mb-3 flex flex-col items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Robot Difficulty</span>
            <div className="flex gap-2">
              {[
                { v: 1, label: "😌 Easy", c: "#4ade80" },
                { v: 2, label: "😤 Normal", c: "#facc15" },
                { v: 3, label: "💀 Hard", c: "#f87171" },
              ].map((d) => (
                <button
                  key={d.v}
                  onClick={() => { sfx.ui(); setDifficulty(d.v); }}
                  className={`rounded-lg px-4 py-1.5 text-sm font-black tracking-wide transition-all ${
                    difficulty === d.v ? "scale-105 text-black" : "bg-white/10 text-slate-300 hover:bg-white/20"
                  }`}
                  style={difficulty === d.v ? { background: d.c, boxShadow: `0 0 14px ${d.c}88` } : undefined}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Player tabs (duel only) */}
        {mode === "duel" && (
          <div className="mb-3 flex justify-center gap-2">
            <PlayerTab active={selectingFor === 1} color="#60a5fa" onClick={() => setSelectingFor(1)} label="Player 1" sub={p1Loadout.map((s) => getSword(s).emoji).join(" ")} />
            <PlayerTab active={selectingFor === 2} color="#f87171" onClick={() => setSelectingFor(2)} label="Player 2" sub={p2Loadout.map((s) => getSword(s).emoji).join(" ")} />
          </div>
        )}

        <p className="mb-3 text-center text-xs text-slate-400">
          {mode === "ai" ? "Pick your loadout — the robot chooses its own blade. " : ""}
          Pick up to <b className="text-white">2 swords</b> — swap between them mid-fight!{" "}
          <span className="text-cyan-300">({loadout.length}/{MAX_LOADOUT} selected)</span>
        </p>

        {/* Current loadout preview */}
        <div className="mb-3 flex justify-center gap-2">
          {loadout.map((id, i) => {
            const sw = getSword(id);
            return (
              <div
                key={id}
                className="flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-sm font-bold"
                style={{ borderColor: sw.glow, background: `${sw.glow}22`, color: sw.glow }}
              >
                <span>{i === 0 ? "①" : "②"}</span>
                <span>{sw.emoji}</span>
                <span>{sw.name}</span>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {SWORDS.map((s) => (
            <SwordCard key={s.id} sword={s} selected={loadout.includes(s.id)} onClick={() => toggleSword(s.id)} accent={accent} />
          ))}
        </div>

        <div className="sticky bottom-0 mt-5 bg-gradient-to-t from-[#0f0a1e] to-transparent pb-2 pt-3">
          <button
            onClick={onStart}
            className="w-full rounded-2xl border-2 border-emerald-400/60 bg-gradient-to-r from-emerald-600 to-teal-600 py-4 text-2xl font-black tracking-wide text-white shadow-[0_0_25px_rgba(52,211,153,0.5)] transition-all hover:scale-[1.02] active:scale-95"
          >
            ⚔️ FIGHT!
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Tutorial Screen ---------------- */
const TUTORIAL_STEPS = [
  { icon: "🏃", title: "Move Around", desc: "Use A / D (or ◀ ▶ on touch) to walk across the arena. Position yourself just within blade range.", keys: "A / D" },
  { icon: "🦘", title: "Jump", desc: "Press W (or ⤴) to leap over your enemy or dodge low sweeps. You can also change positions quickly.", keys: "W" },
  { icon: "⚔️", title: "Attack", desc: "Press F / Space (or ⚔️) to swing your blade. Time it so the enemy is in reach. Random CRITs deal bonus damage!", keys: "F / Space" },
  { icon: "🛡️", title: "Duck & Dodge", desc: "Hold S (or 🛡️) to crouch. Ducking DODGES standing swings entirely — but watch out for air strikes!", keys: "S" },
  { icon: "💥", title: "Air Strike", desc: "Jump, then Attack in mid-air to slam DOWN with 50% bonus damage. It even hits ducking foes and shakes the ground!", keys: "W → F" },
  { icon: "🔄", title: "Swap Swords", desc: "Carry 2 blades and press Q (or 🔄) to switch between them mid-fight. Combine effects — freeze, then burn!", keys: "Q" },
  { icon: "🩸", title: "Sword Effects", desc: "🔥 Burn · ❄️ Slow · ⚡ Stun · 🩸 Lifesteal · 🪓 Heavy knockback · 🗡️ Fast. Build a loadout that fits your style!", keys: "" },
];

function TutorialScreen({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const [step, setStep] = useState(0);
  const s = TUTORIAL_STEPS[step];
  const last = step === TUTORIAL_STEPS.length - 1;
  return (
    <div className="relative z-10 flex h-full w-full flex-col items-center justify-center overflow-y-auto bg-gradient-to-b from-[#102030] via-[#12283a] to-[#0a0a14] px-6 py-10">
      <div className="pointer-events-none absolute inset-0 opacity-40" style={{ background: "radial-gradient(circle at 50% 35%, rgba(56,189,248,0.25), transparent 60%)" }} />
      <div className="relative z-10 flex w-full max-w-md flex-col items-center">
        <div className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.25em] text-cyan-300">🎓 Tutorial</div>
        <div className="flex w-full flex-col items-center rounded-2xl border border-cyan-400/25 bg-black/40 p-7 text-center backdrop-blur">
          <div className="mb-3 text-6xl" style={{ filter: "drop-shadow(0 0 14px #38bdf8)" }}>{s.icon}</div>
          <h2 className="text-2xl font-black text-white">{s.title}</h2>
          {s.keys && (
            <div className="mt-2 rounded-full bg-cyan-500/20 px-4 py-1 text-sm font-black tracking-wider text-cyan-200">
              {s.keys}
            </div>
          )}
          <p className="mt-4 text-sm leading-relaxed text-slate-300">{s.desc}</p>
        </div>

        {/* progress dots */}
        <div className="mt-5 flex gap-2">
          {TUTORIAL_STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => { sfx.ui(); setStep(i); }}
              className="h-2.5 rounded-full transition-all"
              style={{
                width: i === step ? 24 : 10,
                background: i === step ? "#38bdf8" : "rgba(255,255,255,0.2)",
              }}
            />
          ))}
        </div>

        <div className="mt-6 flex w-full gap-3">
          <button
            onClick={() => { sfx.ui(); step === 0 ? onBack() : setStep(step - 1); }}
            className="flex-1 rounded-xl bg-white/10 py-3 font-black text-white hover:bg-white/20 active:scale-95"
          >
            {step === 0 ? "🏠 Menu" : "← Back"}
          </button>
          <button
            onClick={() => { sfx.select(); last ? onDone() : setStep(step + 1); }}
            className="flex-1 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 py-3 font-black text-white shadow-[0_0_18px_rgba(56,189,248,0.5)] hover:scale-105 active:scale-95"
          >
            {last ? "⚔️ Start Fighting!" : "Next →"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModeBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl px-5 py-2.5 text-sm font-black tracking-wide transition-all ${
        active ? "scale-105 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-[0_0_18px_rgba(167,139,250,0.5)]" : "bg-white/10 text-slate-300 hover:bg-white/20"
      }`}
    >
      {label}
    </button>
  );
}

function PlayerTab({ active, color, onClick, label, sub }: { active: boolean; color: string; onClick: () => void; label: string; sub: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center rounded-xl border-2 px-6 py-2 transition-all ${active ? "scale-105" : "border-white/10 bg-white/5"}`}
      style={active ? { borderColor: color, background: `${color}22` } : undefined}
    >
      <span className="text-sm font-black" style={{ color: active ? color : "#fff" }}>{label}</span>
      <span className="text-[10px] text-slate-400">{sub}</span>
    </button>
  );
}

/* ---------------- Playing Overlay ---------------- */
function PlayingOverlay({
  hud,
  mode,
  p1Loadout,
  p2Loadout,
  paused,
  gameOver,
  duelMsg,
  playerWon,
  difficulty,
  newHigh,
  highScores,
  onPause,
  onRestart,
  onQuit,
  onResume,
  press,
  soundOn,
  toggleSound,
}: {
  hud: HUD;
  mode: Mode;
  p1Loadout: string[];
  p2Loadout: string[];
  paused: boolean;
  gameOver: boolean;
  duelMsg: string;
  playerWon: boolean;
  difficulty: number;
  newHigh: boolean;
  highScores: HighScore[];
  onPause: () => void;
  onRestart: () => void;
  onQuit: () => void;
  onResume: () => void;
  press: (b: "left" | "right" | "jump" | "attack" | "duck" | "swap", v: boolean, p?: 1 | 2) => void;
  soundOn: boolean;
  toggleSound: () => void;
}) {
  const s1 = getSword(hud.p1sword);
  const s2 = getSword(hud.p2sword);
  const p1HasSwap = p1Loadout.length > 1;
  const p2HasSwap = p2Loadout.length > 1;
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col">
      {/* Top HUD */}
      <div className="flex items-start justify-between gap-2 p-3">
        <HealthBar name={mode === "ai" ? "YOU" : "P1"} sword={s1} hp={hud.p1hp} max={hud.p1max} color="#60a5fa" align="left" />

        <div className="flex flex-col items-center gap-1">
          {mode === "ai" ? (
            <>
              <div className="rounded-lg bg-black/50 px-3 py-1 text-lg font-black text-white backdrop-blur">VS 🤖</div>
              <div className="rounded-full bg-yellow-500/20 px-3 py-0.5 text-[10px] font-black text-yellow-300">
                {["EASY", "NORMAL", "HARD"][difficulty - 1]}
              </div>
            </>
          ) : (
            <div className="rounded-lg bg-black/50 px-3 py-1 text-lg font-black text-white backdrop-blur">VS</div>
          )}
        </div>

        <HealthBar name={mode === "ai" ? "BOT" : "P2"} sword={s2} hp={hud.p2hp} max={hud.p2max} color="#f87171" align="right" />
      </div>

      {/* Pause button */}
      {!gameOver && (
        <button
          onClick={onPause}
          className="pointer-events-auto absolute left-1/2 top-16 -translate-x-1/2 rounded-full bg-black/50 px-4 py-1.5 text-xs font-bold text-white backdrop-blur hover:bg-black/70 sm:top-3"
        >
          ⏸ PAUSE
        </button>
      )}

      {/* Touch controls */}
      {!gameOver && !paused && (
        <TouchControls mode={mode} press={press} p1HasSwap={p1HasSwap} p2HasSwap={p2HasSwap} />
      )}

      {/* Intro control hint (auto-fades) */}
      {!gameOver && (
        <div
          className="pointer-events-none absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-black/60 px-5 py-3 text-center text-sm font-bold text-white backdrop-blur"
          style={{ animation: "hintFade 3.5s ease-out forwards" }}
        >
          {mode === "duel" ? (
            <div className="text-cyan-300">👥 2P Duel — first fighter to fall loses!</div>
          ) : (
            <div className="text-cyan-300">
              ⚔️ Attack · 🛡️ Duck to dodge · 💥 Jump+Attack = Air Strike{p1HasSwap ? " · 🔄 Swap" : ""}
            </div>
          )}
        </div>
      )}

      {/* Pause modal */}
      {paused && !gameOver && (
        <Modal>
          <h2 className="text-4xl font-black text-white">PAUSED</h2>
          <div className="mt-6 flex flex-col gap-3">
            <MenuButton onClick={onResume} primary>▶ Resume</MenuButton>
            <MenuButton onClick={onRestart}>🔄 Restart</MenuButton>
            <MenuButton onClick={toggleSound}>{soundOn ? "🔊 Sound: On" : "🔇 Sound: Off"}</MenuButton>
            <MenuButton onClick={onQuit}>🏠 Main Menu</MenuButton>
          </div>
        </Modal>
      )}

      {/* Game over modal */}
      {gameOver && (
        <Modal>
          {mode === "ai" ? (
            <>
              {playerWon ? (
                <h2 className="animate-pulse text-5xl font-black text-emerald-400" style={{ textShadow: "0 0 20px rgba(52,211,153,0.7)" }}>
                  🏆 VICTORY!
                </h2>
              ) : (
                <h2 className="text-5xl font-black text-red-400" style={{ textShadow: "0 0 20px rgba(248,113,113,0.6)" }}>
                  ☠️ DEFEATED
                </h2>
              )}
              <p className="mt-1 text-sm font-bold text-slate-300">
                {playerWon ? `You beat the ${["Easy", "Normal", "Hard"][difficulty - 1]} robot!` : "The robot got you this time."}
              </p>
              {newHigh && playerWon && <p className="mt-1 animate-pulse text-lg font-black text-yellow-300">⭐ NEW HIGH SCORE!</p>}
              <div className="mt-4 flex gap-8">
                <div className="text-center">
                  <div className="text-[10px] uppercase tracking-widest text-slate-400">Score</div>
                  <div className="text-3xl font-black text-white">{hud.score}</div>
                </div>
                <div className="text-center">
                  <div className="text-[10px] uppercase tracking-widest text-slate-400">HP Left</div>
                  <div className="text-3xl font-black text-white">{Math.max(0, Math.round(hud.p1hp))}</div>
                </div>
              </div>
              {highScores.length > 0 && (
                <div className="mt-4 w-full max-w-xs rounded-lg bg-black/40 p-2 text-xs">
                  {highScores.slice(0, 4).map((h, i) => (
                    <div key={i} className="flex justify-between px-2 py-0.5 text-slate-300">
                      <span>#{i + 1} {h.sword}</span>
                      <span className="font-bold text-yellow-300">{h.score}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <h2 className="text-4xl font-black" style={{ color: duelMsg.includes("P1") ? "#60a5fa" : "#f87171" }}>
              {duelMsg || "FIGHT OVER"}
            </h2>
          )}
          <div className="mt-6 flex flex-col gap-3">
            <MenuButton onClick={onRestart} primary>🔄 Play Again</MenuButton>
            <MenuButton onClick={onQuit}>🏠 Main Menu</MenuButton>
          </div>
        </Modal>
      )}
    </div>
  );
}

function HealthBar({ name, sword, hp, max, color, align }: { name: string; sword: ReturnType<typeof getSword>; hp: number; max: number; color: string; align: "left" | "right" }) {
  const pct = Math.max(0, (hp / max) * 100);
  return (
    <div className={`flex w-[38%] max-w-[280px] flex-col ${align === "right" ? "items-end" : "items-start"}`}>
      <div className={`mb-1 flex items-center gap-1.5 ${align === "right" ? "flex-row-reverse" : ""}`}>
        <span className="text-lg" style={{ filter: `drop-shadow(0 0 4px ${sword.glow})` }}>{sword.emoji}</span>
        <span className="text-xs font-black tracking-wide text-white">{name}</span>
        <span className="hidden text-[10px] text-slate-400 sm:inline">{sword.name}</span>
      </div>
      <div className="h-4 w-full overflow-hidden rounded-full border border-white/20 bg-black/50">
        <div
          className="h-full rounded-full transition-all duration-200"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${color}, ${color}cc)`,
            boxShadow: `0 0 10px ${color}`,
            marginLeft: align === "right" ? "auto" : 0,
          }}
        />
      </div>
    </div>
  );
}

type BtnKey = "left" | "right" | "jump" | "attack" | "duck" | "swap";
type PressFn = (b: BtnKey, v: boolean, p?: 1 | 2) => void;

function TouchControls({
  mode,
  press,
  p1HasSwap,
  p2HasSwap,
}: {
  mode: Mode;
  press: PressFn;
  p1HasSwap: boolean;
  p2HasSwap: boolean;
}) {
  // ---- 2P DUEL: one full control pad per player, so touch multiplayer actually works ----
  if (mode === "duel") {
    return (
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex select-none items-end justify-between gap-1 p-2 pb-3">
        <FighterPad player={1} press={press} hasSwap={p1HasSwap} tint="#60a5fa" />
        <div className="pointer-events-none hidden pb-1 text-center text-[9px] font-bold leading-tight text-slate-500 sm:block">
          ⌨️ P1: A D W S F
          <br />
          ⌨️ P2: ← → ↑ ↓ Enter
        </div>
        <FighterPad player={2} press={press} hasSwap={p2HasSwap} tint="#f87171" />
      </div>
    );
  }

  // ---- SOLO: all movement (move + jump + duck) grouped in the LEFT corner ----
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex select-none items-end justify-between p-4 pb-6">
      {/* LEFT CORNER — movement pad */}
      <div className="pointer-events-auto flex flex-col items-center gap-1.5">
        <TouchBtn btn="jump" player={1} press={press} label="⤴" tint="#60a5fa" size="md" />
        <div className="flex items-center gap-1.5">
          <TouchBtn btn="left" player={1} press={press} label="◀" tint="#60a5fa" size="md" />
          <TouchBtn btn="duck" player={1} press={press} label="🛡️" tint="#60a5fa" size="sm" />
          <TouchBtn btn="right" player={1} press={press} label="▶" tint="#60a5fa" size="md" />
        </div>
      </div>

      {/* RIGHT CORNER — combat */}
      <div className="pointer-events-auto flex flex-col items-end gap-1.5">
        {p1HasSwap && (
          <TouchBtn btn="swap" player={1} press={press} label="🔄" tint="#f0abfc" size="sm" />
        )}
        <TouchBtn btn="attack" player={1} press={press} label="⚔️" tint="#f87171" size="big" />
      </div>
    </div>
  );
}

/* Compact per-player pad used in 2P duel so both players have full touch controls */
function FighterPad({
  player,
  press,
  hasSwap,
  tint,
}: {
  player: 1 | 2;
  press: PressFn;
  hasSwap: boolean;
  tint: string;
}) {
  return (
    <div className="pointer-events-auto flex flex-col items-center gap-1">
      <div className="flex items-end gap-1">
        <TouchBtn btn="attack" player={player} press={press} label="⚔️" tint={tint} size="md" />
        {/* Swap only shown when there's room, so the two pads never overlap on small phones */}
        {hasSwap && (
          <span className="hidden min-[560px]:block">
            <TouchBtn btn="swap" player={player} press={press} label="🔄" tint={tint} size="xs" />
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        <TouchBtn btn="left" player={player} press={press} label="◀" tint={tint} size="sm" />
        <TouchBtn btn="jump" player={player} press={press} label="⤴" tint={tint} size="sm" />
        <span className="hidden min-[430px]:block">
          <TouchBtn btn="duck" player={player} press={press} label="🛡️" tint={tint} size="xs" />
        </span>
        <TouchBtn btn="right" player={player} press={press} label="▶" tint={tint} size="sm" />
      </div>
      <span className="text-[9px] font-black tracking-[0.2em]" style={{ color: tint }}>
        P{player}
      </span>
    </div>
  );
}

function TouchBtn({
  btn,
  player,
  press,
  label,
  tint,
  size = "md",
  className = "",
}: {
  btn: BtnKey;
  player: 1 | 2;
  press: PressFn;
  label: string;
  tint: string;
  size?: "xs" | "sm" | "md" | "big";
  className?: string;
}) {
  const dims = {
    xs: "h-10 w-10 text-sm",
    sm: "h-[3.1rem] w-[3.1rem] text-base",
    md: "h-14 w-14 text-xl",
    big: "h-[4.75rem] w-[4.75rem] text-3xl",
  }[size];
  return (
    <button
      className={`${dims} ${className} flex items-center justify-center rounded-full border-2 font-black text-white backdrop-blur-sm transition-transform duration-75 active:scale-90`}
      onPointerDown={(e) => { e.preventDefault(); press(btn, true, player); }}
      onPointerUp={(e) => { e.preventDefault(); press(btn, false, player); }}
      onPointerLeave={() => press(btn, false, player)}
      onPointerCancel={() => press(btn, false, player)}
      style={{
        touchAction: "none",
        borderColor: `${tint}66`,
        background: `${tint}1f`,
        boxShadow: `0 0 14px ${tint}33`,
      }}
    >
      {label}
    </button>
  );
}

function Modal({ children }: { children: React.ReactNode }) {
  return (
    <div className="pointer-events-auto absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="flex flex-col items-center rounded-2xl border border-white/10 bg-gradient-to-b from-[#251a40] to-[#140e26] p-8 shadow-2xl">
        {children}
      </div>
    </div>
  );
}

function MenuButton({ children, onClick, primary }: { children: React.ReactNode; onClick: () => void; primary?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`min-w-[220px] rounded-xl px-6 py-3 text-lg font-black tracking-wide transition-all active:scale-95 ${
        primary
          ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-[0_0_20px_rgba(52,211,153,0.5)] hover:scale-105"
          : "bg-white/10 text-white hover:bg-white/20"
      }`}
    >
      {children}
    </button>
  );
}
