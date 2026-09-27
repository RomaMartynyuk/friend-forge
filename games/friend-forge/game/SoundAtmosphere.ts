// Cosmetic-only Web Audio layer. FriendSDK cues remain the recognisable lead sounds.
export type SoundScene = "island" | "mine" | "forge" | "collection" | "reforge" | "furnace";
export type SoundAccent =
  | "ui" | "hover" | "stone" | "ore" | "lava" | "cashout"
  | "forge-charge" | "forge-hit" | "rarity" | "collection"
  | "furnace" | "dice" | "lots" | "cases";

const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const scenePitch: Record<SoundScene, number> = {
  island: 220, mine: 110, forge: 146.83, collection: 329.63, reforge: 174.61, furnace: 130.81,
};

export function createSoundAtmosphere() {
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let scene: SoundScene = "island";
  let volume = 0.62;
  let muted = false;
  let ambience = true;
  let paused = false;
  let disposed = false;
  let pulseTimer = 0;
  let lastHover = 0;
  let listening = false;

  function audible() {
    return !disposed && !muted && !paused && !document.hidden && volume > 0 && context?.state === "running";
  }

  function gainLevel() {
    if (!master || !context) return;
    master.gain.setTargetAtTime(muted || paused || document.hidden ? 0 : volume * 0.34, context.currentTime, 0.04);
  }

  function note(frequency: number, duration: number, level: number, waveform: OscillatorType = "sine", when = 0, slide = 1) {
    if (!audible() || !context || !master) return;
    const start = context.currentTime + when;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = waveform;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, frequency * slide), start + duration);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0001, level), start + Math.min(0.02, duration / 4));
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(envelope).connect(master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
  }

  function accent(kind: SoundAccent, strength = 1) {
    if (!audible()) return false;
    const scale = clamp(strength);
    const base = scenePitch[scene];
    switch (kind) {
      case "hover": {
        const now = performance.now();
        if (now - lastHover < 110) return false;
        lastHover = now;
        note(740, 0.025, 0.025 * scale, "sine"); break;
      }
      case "ui": note(540, 0.055, 0.095 * scale, "triangle", 0, 0.72); break;
      case "stone": note(130, 0.075, 0.22 * scale, "triangle", 0, 0.65); break;
      case "ore": note(392, 0.11, 0.13 * scale, "sine"); note(587, 0.16, 0.09 * scale, "sine", 0.06); break;
      case "lava": note(92, 0.37, 0.25 * scale, "sawtooth", 0, 0.46); break;
      case "cashout": note(330, 0.13, 0.10 * scale); note(494, 0.21, 0.11 * scale, "sine", 0.12); break;
      case "forge-charge": note(base, 0.85, 0.09 * scale, "triangle", 0, 1.45); break;
      case "forge-hit": note(82, 0.28, 0.19 * scale, "triangle", 0, 0.5); break;
      case "rarity": note(523, 0.35, 0.075 * scale); note(784, 0.5, 0.06 * scale, "sine", 0.11); break;
      case "collection": note(659, 0.16, 0.055 * scale); break;
      case "furnace": note(164, 0.25, 0.11 * scale, "triangle", 0, 0.8); break;
      case "dice": note(330, 0.065, 0.08 * scale, "triangle"); note(370, 0.065, 0.08 * scale, "triangle", 0.08); break;
      case "lots": note(520, 0.04, 0.08 * scale, "square"); note(390, 0.07, 0.07 * scale, "triangle", 0.08); break;
      case "cases": note(205, 0.16, 0.12 * scale, "triangle"); note(410, 0.15, 0.06 * scale, "sine", 0.1); break;
    }
    return true;
  }

  function ambientPulse() {
    if (!ambience || !audible()) return;
    const base = scenePitch[scene];
    const level = scene === "island" ? 0.012 : scene === "collection" ? 0.009 : 0.017;
    note(base, 2.9, level, "sine", 0, 1.005);
    note(base * 1.5, 2.1, level * 0.48, "sine", 0.18, 0.998);
  }

  function onVisibility() { gainLevel(); }

  return {
    async unlock() {
      if (disposed || typeof window === "undefined") return false;
      try {
        if (!context) {
          context = new AudioContext();
          master = context.createGain();
          master.gain.value = 0;
          master.connect(context.destination);
        }
        await context.resume();
        gainLevel();
        if (!listening) {
          document.addEventListener("visibilitychange", onVisibility);
          listening = true;
        }
        if (!pulseTimer) pulseTimer = window.setInterval(ambientPulse, 3600);
        return context.state === "running";
      } catch { return false; }
    },
    accent,
    setScene(next: SoundScene) { scene = next; },
    setVolume(next: number) { volume = clamp(next); gainLevel(); },
    setMuted(next: boolean) { muted = next; gainLevel(); },
    setPaused(next: boolean) { paused = next; gainLevel(); },
    setAmbience(next: boolean) { ambience = next; },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (pulseTimer) window.clearInterval(pulseTimer);
      if (listening) document.removeEventListener("visibilitychange", onVisibility);
      void context?.close();
      context = null;
      master = null;
    },
  };
}
