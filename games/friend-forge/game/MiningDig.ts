import {
  MINE_HEIGHT, MINE_WIDTH, RUN_DIGS, createMiningRun, stepMiningRun,
  cashOutMiningRun, type MiningRun,
} from "./MiningDigCore";
import type { FriendForgeResult, FriendForgeSettledReward } from "./SdkEconomy";

type Options = Readonly<{
  friendId: bigint;
  friendRows: readonly string[] | null;
  isPaused: () => boolean;
  canStartPaid: () => boolean;
  buyTwoOre: () => Promise<boolean>;
  forgeOne: () => Promise<FriendForgeResult | null>;
  playSound: (cue: "select" | "action-start" | "impact" | "reward", volume?: number) => void;
  playAccent?: (accent: "stone" | "ore" | "lava" | "cashout", volume?: number) => void;
}>;

function friendPixels(rows: readonly string[] | null) {
  if (!rows) return '<span class="mining-friend-fallback">◆</span>';
  return `<span class="mining-friend-pixels" aria-hidden="true">${rows.map((row, y) => row.split("").map((pixel, x) => pixel === "#" ? `<i style="left:${x * 2}px;top:${y * 2}px"></i>` : "").join("")).join("")}</span>`;
}

export function mountMiningDig(oreModal: HTMLElement, options: Options) {
  const overlay = document.createElement("div");
  overlay.className = "mining-dig-overlay";
  overlay.hidden = true;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Mining Dig");
  overlay.innerHTML = `
    <div class="mining-dig-card">
      <header class="mining-dig-head">
        <div><small>ORE MINE · SDK EXPEDITION</small><h2>DOWN IN THE MINE</h2><p>Dig, dodge lava, then reveal two ordinary Forge results.</p></div>
        <div class="mining-dig-price"><small>EXPEDITION</small><strong>2 RF → 2 IRON ORE</strong></div>
      </header>
      <div class="mining-dig-ready" id="miningReady">
        <div class="mining-dig-warning"><strong>HOW THE ECONOMY WORKS</strong><p>FriendSDK buys 2 Iron Ore for 2 RF. The Ore stays in your Friend wallet until you Forge it. Mine discoveries are a cosmetic score: they never add Ore or change Forge odds.</p></div>
        <p>Each run has ${RUN_DIGS} digs. Richer iron veins lie deeper, where lava is more common. You can also explore for free without buying or forging anything.</p>
        <p class="mining-dig-message" id="miningReadyStatus" role="status">Ready to enter the mine.</p>
        <div class="mining-dig-ready-actions"><button type="button" id="miningPractice">[ PRACTICE DIG ]</button><button type="button" id="miningPaid">[ BUY 2 ORE · 2 RF → ENTER ]</button><button type="button" id="miningReadyBack">[ BACK TO ORE MINE ]</button></div>
      </div>
      <div class="mining-dig-play" id="miningPlay" hidden>
        <div class="mining-dig-stats"><span>DEPTH <b id="miningDepth">0</b></span><span>DIGS LEFT <b id="miningDigs">${RUN_DIGS}</b></span><span>BLOCKS <b id="miningBlocks">0</b></span><span id="miningMode">PRACTICE</span></div>
        <div class="mining-dig-content">
          <div class="mining-dig-grid" id="miningGrid" role="group" aria-label="Mining tile map"></div>
          <aside class="mining-dig-side"><h3>IRON VEINS</h3>
            <div><span>IRON <small>+1 score</small></span><b id="miningIron">0</b></div>
            <div><span>RICH IRON <small>+3 score</small></span><b id="miningRich">0</b></div>
            <div><span>DEEP IRON <small>+5 score</small></span><b id="miningDeep">0</b></div>
            <p>Vein score is cosmetic. Lava cannot be mined: it knocks your Friend back and costs 3 digs.</p>
          </aside>
        </div>
        <p class="mining-dig-message" id="miningMessage" role="status" aria-live="polite">Tap an adjacent block or use WASD / arrows.</p>
        <div class="mining-dig-play-actions"><button type="button" id="miningCashOut">[ CASH OUT ]</button><button type="button" id="miningPlayBack">[ BACK TO ORE MINE ]</button></div>
      </div>
      <div class="mining-dig-report" id="miningReport" hidden>
        <small>RUN COMPLETE</small><h3>MINING REPORT</h3>
        <div class="mining-report-rows" id="miningReportRows"></div>
        <p id="miningReportNote" role="status"></p>
        <div class="mining-dig-report-actions"><button type="button" id="miningForge" hidden>[ FORGE ORE #1 ]</button><button type="button" id="miningAgain">[ MINE AGAIN ]</button><button type="button" id="miningReportBack">[ BACK TO MINE ]</button></div>
      </div>
    </div>`;
  oreModal.append(overlay);

  const $ = (selector: string) => overlay.querySelector(selector) as HTMLElement;
  const ready = $("#miningReady");
  const play = $("#miningPlay");
  const report = $("#miningReport");
  const grid = $("#miningGrid");
  const status = $("#miningMessage");
  const paidButton = $("#miningPaid") as HTMLButtonElement;
  const forgeButton = $("#miningForge") as HTMLButtonElement;
  const againButton = $("#miningAgain") as HTMLButtonElement;
  let run: MiningRun | null = null;
  let expedition = false;
  let rewards: FriendForgeSettledReward[] = [];
  let pendingForge = false;
  let runNumber = 0;
  let lavaTimer = 0;
  let busy = false;
  let purchaseUncertain = false;
  let destroyed = false;

  function view(name: "ready" | "play" | "report") {
    ready.hidden = name !== "ready";
    play.hidden = name !== "play";
    report.hidden = name !== "report";
  }

  function renderRun() {
    if (!run) return;
    $("#miningDepth").textContent = `${run.maxDepth} / ${MINE_HEIGHT - 1}`;
    $("#miningDigs").textContent = String(run.digsLeft);
    $("#miningBlocks").textContent = String(run.blocksMined);
    $("#miningIron").textContent = String(run.tiles.filter(tile => tile.kind === "iron" && tile.dug).length);
    $("#miningRich").textContent = String(run.tiles.filter(tile => tile.kind === "rich-iron" && tile.dug).length);
    $("#miningDeep").textContent = String(run.tiles.filter(tile => tile.kind === "deep-iron" && tile.dug).length);
    $("#miningMode").textContent = expedition ? "2 SDK ORE BOUGHT · FORGE AFTER RUN" : "PRACTICE · NO PURCHASE";
    grid.innerHTML = run.tiles.map((tile, index) => {
      const x = index % MINE_WIDTH;
      const y = Math.floor(index / MINE_WIDTH);
      const player = run!.player.x === x && run!.player.y === y;
      const adjacent = Math.abs(run!.player.x - x) + Math.abs(run!.player.y - y) === 1;
      const appearance = tile.dug ? "dug" : tile.visible ? tile.kind : "hidden";
      const content = player ? friendPixels(options.friendRows) : tile.dug ? "" : !tile.visible ? "?" : tile.kind === "lava" ? "≋" : tile.kind === "iron" ? "◆" : tile.kind === "rich-iron" ? "✦" : tile.kind === "deep-iron" ? "◇" : "▦";
      return `<button type="button" data-mine-x="${x}" data-mine-y="${y}" data-kind="${appearance}" ${adjacent ? 'data-adjacent="true"' : ""} ${adjacent ? "" : "disabled"} aria-label="Depth ${y}, column ${x + 1}: ${player ? "Friend" : appearance}">${content}</button>`;
    }).join("");
  }

  function startRun(paid: boolean) {
    expedition = paid;
    rewards = [];
    pendingForge = false;
    runNumber++;
    const seed = Number((options.friendId ^ BigInt(Math.imul(runNumber, 0x9e3779b9))) & 0xffffffffn);
    run = createMiningRun(seed);
    status.textContent = "Tap an adjacent block or use WASD / arrows. Cash out at any time.";
    view("play");
    renderRun();
    options.playSound("action-start", 0.55);
    grid.querySelector<HTMLButtonElement>('button[data-adjacent="true"]')?.focus();
  }

  function startPractice() {
    if (busy || destroyed || options.isPaused() || (expedition && rewards.length < 2)) return;
    startRun(false);
  }

  async function startPaid() {
    if (busy || destroyed || purchaseUncertain || !options.canStartPaid() || options.isPaused()) return;
    busy = true;
    paidButton.disabled = true;
    $("#miningReadyStatus").textContent = "Buying 2 Iron Ore through FriendSDK…";
    try {
      const bought = await options.buyTwoOre();
      if (destroyed) return;
      if (!bought) {
        purchaseUncertain = true;
        $("#miningReadyStatus").textContent = "Purchase was not confirmed here. Sync your Friend wallet before trying again; do not buy twice blindly.";
        return;
      }
      startRun(true);
    } catch (error) {
      purchaseUncertain = true;
      $("#miningReadyStatus").textContent = `${error instanceof Error ? error.message : "Purchase could not be confirmed."} Sync before retrying.`;
    } finally {
      busy = false;
      paidButton.disabled = purchaseUncertain || !options.canStartPaid();
    }
  }

  function renderReport(note?: string) {
    if (!run) return;
    const rows = [
      ["Depth reached", String(run.maxDepth)],
      ["Blocks mined", String(run.blocksMined)],
      ["Iron found", `${run.ironFragments} cosmetic fragment points`],
      ["RF spent", expedition ? "2 RF · SDK purchase" : "0 RF · practice"],
      ["Ore received", expedition ? "2 Iron Ore · SDK purchase" : "0 · practice"],
      ["Forge results", expedition ? `${rewards.length} / 2 settled` : "none · practice"],
    ];
    if (rewards.length) rows.push(["Artifacts", rewards.map(reward => reward.artifact.name).join(" / ")]);
    $("#miningReportRows").innerHTML = rows.map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join("");
    $("#miningReportNote").textContent = note ?? (expedition
      ? "Forge the 2 purchased Ore one at a time. Each result and rarity comes from the normal FriendSDK play/settle flow; mining score does not affect them."
      : "Practice score only. No RF was spent and no Ore or artifact was awarded.");
    forgeButton.hidden = !expedition || rewards.length >= 2;
    forgeButton.disabled = busy;
    forgeButton.textContent = pendingForge ? "[ RESUME PENDING FORGE ]" : `[ FORGE ORE #${rewards.length + 1} ]`;
    againButton.disabled = expedition && rewards.length < 2;
    againButton.textContent = expedition ? "[ ANOTHER EXPEDITION → ]" : "[ MINE AGAIN ]";
    view("report");
  }

  function showReport() {
    if (!run) return;
    run.ended = true;
    renderReport();
    options.playSound("reward", 0.3);
    options.playAccent?.("cashout", 0.55);
    (expedition ? forgeButton : againButton).focus();
  }

  function dig(x: number, y: number) {
    if (!run || run.ended || busy || options.isPaused()) return;
    const kind = run.tiles[y * MINE_WIDTH + x]?.kind;
    const result = stepMiningRun(run, x, y);
    if (result === "invalid" || result === "finished") return;
    if (result === "lava") {
      status.textContent = `LAVA! Your Friend was knocked back. −3 digs (${run.digsLeft} left).`;
      grid.classList.add("lava-hit");
      window.clearTimeout(lavaTimer);
      lavaTimer = window.setTimeout(() => grid.classList.remove("lava-hit"), 500);
      options.playSound("impact", 0.9);
      options.playAccent?.("lava", 0.8);
    } else if (result === "mined") {
      status.textContent = kind === "stone" ? "Stone cleared. Follow the veins deeper." : `${kind?.toUpperCase()} found! +${kind === "deep-iron" ? 5 : kind === "rich-iron" ? 3 : 1} cosmetic score.`;
      options.playSound(kind === "stone" ? "select" : "impact", kind === "stone" ? 0.25 : 0.5);
      options.playAccent?.(kind === "stone" ? "stone" : "ore", kind === "stone" ? 0.5 : 0.75);
    } else status.textContent = "Moved through a cleared tunnel.";
    renderRun();
    if (result === "mined") {
      grid.querySelector<HTMLButtonElement>(`button[data-mine-x="${x}"][data-mine-y="${y}"]`)?.setAttribute("data-just-dug", "true");
    }
    if (run.ended) showReport();
  }

  async function forgeNext() {
    if (!expedition || !run?.ended || rewards.length >= 2 || busy || options.isPaused()) return;
    busy = true;
    forgeButton.disabled = true;
    try {
      const result = await options.forgeOne();
      if (destroyed) return;
      if (!result) {
        renderReport("Forge did not complete. Check your wallet and pending play before retrying. Purchased Ore remains in the SDK wallet until used.");
        return;
      }
      if (result.status === "pending") {
        pendingForge = true;
        renderReport(`Play #${result.playId.toString()} is pending. Resume this exact SDK play; no second Ore will be consumed.`);
        return;
      }
      pendingForge = false;
      rewards.push(result);
      renderReport(`${result.artifact.name} settled by FriendSDK. ${rewards.length < 2 ? "Continue the reveal, then Forge the second purchased Ore." : "Both SDK results are complete."}`);
    } catch (error) {
      renderReport(error instanceof Error ? error.message : "Forge failed. Check pending play before trying again.");
    } finally {
      busy = false;
      forgeButton.disabled = false;
    }
  }

  function close() {
    if (busy) return;
    overlay.hidden = true;
    if (!expedition || rewards.length >= 2) { run = null; expedition = false; view("ready"); }
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (overlay.hidden || options.isPaused()) return;
    if (event.key === "Escape") { event.preventDefault(); close(); return; }
    if (play.hidden || !run) return;
    const key = event.key.toLowerCase();
    const vector: Record<string, [number, number]> = { w: [0, -1], arrowup: [0, -1], s: [0, 1], arrowdown: [0, 1], a: [-1, 0], arrowleft: [-1, 0], d: [1, 0], arrowright: [1, 0] };
    if (!vector[key]) return;
    event.preventDefault();
    dig(run.player.x + vector[key][0], run.player.y + vector[key][1]);
  };

  grid.addEventListener("click", event => {
    const tile = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-mine-x]");
    if (tile) dig(Number(tile.dataset.mineX), Number(tile.dataset.mineY));
  });
  $("#miningPractice").addEventListener("click", startPractice);
  paidButton.addEventListener("click", () => { void startPaid(); });
  $("#miningCashOut").addEventListener("click", () => { if (run) { cashOutMiningRun(run); showReport(); } });
  forgeButton.addEventListener("click", () => { void forgeNext(); });
  againButton.addEventListener("click", () => { if (expedition && rewards.length >= 2) { expedition = false; run = null; view("ready"); } else startPractice(); });
  for (const selector of ["#miningReadyBack", "#miningPlayBack", "#miningReportBack"]) $(selector).addEventListener("click", close);
  overlay.addEventListener("keydown", onKeyDown);

  return {
    open() {
      if (destroyed) return;
      overlay.hidden = false;
      if (run && expedition) view(run.ended ? "report" : "play");
      else view("ready");
      paidButton.disabled = purchaseUncertain || !options.canStartPaid();
      if (!run && !purchaseUncertain && !options.canStartPaid()) {
        $("#miningReadyStatus").textContent = "A paid expedition needs 2 RF, no pending Forge play, and an idle SDK wallet. Practice is always free.";
      }
      (run && expedition ? run.ended ? forgeButton : $("#miningCashOut") as HTMLButtonElement : $("#miningPractice") as HTMLButtonElement).focus();
    },
    destroy() {
      destroyed = true;
      window.clearTimeout(lavaTimer);
      overlay.removeEventListener("keydown", onKeyDown);
      overlay.remove();
    },
  };
}
