type Options = Readonly<{
  onClose: () => void;
  isPaused: () => boolean;
  playSound: (cue: "select" | "action-start" | "impact" | "reward", volume?: number) => void;
}>;

const PATTERNS = [[0, 4, 8], [1, 3, 5, 7], [0, 2, 4, 6, 8]] as const;

export function mountHeatWeaveMiniGame(modal: HTMLElement, options: Options) {
  modal.innerHTML = `
    <div class="community-mini-card heat-weave-card" role="document">
      <header class="community-mini-head">
        <div class="community-mini-kicker">FRIEND FORGE · COMMUNITY FURNACE</div>
        <h2>HEAT WEAVE</h2>
        <p class="community-mini-disclaimer">Global contributions were planned here. For now, play three local mini-games — no shared progress, RF or artifact rewards.</p>
      </header>
      <div class="community-mini-body">
        <p class="arcade-game-description">An odd little furnace: touching one rune flips its heat and its four neighbors. Light all nine runes to complete the pattern.</p>
        <div class="arcade-stat-row"><span>LIT RUNES <b id="heatWeaveLit">0 / 9</b></span><span>MOVES <b id="heatWeaveMoves">0</b></span><span>LOCAL BEST <b id="heatWeaveBest">—</b></span></div>
        <div class="heat-weave-grid" id="heatWeaveGrid" role="group" aria-label="Three by three furnace runes"></div>
        <p class="arcade-status" id="heatWeaveStatus" role="status" aria-live="polite">Tap a rune to weave heat through the furnace.</p>
        <p class="community-mini-footnote">Local logic puzzle only · no SDK artifact or RF reward</p>
      </div>
      <footer class="community-mini-actions">
        <button id="heatWeaveNew" type="button">NEW PATTERN</button>
        <button id="heatWeaveReset" type="button">RESET PATTERN</button>
        <button id="heatWeaveClose" type="button">BACK TO ISLAND</button>
      </footer>
    </div>`;

  const grid = modal.querySelector("#heatWeaveGrid") as HTMLElement;
  const litLabel = modal.querySelector("#heatWeaveLit") as HTMLElement;
  const movesLabel = modal.querySelector("#heatWeaveMoves") as HTMLElement;
  const bestLabel = modal.querySelector("#heatWeaveBest") as HTMLElement;
  const status = modal.querySelector("#heatWeaveStatus") as HTMLElement;
  const newButton = modal.querySelector("#heatWeaveNew") as HTMLButtonElement;
  const resetButton = modal.querySelector("#heatWeaveReset") as HTMLButtonElement;
  const closeButton = modal.querySelector("#heatWeaveClose") as HTMLButtonElement;
  let cells = Array<boolean>(9).fill(false);
  let initial = Array<boolean>(9).fill(false);
  let moves = 0;
  let best: number | null = null;
  let patternIndex = -1;
  let solved = false;
  let open = false;
  let destroyed = false;

  function flip(index: number) {
    const row = Math.floor(index / 3);
    const col = index % 3;
    for (const [dr, dc] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const r = row + dr;
      const c = col + dc;
      if (r >= 0 && r < 3 && c >= 0 && c < 3) cells[r * 3 + c] = !cells[r * 3 + c];
    }
  }

  function render() {
    litLabel.textContent = `${cells.filter(Boolean).length} / 9`;
    movesLabel.textContent = String(moves);
    bestLabel.textContent = best === null ? "—" : String(best);
    [...grid.children].forEach((node, index) => {
      const button = node as HTMLButtonElement;
      button.dataset.lit = String(cells[index]);
      button.textContent = cells[index] ? "✦" : "◇";
      button.disabled = solved;
      button.setAttribute("aria-label", `Rune ${index + 1}: ${cells[index] ? "lit" : "unlit"}`);
    });
  }

  function newPattern() {
    if (destroyed || options.isPaused()) return;
    patternIndex = (patternIndex + 1) % PATTERNS.length;
    cells = Array<boolean>(9).fill(true);
    for (const index of PATTERNS[patternIndex]) flip(index);
    initial = [...cells];
    moves = 0;
    solved = false;
    status.textContent = "Light all nine runes. Each tap flips a cross of five (fewer at an edge).";
    options.playSound("action-start", 0.25);
    render();
  }

  function resetPattern() {
    if (destroyed || options.isPaused()) return;
    cells = [...initial];
    moves = 0;
    solved = false;
    status.textContent = "Pattern reset. Try another route through the runes.";
    render();
  }

  function choose(index: number) {
    if (!open || destroyed || options.isPaused() || solved) return;
    flip(index);
    moves++;
    options.playSound("impact", 0.24);
    if (cells.every(Boolean)) {
      solved = true;
      best = best === null ? moves : Math.min(best, moves);
      status.textContent = `All runes lit in ${moves} moves! This clear is local only.`;
      options.playSound("reward", 0.38);
    } else {
      status.textContent = `${cells.filter(Boolean).length} of 9 runes lit. Keep weaving.`;
    }
    render();
  }

  function close() { open = false; options.onClose(); }
  const onGridClick = (event: MouseEvent) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-rune]");
    if (button) choose(Number(button.dataset.rune));
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (open && !options.isPaused() && event.key === "Escape") { event.preventDefault(); close(); }
  };
  grid.innerHTML = Array.from({ length: 9 }, (_, index) => `<button type="button" data-rune="${index}" aria-label="Rune ${index + 1}">◇</button>`).join("");
  grid.addEventListener("click", onGridClick);
  newButton.addEventListener("click", newPattern);
  resetButton.addEventListener("click", resetPattern);
  closeButton.addEventListener("click", close);
  modal.addEventListener("keydown", onKeyDown);
  newPattern();

  return {
    open() { if (!destroyed) { open = true; modal.classList.add("show"); (grid.firstElementChild as HTMLButtonElement)?.focus(); } },
    destroy() {
      destroyed = true;
      open = false;
      modal.removeEventListener("keydown", onKeyDown);
    },
  };
}
