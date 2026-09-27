type Options = Readonly<{
  onClose: () => void;
  isPaused: () => boolean;
  playSound: (cue: "select" | "action-start" | "impact" | "reward", volume?: number) => void;
}>;

type Cell = { mine: boolean; revealed: boolean; flagged: boolean; adjacent: number };
const SIZE = 5;
const MINES = 5;
const TOTAL_SAFE = SIZE * SIZE - MINES;

export function mountOreSweepMiniGame(modal: HTMLElement, options: Options) {
  modal.innerHTML = `
    <div class="community-mini-card ore-sweep-card" role="document">
      <header class="community-mini-head">
        <div class="community-mini-kicker">FRIEND FORGE · COMMUNITY FURNACE</div>
        <h2>ORE SWEEP</h2>
        <p class="community-mini-disclaimer">Global contributions were planned here. For now, play three local mini-games — no shared progress, RF or artifact rewards.</p>
      </header>
      <div class="community-mini-body">
        <p class="arcade-game-description">Find every stable ore vein. Numbers show how many unstable pockets touch a tile. The first dig is always safe.</p>
        <div class="arcade-stat-row"><span>SAFE VEINS <b id="oreSweepSafe">0 / ${TOTAL_SAFE}</b></span><span>MARKED <b id="oreSweepMarked">0 / ${MINES}</b></span><span>LOCAL CLEARS <b id="oreSweepWins">0</b></span></div>
        <div class="ore-sweep-grid" id="oreSweepGrid" role="group" aria-label="Five by five ore field"></div>
        <p class="arcade-status" id="oreSweepStatus" role="status" aria-live="polite">Dig a tile to begin. Mark suspected unstable pockets.</p>
        <p class="community-mini-footnote">Local puzzle only · no ore is mined into your FriendSDK inventory</p>
      </div>
      <footer class="community-mini-actions">
        <button id="oreSweepNew" type="button">NEW FIELD</button>
        <button id="oreSweepMode" type="button" aria-pressed="false">MODE: DIG</button>
        <button id="oreSweepClose" type="button">BACK TO ISLAND</button>
      </footer>
    </div>`;

  const grid = modal.querySelector("#oreSweepGrid") as HTMLElement;
  const safeLabel = modal.querySelector("#oreSweepSafe") as HTMLElement;
  const markedLabel = modal.querySelector("#oreSweepMarked") as HTMLElement;
  const winsLabel = modal.querySelector("#oreSweepWins") as HTMLElement;
  const status = modal.querySelector("#oreSweepStatus") as HTMLElement;
  const modeButton = modal.querySelector("#oreSweepMode") as HTMLButtonElement;
  const newButton = modal.querySelector("#oreSweepNew") as HTMLButtonElement;
  const closeButton = modal.querySelector("#oreSweepClose") as HTMLButtonElement;
  let cells: Cell[] = [];
  let phase: "ready" | "playing" | "won" | "lost" = "ready";
  let placed = false;
  let markMode = false;
  let round = 0;
  let wins = 0;
  let open = false;
  let destroyed = false;

  const neighbors = (index: number) => {
    const row = Math.floor(index / SIZE);
    const col = index % SIZE;
    const found: number[] = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const r = row + dr;
        const c = col + dc;
        if ((dr || dc) && r >= 0 && r < SIZE && c >= 0 && c < SIZE) found.push(r * SIZE + c);
      }
    }
    return found;
  };

  function placeMines(firstDig: number) {
    const available = Array.from({ length: SIZE * SIZE }, (_, i) => i).filter(i => i !== firstDig);
    let seed = (0x9e3779b9 ^ (round * 0x85ebca6b) ^ firstDig) >>> 0;
    for (let i = available.length - 1; i > 0; i--) {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      const j = (seed >>> 0) % (i + 1);
      [available[i], available[j]] = [available[j], available[i]];
    }
    for (const index of available.slice(0, MINES)) cells[index].mine = true;
    cells.forEach((cell, index) => {
      cell.adjacent = neighbors(index).filter(other => cells[other].mine).length;
    });
    placed = true;
  }

  function render() {
    const safe = cells.filter(cell => cell.revealed && !cell.mine).length;
    const marked = cells.filter(cell => cell.flagged).length;
    safeLabel.textContent = `${safe} / ${TOTAL_SAFE}`;
    markedLabel.textContent = `${marked} / ${MINES}`;
    winsLabel.textContent = String(wins);
    modeButton.textContent = markMode ? "MODE: MARK" : "MODE: DIG";
    modeButton.setAttribute("aria-pressed", String(markMode));
    [...grid.children].forEach((node, index) => {
      const button = node as HTMLButtonElement;
      const cell = cells[index];
      const exposedMine = cell.mine && (cell.revealed || phase === "lost");
      button.dataset.state = exposedMine ? "mine" : cell.revealed ? "open" : cell.flagged ? "flag" : "covered";
      button.dataset.number = cell.revealed ? String(cell.adjacent) : "";
      button.textContent = exposedMine ? "✖" : cell.flagged ? "⚑" : cell.revealed && cell.adjacent ? String(cell.adjacent) : cell.revealed ? "·" : "◆";
      button.disabled = phase === "won" || phase === "lost" || cell.revealed;
      button.setAttribute("aria-label", `Row ${Math.floor(index / SIZE) + 1}, column ${index % SIZE + 1}: ${exposedMine ? "unstable pocket" : cell.flagged ? "marked" : cell.revealed ? `${cell.adjacent} nearby unstable pockets` : "covered"}`);
    });
  }

  function newField() {
    if (destroyed || options.isPaused()) return;
    round++;
    cells = Array.from({ length: SIZE * SIZE }, () => ({ mine: false, revealed: false, flagged: false, adjacent: 0 }));
    placed = false;
    markMode = false;
    phase = "ready";
    grid.innerHTML = Array.from({ length: SIZE * SIZE }, (_, index) => `<button type="button" data-cell="${index}" aria-label="Covered tile ${index + 1}">◆</button>`).join("");
    status.textContent = "Dig a tile to begin. Mark suspected unstable pockets.";
    render();
  }

  function reveal(index: number) {
    if (cells[index].flagged || cells[index].revealed) return;
    if (!placed) placeMines(index);
    phase = "playing";
    if (cells[index].mine) {
      cells[index].revealed = true;
      phase = "lost";
      status.textContent = "An unstable pocket! The field is exposed. Start a new field to try again.";
      options.playSound("impact", 0.45);
      render();
      return;
    }
    const queue = [index];
    while (queue.length) {
      const current = queue.pop() as number;
      const cell = cells[current];
      if (cell.revealed || cell.flagged || cell.mine) continue;
      cell.revealed = true;
      if (cell.adjacent === 0) queue.push(...neighbors(current));
    }
    if (cells.filter(cell => cell.revealed && !cell.mine).length === TOTAL_SAFE) {
      phase = "won";
      wins++;
      status.textContent = "All stable veins found! A local clear — no ore or RF was added.";
      options.playSound("reward", 0.4);
    } else {
      status.textContent = "Stable vein found. Use the numbers to avoid unstable pockets.";
      options.playSound("select", 0.3);
    }
    render();
  }

  function mark(index: number) {
    const cell = cells[index];
    if (cell.revealed) return;
    const marked = cells.filter(entry => entry.flagged).length;
    if (!cell.flagged && marked >= MINES) {
      status.textContent = `Only ${MINES} unstable pockets are hidden. Unmark a tile first.`;
      return;
    }
    cell.flagged = !cell.flagged;
    status.textContent = cell.flagged ? "Pocket marked. Dig the other tiles." : "Mark removed.";
    options.playSound("select", 0.25);
    render();
  }

  function choose(index: number, forceMark = false) {
    if (destroyed || !open || options.isPaused() || phase === "won" || phase === "lost") return;
    if (forceMark || markMode) mark(index);
    else reveal(index);
  }

  const onGridClick = (event: MouseEvent) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-cell]");
    if (button) choose(Number(button.dataset.cell));
  };
  const onGridContext = (event: MouseEvent) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-cell]");
    if (!button) return;
    event.preventDefault();
    choose(Number(button.dataset.cell), true);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (!open || options.isPaused()) return;
    if (event.key === "Escape") { event.preventDefault(); close(); }
  };

  function close() {
    open = false;
    options.onClose();
  }

  grid.addEventListener("click", onGridClick);
  grid.addEventListener("contextmenu", onGridContext);
  newButton.addEventListener("click", newField);
  modeButton.addEventListener("click", () => {
    if (options.isPaused()) return;
    markMode = !markMode;
    render();
  });
  closeButton.addEventListener("click", close);
  modal.addEventListener("keydown", onKeyDown);
  newField();

  return {
    open() { if (!destroyed) { open = true; modal.classList.add("show"); newButton.focus(); } },
    destroy() {
      destroyed = true;
      open = false;
      modal.removeEventListener("keydown", onKeyDown);
    },
  };
}
