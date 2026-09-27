"use client";

import { useEffect, useRef, useState } from "react";
import type { GameComponentProps } from "@rarefriends/friendsdk/runtime";
import {
  createFriendReader,
  type GenerationSprites,
} from "@rarefriends/friendsdk/sprites";
import {
  createFriendSoundKit,
  type FriendSoundCue,
} from "@rarefriends/friendsdk/sounds";
import {
  mountFriendForge,
  type FriendForgeController,
  type FriendSoundBridge,
} from "./game/FriendForgeGame";
import {
  createFriendForgeEconomy,
  type ArtifactDefinition,
  type FriendForgeSettledReward,
} from "./game/SdkEconomy";
import {
  loadCanonicalWorldProps,
  type CanonicalWorldProp,
} from "./game/CanonicalWorldProps";
import {
  artifactArtwork,
  artifactSilhouette,
} from "./game/ArtifactArtwork";
import { createSoundAtmosphere, type SoundScene } from "./game/SoundAtmosphere";
import "./style.css";
import "./page-layout.css";

const friendReader = createFriendReader();

const CANONICAL_WORLD_PROP_TIMEOUT_MS = 2500;

async function loadCanonicalWorldPropsSafe(seed: number) {
  let timer = 0;

  try {
    const timeout = new Promise<readonly CanonicalWorldProp[]>((resolve) => {
      timer = window.setTimeout(() => resolve([]), CANONICAL_WORLD_PROP_TIMEOUT_MS);
    });

    return await Promise.race([
      loadCanonicalWorldProps(seed >>> 0, 4),
      timeout,
    ]);
  } catch (cause) {
    console.warn("Canonical world props unavailable; continuing without them.", cause);
    return [];
  } finally {
    if (timer) window.clearTimeout(timer);
  }
}

type ForgeCinematicPhase =
  | "idle"
  | "lock"
  | "charge"
  | "roll"
  | "impact"
  | "rarity"
  | "silhouette"
  | "artwork"
  | "result";

const RARITY_ROLL_SEQUENCE = [
  "COMMON",
  "UNCOMMON",
  "RARE",
  "EPIC",
  "LEGENDARY",
  "MYTHIC",
] as const;

// Cosmetic only: this sequence never enters FriendSDK play/settle or outcome mapping.
function cosmeticRoll(playId: bigint) {
  let seed = Number(playId & 0xffffffffn) || 0x6d2b79f5;
  return Array.from({ length: 13 }, () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return RARITY_ROLL_SEQUENCE[(seed >>> 0) % RARITY_ROLL_SEQUENCE.length];
  });
}

const ROLL_TICKS_MS = [0, 75, 150, 225, 300, 385, 475, 575, 690, 830, 1000, 1210, 1470];

function cinematicDurations(rarity: ArtifactDefinition["rarity"]) {
  const lead = { lock: 420, charge: 900, roll: 1800, impact: 260 };
  if (rarity === "mythic") return { ...lead, rarity: 1700, silhouette: 900, artwork: 1100 };
  if (rarity === "legendary") return { ...lead, rarity: 1450, silhouette: 800, artwork: 1000 };
  if (rarity === "epic") return { ...lead, rarity: 1050, silhouette: 720, artwork: 900 };
  if (rarity === "rare") return { ...lead, rarity: 900, silhouette: 650, artwork: 800 };
  if (rarity === "uncommon") return { ...lead, rarity: 720, silhouette: 520, artwork: 700 };
  return { ...lead, rarity: 560, silhouette: 460, artwork: 650 };
}

function rarityRevealCue(rarity: ArtifactDefinition["rarity"]): FriendSoundCue {
  if (rarity === "legendary" || rarity === "mythic") return "reveal-legendary";
  if (rarity === "rare" || rarity === "epic") return "reveal-rare";
  return "reveal-common";
}

function PortraitSprite({
  sprites,
  frameIndex,
}: {
  sprites: GenerationSprites;
  frameIndex: number;
}) {
  const frame = sprites.clips.idle.down[frameIndex % 8];

  return (
    <div className="portrait-pixels" aria-hidden="true">
      {frame.rows.map((row, y) =>
        row.split("").map((pixel, x) =>
          pixel === "#" ? (
            <span
              key={`${x}:${y}`}
              style={{ left: `${x * 6}px`, top: `${y * 6}px` }}
            />
          ) : null
        )
      )}
    </div>
  );
}

export default function FriendForge({
  friendId,
  client,
  paused,
}: GameComponentProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<FriendForgeController | null>(null);
  const pausedRef = useRef(paused);
  const soundUnlockedRef = useRef(false);
  const soundMutedRef = useRef(false);
  const initialVolumeRef = useRef(0.62);
  const soundsRef = useRef(createFriendSoundKit({ volume: initialVolumeRef.current }));
  const atmosphereRef = useRef(createSoundAtmosphere());
  const soundSceneRef = useRef<SoundScene>("island");
  const cinematicPhaseRef = useRef<ForgeCinematicPhase>("idle");

  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<"preview" | "chain" | null>(null);
  const [sprites, setSprites] = useState<GenerationSprites | null>(null);
  const [canonicalProps, setCanonicalProps] =
    useState<readonly CanonicalWorldProp[]>([]);
  const [spriteFallback, setSpriteFallback] = useState(false);
  const [portraitOpen, setPortraitOpen] = useState(false);
  const [portraitFrame, setPortraitFrame] = useState(0);
  const [soundUnlocked, setSoundUnlocked] = useState(false);
  const [soundMuted, setSoundMuted] = useState(false);
  const [soundVolume, setSoundVolume] = useState(initialVolumeRef.current);
  const [ambienceOn, setAmbienceOn] = useState(true);
  const [soundSettingsOpen, setSoundSettingsOpen] = useState(false);
  const [queuedReward, setQueuedReward] =
    useState<FriendForgeSettledReward | null>(null);
  const [cinematicPhase, setCinematicPhase] =
    useState<ForgeCinematicPhase>("idle");
  const [rollLabel, setRollLabel] = useState("COMMON");
  const [error, setError] = useState("");

  pausedRef.current = paused;
  soundUnlockedRef.current = soundUnlocked;
  soundMutedRef.current = soundMuted;
  cinematicPhaseRef.current = cinematicPhase;

  async function ensureSoundUnlocked() {
    if (soundMutedRef.current) return false;
    if (soundUnlockedRef.current) return true;

    const [sdkReady, layerReady] = await Promise.all([
      soundsRef.current.unlock(),
      atmosphereRef.current.unlock(),
    ]);
    soundUnlockedRef.current = sdkReady || layerReady;
    setSoundUnlocked(sdkReady || layerReady);
    return sdkReady || layerReady;
  }

  const soundBridgeRef = useRef<FriendSoundBridge>({
    play(cue: FriendSoundCue, volume = 1) {
      if (soundMutedRef.current || pausedRef.current || !soundUnlockedRef.current) return false;
      const played = soundsRef.current.play(cue, { volume });
      if (cue === "select") atmosphereRef.current.accent(soundSceneRef.current === "collection" ? "collection" : "ui", volume * 0.55);
      else if (cue === "impact" && soundSceneRef.current !== "mine") atmosphereRef.current.accent(soundSceneRef.current === "furnace" ? "furnace" : "forge-hit", volume * 0.6);
      else if (cue === "anticipation" && soundSceneRef.current === "forge") atmosphereRef.current.accent("forge-charge", volume * 0.6);
      else if (cue === "action-start" && soundSceneRef.current === "furnace") atmosphereRef.current.accent("furnace", volume * 0.4);
      else if (cue.startsWith("reveal-")) atmosphereRef.current.accent("rarity", volume * 0.5);
      return played;
    },
    accent(accent, volume = 1) { return atmosphereRef.current.accent(accent, volume); },
    setScene(scene) {
      soundSceneRef.current = scene;
      atmosphereRef.current.setScene(cinematicPhaseRef.current === "idle" ? scene : "forge");
    },
    ensureUnlocked: ensureSoundUnlocked,
    stop() {
      soundsRef.current.stop();
    },
  });

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPortraitFrame((frame) => (frame + 1) % 8);
    }, 220);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;

    setReady(false);
    setError("");
    setSprites(null);
    setCanonicalProps([]);
    setSpriteFallback(false);
    setQueuedReward(null);
    setCinematicPhase("idle");

    async function boot() {
      const snapshot = await client.read();

      if (!active) return;

      if (snapshot.friendId !== friendId) {
        throw new Error(
          "FriendSDK session does not match the selected Friend."
        );
      }

      setMode(snapshot.mode);

      let loadedSprites: GenerationSprites | null = null;

      try {
        loadedSprites = await friendReader.read(friendId);

        if (!active) return;
        setSprites(loadedSprites);

      } catch (spriteError) {
        console.warn("Canonical Friend sprite could not load.", spriteError);

        if (!active) return;
        setSpriteFallback(true);
      }

      if (!mountRef.current) return;

      const islandSeed =
        loadedSprites?.seed ??
        Number(friendId & 0xffffffffn);

      const worldProps =
        loadedSprites
          ? await loadCanonicalWorldPropsSafe(islandSeed >>> 0)
          : [];

      if (!active) return;
      setCanonicalProps(worldProps);

      const economy = createFriendForgeEconomy(
        client as any,
        snapshot,
        (reward) => {
          if (!active) return;

          setRollLabel(cosmeticRoll(reward.playId)[0] ?? "COMMON");
          setQueuedReward(reward);
          setCinematicPhase("lock");
        }
      );

      controllerRef.current?.destroy();
      controllerRef.current = mountFriendForge(mountRef.current, {
        friendId,
        sprites: loadedSprites,
        getPaused: () => pausedRef.current,
        sounds: soundBridgeRef.current,
        economy,
        islandSeed: islandSeed >>> 0,
        canonicalProps: worldProps,
      });

      setReady(true);
    }

    void boot().catch((cause) => {
      if (!active) return;

      setError(
        cause instanceof Error
          ? cause.message
          : "Could not initialize Friend Forge."
      );
    });

    return () => {
      active = false;
      controllerRef.current?.destroy();
      controllerRef.current = null;
      soundsRef.current.stop();
    };
  }, [client, friendId]);

  useEffect(() => {
    return () => {
      soundsRef.current.dispose();
      atmosphereRef.current.dispose();
    };
  }, []);

  useEffect(() => {
    atmosphereRef.current.setPaused(paused);
    if (paused) soundsRef.current.stop();
  }, [paused]);
  useEffect(() => {
    soundsRef.current.setVolume(soundVolume);
    atmosphereRef.current.setVolume(soundVolume);
  }, [soundVolume]);
  useEffect(() => { atmosphereRef.current.setAmbience(ambienceOn); }, [ambienceOn]);
  useEffect(() => {
    atmosphereRef.current.setScene(cinematicPhase === "idle" ? soundSceneRef.current : "forge");
  }, [cinematicPhase]);

  useEffect(() => {
    if (!queuedReward || cinematicPhase === "idle" || cinematicPhase === "result") return;

    let cancelled = false;
    const timers: number[] = [];
    const reward = queuedReward;
    const durations = cinematicDurations(reward.artifact.rarity);

    const later = (delay: number, fn: () => void) => {
      const id = window.setTimeout(() => {
        if (!cancelled) fn();
      }, delay);
      timers.push(id);
    };

    const play = (cue: FriendSoundCue, volume = 1) => {
      if (soundMutedRef.current || pausedRef.current || !soundUnlockedRef.current) return;
      soundsRef.current.play(cue, { volume });
    };

    if (cinematicPhase === "lock") {
      play("action-start", 0.86);
      later(durations.lock, () => setCinematicPhase("charge"));
    } else if (cinematicPhase === "charge") {
      play("anticipation", 0.84);
      atmosphereRef.current.accent("forge-charge", 0.65);
      later(durations.charge, () => setCinematicPhase("roll"));
    } else if (cinematicPhase === "roll") {
      cosmeticRoll(reward.playId).forEach((label, index) => {
        later(ROLL_TICKS_MS[index] ?? 0, () => {
          setRollLabel(label);
          if (index % 3 === 0) play("select", 0.2);
        });
      });
      later(durations.roll, () => {
        setCinematicPhase("impact");
      });
    } else if (cinematicPhase === "impact") {
      soundsRef.current.stop();
      play("impact", 1);
      atmosphereRef.current.accent("forge-hit", 0.85);
      later(durations.impact, () => setCinematicPhase("rarity"));
    } else if (cinematicPhase === "rarity") {
      play(rarityRevealCue(reward.artifact.rarity), reward.artifact.rarity === "mythic" ? 1 : 0.94);
      atmosphereRef.current.accent("rarity", 0.6);
      later(durations.rarity, () => setCinematicPhase("silhouette"));
    } else if (cinematicPhase === "silhouette") {
      later(durations.silhouette, () => setCinematicPhase("artwork"));
    } else if (cinematicPhase === "artwork") {
      play("reward", 0.84);
      later(durations.artwork, () => setCinematicPhase("result"));
    }

    return () => {
      cancelled = true;
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [queuedReward, cinematicPhase]);

  async function toggleSound() {
    if (soundMutedRef.current) {
      soundsRef.current.setMuted(false);
      atmosphereRef.current.setMuted(false);
      soundMutedRef.current = false;
      setSoundMuted(false);
      const ok = await ensureSoundUnlocked();

      if (ok) {
        soundsRef.current.play("select", { volume: 0.72 });
      }

      return;
    }

    if (!soundUnlockedRef.current) {
      const ok = await ensureSoundUnlocked();

      if (ok) {
        soundsRef.current.play("select", { volume: 0.72 });
      }

      return;
    }

    soundsRef.current.setMuted(true);
    atmosphereRef.current.setMuted(true);
    soundsRef.current.stop();
    soundMutedRef.current = true;
    soundUnlockedRef.current = false;
    setSoundMuted(true);
    setSoundUnlocked(false);
  }

  function changeSoundVolume(next: number) {
    const value = Math.max(0, Math.min(1, next));
    setSoundVolume(value);
    soundsRef.current.setVolume(value);
    atmosphereRef.current.setVolume(value);
  }

  function changeAmbience(next: boolean) {
    setAmbienceOn(next);
    atmosphereRef.current.setAmbience(next);
  }

  async function togglePortrait() {
    const ok = await ensureSoundUnlocked();

    if (ok) {
      soundsRef.current.play("select", { volume: 0.65 });
    }

    setPortraitOpen((open) => !open);
  }

  function closeForgeCinematic() {
    soundsRef.current.stop();
    setQueuedReward(null);
    setCinematicPhase("idle");
  }

  const familyName = sprites?.familyName ?? "";
  const cinematicReward = queuedReward;
  const cinematicArtwork = cinematicReward
    ? artifactArtwork(cinematicReward.artifact.id)
    : null;
  const cinematicSilhouette = cinematicReward
    ? artifactSilhouette(cinematicReward.artifact.id)
    : null;

  return (
    <div className="ff-page">
      <header className="ff-page-header">
        <a className="ff-wordmark" href="#friend-forge" aria-label="Friend Forge home">
          <span className="ff-mark" aria-hidden="true">✦</span>
          <span><strong>FRIEND FORGE</strong><small>AN ISLAND CRAFTING GAME</small></span>
        </a>
        <div className="ff-header-status">
          <span className={`ff-status-dot ${paused ? "is-paused" : ""}`} />
          <span>{paused ? "PAUSED" : ready ? "ISLAND ONLINE" : "CONNECTING"}</span>
          <span className="ff-header-divider" />
          <span>{mode === "chain" ? "ON-CHAIN" : "PREVIEW MODE"}</span>
        </div>
      </header>

      <div className="ff-page-intro">
        <div>
          <div className="ff-eyebrow">A LITTLE ISLAND. A LOT TO DISCOVER.</div>
          <h1>Make something <em>rare.</em></h1>
          <p>Mine Ore, visit the Central Forge, and build a collection with your Friend.</p>
        </div>
        <div className="ff-page-stamp"><span>WORLD</span><strong>NO. 001</strong><i>✳</i></div>
      </div>

      <div className="ff-page-layout" id="friend-forge">
      <main className="ff-game-column">
      <section
        className="friend-forge-sdk-shell"
        aria-label="Friend Forge island"
        aria-busy={!ready}
      >
      {!ready && !error && (
        <div className="sdk-boot-state" role="status">
          <div className="sdk-state-card">
            <span className="sdk-state-kicker">FRIEND FORGE</span>
            <strong>Preparing Friend #{friendId.toString()}</strong>
            <span className="sdk-state-copy">
              Loading canonical Friend, island identity and SDK state.
            </span>
            <span className="sdk-state-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          </div>
        </div>
      )}

      {error && (
        <div className="sdk-boot-state sdk-error" role="alert">
          <div className="sdk-state-card">
            <span className="sdk-state-kicker">FRIEND FORGE</span>
            <strong>Could not enter the island</strong>
            <span className="sdk-state-copy">{error}</span>
          </div>
        </div>
      )}

      <div
        ref={mountRef}
        className="friend-forge-mount"
        aria-hidden={!ready || undefined}
      />

      {ready && (
        <div className="friend-tools">
          <button
            type="button"
            className="friend-tool-button portrait-trigger"
            onClick={togglePortrait}
            aria-expanded={portraitOpen}
          >
            <span>FRIEND #{friendId.toString()}</span>
            <strong>
              {familyName ? familyName.toUpperCase() : "FRIEND"}
            </strong>
          </button>

          <button
            type="button"
            className="friend-tool-button sound-trigger"
            onClick={toggleSound}
          >
            {soundMuted
              ? "SOUND OFF"
              : soundUnlocked
                ? "SOUND ON"
                : "ENABLE SOUND"}
          </button>
          <button
            type="button"
            className="friend-tool-button sound-settings-trigger"
            onClick={() => setSoundSettingsOpen((open) => !open)}
            aria-expanded={soundSettingsOpen}
            aria-controls="friendForgeSoundSettings"
          >
            MIX
          </button>
          {soundSettingsOpen && (
            <div id="friendForgeSoundSettings" className="friend-sound-settings" role="group" aria-label="Sound settings">
              <strong>SOUND MIX</strong>
              <label htmlFor="friendForgeVolume">VOLUME <span>{Math.round(soundVolume * 100)}%</span></label>
              <input id="friendForgeVolume" type="range" min="0" max="100" value={Math.round(soundVolume * 100)} onChange={(event) => changeSoundVolume(Number(event.target.value) / 100)} />
              <label className="friend-sound-ambience"><input type="checkbox" checked={ambienceOn} onChange={(event) => changeAmbience(event.target.checked)} /> ISLAND ATMOSPHERE</label>
              <small>Rare Friends cues stay in front. No music or downloads.</small>
            </div>
          )}
        </div>
      )}

      {ready && portraitOpen && !queuedReward && (
        <div
          className="friend-portrait-card"
          role="dialog"
          aria-label="Friend identity"
        >
          <button
            type="button"
            className="portrait-close"
            onClick={togglePortrait}
            aria-label="Close Friend card"
          >
            ×
          </button>

          <div className="portrait-kicker">CANONICAL FRIEND</div>

          <div className="portrait-art">
            {sprites ? (
              <PortraitSprite
                sprites={sprites}
                frameIndex={portraitFrame}
              />
            ) : (
              <div className="portrait-fallback">?</div>
            )}
          </div>

          <div className="portrait-meta">
            <span>FRIEND</span>
            <strong>#{friendId.toString()}</strong>
          </div>

          <div className="portrait-meta">
            <span>FAMILY</span>
            <strong>
              {familyName ? familyName.toUpperCase() : "UNKNOWN"}
            </strong>
          </div>

          <div className="portrait-meta">
            <span>ISLAND</span>
            <strong>
              V{(((sprites?.seed ?? Number(friendId & 0xffffffffn)) >>> 0) % 4) + 1}
              {" · "}
              {`0x${((sprites?.seed ?? Number(friendId & 0xffffffffn)) >>> 0)
                .toString(16)
                .padStart(8, "0")
                .toUpperCase()}`}
            </strong>
          </div>

          <div className="portrait-meta">
            <span>CANONICAL PROPS</span>
            <strong>{canonicalProps.length}</strong>
          </div>

          <div className="portrait-meta">
            <span>STATUS</span>
            <strong>{paused ? "PAUSED" : "ACTIVE"}</strong>
          </div>

          <div className="portrait-meta">
            <span>MODE</span>
            <strong>{mode === "chain" ? "CHAIN" : "PREVIEW"}</strong>
          </div>

          {spriteFallback && (
            <div className="portrait-warning">
              SPRITE FALLBACK ACTIVE
            </div>
          )}
        </div>
      )}

      {cinematicReward && cinematicPhase !== "idle" && (
        <div
          className={`forge-cinematic-overlay phase-${cinematicPhase} ${["rarity", "silhouette", "artwork", "result"].includes(cinematicPhase) ? `rarity-${cinematicReward.artifact.rarity}` : cinematicPhase === "roll" ? `rarity-${rollLabel.toLowerCase()}` : "rarity-neutral"}`}
          role="dialog"
          aria-modal="true"
          aria-label={cinematicPhase === "result" ? `Forged ${cinematicReward.artifact.name}` : "Forge reveal in progress"}
        >
          <div className="forge-cinematic-vignette" />
          <div className="forge-cinematic-shell">
            <div className="forge-cinematic-top">
              <span>FRIEND FORGE</span>
              <b>
                {cinematicPhase === "lock" && "LOCKING ORE"}
                {cinematicPhase === "charge" && "CHARGING CHAMBER"}
                {cinematicPhase === "roll" && "ROLLING RARITY"}
                {cinematicPhase === "impact" && "IMPACT"}
                {cinematicPhase === "rarity" && "RARITY FOUND"}
                {cinematicPhase === "silhouette" && "ARTIFACT DETECTED"}
                {cinematicPhase === "artwork" && "FORGE COMPLETE"}
                {cinematicPhase === "result" && "FORGE COMPLETE"}
              </b>
            </div>

            <div className="forge-cinematic-stage">
              <div className="forge-cinematic-rings" aria-hidden="true">
                <i className="ring r1" /><i className="ring r2" /><i className="ring r3" />
              </div>
              <div className="forge-cinematic-particles" aria-hidden="true">
                {Array.from({ length: 24 }, (_, index) => (
                  <i key={index} style={{ ["--p" as any]: index }} />
                ))}
              </div>

              {(cinematicPhase === "lock" || cinematicPhase === "charge") && (
                <div className="forge-cinematic-core">
                  <strong>?</strong>
                  <span>{cinematicPhase === "lock" ? "ORE LOCKED" : "CHARGE"}</span>
                </div>
              )}

              {cinematicPhase === "roll" && (
                <div className="forge-cinematic-roll">
                  <span>RARITY</span><strong>{rollLabel}</strong><i />
                </div>
              )}

              {cinematicPhase === "impact" && (
                <div className="forge-cinematic-impact-mark">!</div>
              )}

              {cinematicPhase === "rarity" && (
                <div className="forge-cinematic-rarity">
                  <span>RARITY</span>
                  <strong>{cinematicReward.artifact.rarity.toUpperCase()}</strong>
                </div>
              )}

              {cinematicPhase === "silhouette" && cinematicSilhouette && (
                <div className="forge-cinematic-art-shell silhouette">
                  <img src={cinematicSilhouette} alt="" className="forge-cinematic-art artifact-silhouette" />
                </div>
              )}

              {(cinematicPhase === "artwork" || cinematicPhase === "result") && cinematicArtwork && (
                <div className="forge-cinematic-art-shell revealed">
                  <img src={cinematicArtwork} alt={cinematicReward.artifact.name} className="forge-cinematic-art" />
                  {cinematicPhase === "result" && (
                    <div className="forge-cinematic-result">
                      <strong className="forge-cinematic-name">{cinematicReward.artifact.name}</strong>
                      <span className="forge-cinematic-rarity-tag">{cinematicReward.artifact.rarity.toUpperCase()}</span>
                      <span className="forge-cinematic-new">{cinematicReward.duplicate ? "DUPLICATE" : "NEW"}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="forge-cinematic-bottom">
              <span>
                {cinematicPhase === "roll"
                  ? "OUTCOME SETTLED · VISUAL REVEAL ONLY"
                  : `PLAY #${cinematicReward.playId.toString()}`}
              </span>
              {cinematicPhase === "result" ? (
                <button type="button" className="forge-cinematic-continue" onClick={closeForgeCinematic} autoFocus>
                  CONTINUE →
                </button>
              ) : <b>FORGE ACTIVE</b>}
            </div>
          </div>
          <div className="forge-cinematic-flash" aria-hidden="true" />
        </div>
      )}

      {ready && (
        <div className="sdk-mode-badge">
          {mode === "chain" ? "CHAIN" : "SIMULATED PREVIEW"} · FRIEND #
          {friendId.toString()}
          {familyName ? ` · ${familyName.toUpperCase()}` : ""}
          {spriteFallback ? " · SPRITE FALLBACK" : ""}
        </div>
      )}

      {paused && ready && !queuedReward && (
        <div className="sdk-paused-overlay" role="status">
          <strong>SDK PAUSED</strong>
          <span>Close the FriendSDK menu to resume the island.</span>
        </div>
      )}
      </section>
      <div className="ff-under-game-bar">
        <span><i className="ff-live-dot" /> YOUR ISLAND IS READY</span>
        <span>MOVE WITH <kbd>W A S D</kbd> OR <kbd>↑ ↓ ← →</kbd> <b>·</b> TAP A DESTINATION ON MOBILE</span>
      </div>
      </main>

      <aside className="ff-side-column" aria-label="Game information">
        <section className="ff-side-card ff-friend-card">
          <div className="ff-card-heading"><span>YOUR COMPANION</span><i>01</i></div>
          <div className="ff-friend-profile">
            <div className="ff-friend-avatar">
              {sprites ? <PortraitSprite sprites={sprites} frameIndex={portraitFrame} /> : <span>✳</span>}
            </div>
            <div className="ff-friend-name"><small>CANONICAL FRIEND</small><strong>{familyName || "Your Friend"}</strong><span>#{friendId.toString()}</span></div>
          </div>
          <div className="ff-friend-foot"><span>{mode === "chain" ? "CHAIN SESSION" : "PREVIEW SESSION"}</span><span>{paused ? "PAUSED" : "ACTIVE"}</span></div>
        </section>

        <section className="ff-side-card ff-how-card">
          <div className="ff-card-heading"><span>HOW TO PLAY</span><i>02</i></div>
          <ol className="ff-steps">
            <li><b>01</b><span><strong>Explore</strong><small>Walk around your island and meet its little landmarks.</small></span></li>
            <li><b>02</b><span><strong>Mine Ore</strong><small>Visit the Ore Mine to get forging material.</small></span></li>
            <li><b>03</b><span><strong>Forge & collect</strong><small>Try your luck at the Central Forge; discoveries live in Collection.</small></span></li>
          </ol>
        </section>

        <section className="ff-side-card ff-odds-card">
          <div className="ff-card-heading"><span>FORGE ODDS</span><i>03</i></div>
          <p>Current FriendSDK outcome distribution per Forge.</p>
          <div className="ff-odds-list">
            <div><i className="rarity-swatch common"/><span>Common</span><b>50%</b></div>
            <div><i className="rarity-swatch uncommon"/><span>Uncommon</span><b>27%</b></div>
            <div><i className="rarity-swatch rare"/><span>Rare</span><b>14%</b></div>
            <div><i className="rarity-swatch epic"/><span>Epic</span><b>6%</b></div>
            <div><i className="rarity-swatch legendary"/><span>Legendary</span><b>2.5%</b></div>
            <div><i className="rarity-swatch mythic"/><span>Mythic</span><b>0.5%</b></div>
          </div>
          <div className="ff-odds-note">1 ORE PER FORGE <span>·</span> RESULTS SETTLED BY FRIENDSDK</div>
        </section>

        <details className="ff-side-card ff-help-card">
          <summary><span>GOOD TO KNOW</span><b>+</b></summary>
          <p>Every result is settled by FriendSDK. The rarity animation is only a visual reveal; it never changes your outcome. Reward values and available actions are shown in Collection.</p>
        </details>
      </aside>
      </div>

      <footer className="ff-page-footer"><span>FRIEND FORGE <b>·</b> BUILT FOR LITTLE ADVENTURES</span><span>FRIENDSDK ECONOMY <i>●</i> CANONICAL FRIENDS</span></footer>
    </div>
  );
}
