import { mountCommunityFurnaceMiniGame } from "./CommunityFurnaceMiniGame";
import { mountOreSweepMiniGame } from "./OreSweepMiniGame";
import { mountHeatWeaveMiniGame } from "./HeatWeaveMiniGame";

type ArcadeGame = "keeper" | "sweep" | "weave";
type GameController = { open(): void; destroy(): void };
type Options = Readonly<{
  onClose: () => void;
  isPaused: () => boolean;
  playSound: (cue: "select" | "action-start" | "impact" | "reward", volume?: number) => void;
}>;

const GAMES: readonly { id: ArcadeGame; name: string; line: string }[] = [
  { id: "keeper", name: "FURNACE KEEPER", line: "Timing · 8 strokes" },
  { id: "sweep", name: "ORE SWEEP", line: "Find stable veins" },
  { id: "weave", name: "HEAT WEAVE", line: "Light all runes" },
];

export function mountCommunityFurnaceArcade(modal: HTMLElement, options: Options) {
  let activeId: ArcadeGame | null = null;
  let active: GameController | null = null;
  let destroyed = false;

  function choose(id: ArcadeGame) {
    if (destroyed || options.isPaused() || activeId === id) return;
    active?.destroy();
    activeId = id;
    const gameOptions = {
      ...options,
      onClose: () => {
        modal.classList.remove("show");
        options.onClose();
      },
    };
    active = id === "keeper"
      ? mountCommunityFurnaceMiniGame(modal, gameOptions)
      : id === "sweep"
        ? mountOreSweepMiniGame(modal, gameOptions)
        : mountHeatWeaveMiniGame(modal, gameOptions);

    const tabs = document.createElement("nav");
    tabs.className = "community-arcade-switcher";
    tabs.setAttribute("aria-label", "Community Furnace mini-games");
    tabs.innerHTML = `
      <div class="community-arcade-note"><b>THREE LOCAL GAMES</b><span>Choose one · global contributions are not active</span></div>
      <div class="community-arcade-tabs" role="tablist" aria-label="Choose a mini-game">
        ${GAMES.map(game => `<button type="button" role="tab" data-arcade-game="${game.id}" aria-selected="${game.id === id}" class="${game.id === id ? "is-active" : ""}"><strong>${game.name}</strong><small>${game.line}</small></button>`).join("")}
      </div>`;
    modal.querySelector(".community-mini-head")?.after(tabs);
    tabs.addEventListener("click", event => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-arcade-game]");
      if (button) choose(button.dataset.arcadeGame as ArcadeGame);
    });
    active.open();
  }

  return {
    open() {
      if (destroyed || options.isPaused()) return;
      if (!active) choose("keeper");
      else active.open();
    },
    destroy() {
      destroyed = true;
      active?.destroy();
    },
  };
}
