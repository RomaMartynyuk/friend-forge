type MiniGameOptions = Readonly<{
  onClose: () => void;
  isPaused: () => boolean;
  playSound: (cue: "select" | "action-start" | "impact" | "reward", volume?: number) => void;
}>;

const TARGETS = [0.5, 0.72, 0.31, 0.62, 0.4, 0.76, 0.25, 0.55] as const;
const ROUNDS = TARGETS.length;

export function mountCommunityFurnaceMiniGame(modal: HTMLElement, options: MiniGameOptions) {
  modal.innerHTML = `
    <div class="community-mini-card" role="document">
      <header class="community-mini-head">
        <div class="community-mini-kicker">FRIEND FORGE · COMMUNITY FURNACE</div>
        <h2>FURNACE KEEPER</h2>
        <p class="community-mini-disclaimer">Global contributions were planned here. For now, play three local mini-games — no shared progress, RF or artifact rewards.</p>
      </header>
      <div class="community-mini-body">
        <div class="community-mini-scoreboard">
          <div><small>ROUND</small><strong id="furnaceMiniRound">0 / ${ROUNDS}</strong></div>
          <div><small>HEAT</small><strong id="furnaceMiniScore">0</strong></div>
          <div><small>STREAK</small><strong id="furnaceMiniStreak">0</strong></div>
          <div><small>LOCAL BEST</small><strong id="furnaceMiniBest">0</strong></div>
        </div>
        <div class="community-mini-furnace" aria-hidden="true">
          <div class="community-mini-chimney"></div>
          <div class="community-mini-flame">✦</div>
          <div class="community-mini-oven"><span id="furnaceMiniGlow"></span></div>
        </div>
        <div class="community-mini-instruction" id="furnaceMiniMessage" role="status" aria-live="polite">Stop the moving spark inside the pastel target. Eight strokes to heat the furnace.</div>
        <div class="community-mini-track" id="furnaceMiniTrack" aria-label="Timing track">
          <div class="community-mini-target" id="furnaceMiniTarget"></div>
          <div class="community-mini-marker" id="furnaceMiniMarker">◆</div>
        </div>
        <div class="community-mini-keyhint">TAP STOKE OR PRESS SPACE WHEN THE SPARK HITS THE TARGET</div>
        <div class="community-mini-meter" role="progressbar" aria-label="Local furnace heat" aria-valuemin="0" aria-valuemax="30" aria-valuenow="0"><span id="furnaceMiniMeter"></span></div>
        <p class="community-mini-footnote">Practice only · score lives in this game session · FriendSDK economy is unchanged</p>
      </div>
      <footer class="community-mini-actions">
        <button id="furnaceMiniStart" type="button">START GAME</button>
        <button id="furnaceMiniStoke" type="button" disabled>STOKE ✦</button>
        <button id="furnaceMiniClose" type="button">BACK TO ISLAND</button>
      </footer>
    </div>`;

  const $ = (selector: string) => modal.querySelector(selector) as HTMLElement;
  const roundLabel = $("#furnaceMiniRound");
  const scoreLabel = $("#furnaceMiniScore");
  const streakLabel = $("#furnaceMiniStreak");
  const bestLabel = $("#furnaceMiniBest");
  const message = $("#furnaceMiniMessage");
  const target = $("#furnaceMiniTarget");
  const marker = $("#furnaceMiniMarker");
  const track = $("#furnaceMiniTrack");
  const meter = $("#furnaceMiniMeter");
  const meterOuter = $(".community-mini-meter");
  const glow = $("#furnaceMiniGlow");
  const startButton = $("#furnaceMiniStart") as HTMLButtonElement;
  const stokeButton = $("#furnaceMiniStoke") as HTMLButtonElement;
  const closeButton = $("#furnaceMiniClose") as HTMLButtonElement;

  let phase: "ready" | "playing" | "between" | "done" = "ready";
  let round = 0;
  let score = 0;
  let streak = 0;
  let best = 0;
  let position = 0.08;
  let direction = 1;
  let lastFrame = 0;
  let frame = 0;
  let nextRoundTimer = 0;
  let open = false;
  let destroyed = false;
  let feedback = "";

  function targetWidth() {
    return Math.max(0.12, 0.19 - round * 0.01);
  }

  function render() {
    roundLabel.textContent = `${phase === "ready" ? 0 : Math.min(round + 1, ROUNDS)} / ${ROUNDS}`;
    scoreLabel.textContent = String(score);
    streakLabel.textContent = String(streak);
    bestLabel.textContent = String(best);
    target.style.left = `${TARGETS[Math.min(round, ROUNDS - 1)] * 100}%`;
    target.style.width = `${targetWidth() * 100}%`;
    marker.style.left = `${position * 100}%`;
    meter.style.width = `${Math.min(100, score / 30 * 100)}%`;
    meterOuter.setAttribute("aria-valuenow", String(Math.min(30, score)));
    glow.style.opacity = String(Math.min(1, 0.24 + score / 38));
    track.dataset.feedback = feedback;
    startButton.hidden = phase === "playing" || phase === "between";
    startButton.textContent = phase === "done" ? "PLAY AGAIN" : "START GAME";
    stokeButton.disabled = phase !== "playing";
  }

  function tick(now: number) {
    frame = 0;
    if (!open || destroyed) return;
    const dt = Math.min(0.04, Math.max(0, (now - (lastFrame || now)) / 1000));
    lastFrame = now;
    if (phase === "playing" && !options.isPaused() && !document.hidden) {
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const speed = (reducedMotion ? 0.38 : 0.58) + round * 0.055;
      position += direction * speed * dt;
      if (position >= 0.98) { position = 0.98; direction = -1; }
      if (position <= 0.02) { position = 0.02; direction = 1; }
      marker.style.left = `${position * 100}%`;
    }
    frame = requestAnimationFrame(tick);
  }

  function start() {
    if (destroyed || !open || options.isPaused()) return;
    if (nextRoundTimer) window.clearTimeout(nextRoundTimer);
    round = 0;
    score = 0;
    streak = 0;
    position = 0.08;
    direction = 1;
    feedback = "";
    phase = "playing";
    message.textContent = "Round 1 · time your first stroke.";
    options.playSound("action-start", 0.5);
    render();
    stokeButton.focus();
  }

  function stoke() {
    if (phase !== "playing" || options.isPaused()) return;
    const distance = Math.abs(position - TARGETS[round]);
    const half = targetWidth() / 2;
    const hit = distance <= half;
    let points = 0;
    if (hit) {
      streak += 1;
      points = distance <= half * 0.25 ? 3 : distance <= half * 0.65 ? 2 : 1;
      if (streak >= 3) points += 1;
      score += points;
      feedback = "hit";
      options.playSound("impact", 0.35);
      message.textContent = `${points >= 3 ? "Perfect" : "Good"} stroke · +${points} heat${streak >= 3 ? ` · ${streak} streak` : ""}`;
    } else {
      streak = 0;
      feedback = "miss";
      options.playSound("select", 0.25);
      message.textContent = "Cold stroke · no heat. Watch the target and try the next one.";
    }
    phase = "between";
    render();
    nextRoundTimer = window.setTimeout(() => {
      nextRoundTimer = 0;
      if (!open || destroyed) return;
      round += 1;
      feedback = "";
      if (round >= ROUNDS) {
        phase = "done";
        best = Math.max(best, score);
        message.textContent = `Furnace complete · ${score} heat. Local best: ${best}. No global contribution or SDK reward was recorded.`;
        options.playSound("reward", 0.4);
        startButton.focus();
      } else {
        position = 0.08;
        direction = 1;
        phase = "playing";
        message.textContent = `Round ${round + 1} · keep the furnace warm.`;
        stokeButton.focus();
      }
      render();
    }, 650);
  }

  function close() {
    if (nextRoundTimer) window.clearTimeout(nextRoundTimer);
    nextRoundTimer = 0;
    open = false;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    phase = "ready";
    feedback = "";
    message.textContent = "Stop the moving spark inside the pastel target. Eight strokes to heat the furnace.";
    render();
    options.onClose();
  }

  startButton.addEventListener("click", start);
  stokeButton.addEventListener("click", stoke);
  closeButton.addEventListener("click", close);
  const onKeyDown = (event: KeyboardEvent) => {
    if (!open || options.isPaused()) return;
    if (event.code === "Space") {
      if ((event.target as HTMLElement).closest("[data-arcade-game], #furnaceMiniClose")) return;
      event.preventDefault();
      if (event.repeat) return;
      if (phase === "ready" || phase === "done") start();
      else stoke();
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  };
  modal.addEventListener("keydown", onKeyDown);

  render();
  return {
    open() {
      if (destroyed) return;
      open = true;
      lastFrame = 0;
      modal.classList.add("show");
      startButton.focus();
      if (!frame) frame = requestAnimationFrame(tick);
    },
    destroy() {
      destroyed = true;
      open = false;
      if (frame) cancelAnimationFrame(frame);
      if (nextRoundTimer) window.clearTimeout(nextRoundTimer);
      modal.removeEventListener("keydown", onKeyDown);
    },
  };
}
