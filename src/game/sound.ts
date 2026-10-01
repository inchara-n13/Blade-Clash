let ctx: AudioContext | null = null;
let enabled = true;

function ac(): AudioContext | null {
  if (!enabled) return null;
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

export function setSoundEnabled(v: boolean) {
  enabled = v;
}
export function isSoundEnabled() {
  return enabled;
}

function tone(freq: number, dur: number, type: OscillatorType, vol = 0.2, slideTo?: number) {
  const a = ac();
  if (!a) return;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, a.currentTime);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), a.currentTime + dur);
  gain.gain.setValueAtTime(vol, a.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
  osc.connect(gain);
  gain.connect(a.destination);
  osc.start();
  osc.stop(a.currentTime + dur);
}

function noise(dur: number, vol = 0.3, hp = 800) {
  const a = ac();
  if (!a) return;
  const buffer = a.createBuffer(1, a.sampleRate * dur, a.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  src.buffer = buffer;
  const filter = a.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = hp;
  const gain = a.createGain();
  gain.gain.setValueAtTime(vol, a.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(a.destination);
  src.start();
  src.stop(a.currentTime + dur);
}

// A short burst of band-passed noise that "rings" — the metallic resonance of a struck blade.
function metalRing(freq: number, dur: number, vol: number, q = 18, delay = 0) {
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime + delay;
  const len = Math.max(0.02, dur);
  const buffer = a.createBuffer(1, Math.ceil(a.sampleRate * len), a.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  src.buffer = buffer;
  const bp = a.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.setValueAtTime(freq, t0);
  bp.frequency.exponentialRampToValueAtTime(Math.max(120, freq * 0.7), t0 + dur);
  bp.Q.value = q;
  const gain = a.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.004); // sharp attack
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); // long metallic decay
  src.connect(bp);
  bp.connect(gain);
  gain.connect(a.destination);
  src.start(t0);
  src.stop(t0 + len);
}

// A pure sustained partial — used with metalRing to build inharmonic "shing".
function ringTone(freq: number, dur: number, vol: number, delay = 0) {
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime + delay;
  const osc = a.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(freq, t0);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.92, t0 + dur);
  const gain = a.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain);
  gain.connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur);
}

export const sfx = {
  swing() {
    // A quick airy "whoosh" of the blade cutting the air.
    noise(0.16, 0.09, 2200);
    tone(900, 0.12, "sawtooth", 0.03, 380);
  },
  hit(heavy: boolean) {
    // Metallic sword CLASH: sharp transient + inharmonic ringing partials ("shing").
    if (heavy) {
      // Heavy clash — big low clang plus long bright ring.
      tone(70, 0.16, "square", 0.22, 34);          // deep impact thud
      noise(0.05, 0.35, 2600);                       // sharp metallic transient
      metalRing(2400, 0.5, 0.3, 22);                 // bright ring
      metalRing(3700, 0.42, 0.22, 26, 0.005);        // higher inharmonic partial
      metalRing(1500, 0.6, 0.24, 16);                // body of the blade
      ringTone(3100, 0.4, 0.12, 0.004);              // shimmering "shing"
      ringTone(4650, 0.3, 0.08, 0.006);
    } else {
      // Light clash — crisp, quick, ringing "ting".
      noise(0.035, 0.28, 3200);                      // sharp transient
      metalRing(3200, 0.34, 0.26, 24);               // bright metallic ring
      metalRing(4800, 0.26, 0.18, 28, 0.004);        // sparkly high partial
      metalRing(2100, 0.4, 0.2, 18);                 // blade body resonance
      ringTone(4200, 0.28, 0.1, 0.003);              // "shing" overtone
    }
  },
  ko() {
    tone(300, 0.5, "sawtooth", 0.25, 60);
    noise(0.4, 0.3, 300);
  },
  ui() {
    tone(660, 0.08, "triangle", 0.15);
  },
  select() {
    tone(880, 0.06, "square", 0.12);
    tone(1200, 0.08, "square", 0.1);
  },
  win() {
    [523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => tone(f, 0.2, "triangle", 0.2), i * 110)
    );
  },
};
