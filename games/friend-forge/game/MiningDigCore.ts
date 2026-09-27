export type MineTileKind = "stone" | "iron" | "rich-iron" | "deep-iron" | "lava";
export type MineTile = { kind: MineTileKind; visible: boolean; dug: boolean };
export type MinePoint = { x: number; y: number };
export type MiningAction = { x: number; y: number };
export type MiningRun = {
  seed: number;
  width: number;
  height: number;
  tiles: MineTile[];
  player: MinePoint;
  previous: MinePoint;
  digsLeft: number;
  maxDepth: number;
  blocksMined: number;
  lavaTouches: number;
  ironFragments: number;
  actions: MiningAction[];
  ended: boolean;
};

export const MINE_WIDTH = 9;
export const MINE_HEIGHT = 13;
export const RUN_DIGS = 28;
export const LAVA_DIG_PENALTY = 3;
export const IRON_FRAGMENT_SCORE = Object.freeze({ iron: 1, "rich-iron": 3, "deep-iron": 5 });

function randomSource(seed: number) {
  let state = (seed >>> 0) || 0x61c88647;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

export function generateMine(seed: number): MineTile[] {
  const random = randomSource(seed);
  const tiles: MineTile[] = Array.from({ length: MINE_WIDTH * MINE_HEIGHT }, () => ({ kind: "stone", visible: false, dug: false }));
  const index = (x: number, y: number) => y * MINE_WIDTH + x;

  function placeVein(kind: MineTileKind, minDepth: number, maxDepth: number, length: number) {
    let anchor: MinePoint | null = null;
    for (let attempt = 0; attempt < 80 && !anchor; attempt++) {
      const x = Math.floor(random() * MINE_WIDTH);
      const y = minDepth + Math.floor(random() * (maxDepth - minDepth + 1));
      if (tiles[index(x, y)].kind === "stone") anchor = { x, y };
    }
    if (!anchor) return;
    tiles[index(anchor.x, anchor.y)].kind = kind;
    const vein = [anchor];
    for (let count = 1; count < length; count++) {
      const candidates = vein.flatMap(point => [
        { x: point.x - 1, y: point.y }, { x: point.x + 1, y: point.y },
        { x: point.x, y: point.y - 1 }, { x: point.x, y: point.y + 1 },
      ]).filter(point => point.x >= 0 && point.x < MINE_WIDTH && point.y >= minDepth && point.y <= maxDepth && tiles[index(point.x, point.y)].kind === "stone");
      if (!candidates.length) break;
      const next = candidates[Math.floor(random() * candidates.length)];
      tiles[index(next.x, next.y)].kind = kind;
      vein.push(next);
    }
  }

  // Hazard density rises with depth. Veins are written as connected random walks.
  placeVein("lava", 4, 7, 2);
  for (let i = 0; i < 5; i++) placeVein("lava", 7, 12, 2 + Math.floor(random() * 2));
  placeVein("deep-iron", 9, 12, 2);
  if (random() < 0.18) placeVein("deep-iron", 9, 12, 3);
  placeVein("rich-iron", 5, 11, 2);
  if (random() < 0.55) placeVein("rich-iron", 5, 11, 2);
  for (let i = 0; i < 3; i++) placeVein("iron", 1, 7, 2 + Math.floor(random() * 2));

  tiles[index(4, 0)].dug = true;
  return tiles;
}

export function createMiningRun(seed: number): MiningRun {
  const run: MiningRun = {
    seed: seed >>> 0,
    width: MINE_WIDTH,
    height: MINE_HEIGHT,
    tiles: generateMine(seed),
    player: { x: 4, y: 0 },
    previous: { x: 4, y: 0 },
    digsLeft: RUN_DIGS,
    maxDepth: 0,
    blocksMined: 0,
    lavaTouches: 0,
    ironFragments: 0,
    actions: [],
    ended: false,
  };
  revealAdjacent(run);
  return run;
}

function revealAdjacent(run: MiningRun) {
  for (const { x, y } of [run.player, { x: run.player.x - 1, y: run.player.y }, { x: run.player.x + 1, y: run.player.y }, { x: run.player.x, y: run.player.y - 1 }, { x: run.player.x, y: run.player.y + 1 }]) {
    if (x >= 0 && x < run.width && y >= 0 && y < run.height) run.tiles[y * run.width + x].visible = true;
  }
}

export type MiningStep = "invalid" | "moved" | "mined" | "lava" | "finished";

export function stepMiningRun(run: MiningRun, x: number, y: number): MiningStep {
  if (run.ended || run.digsLeft <= 0) return "finished";
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= run.width || y < 0 || y >= run.height || Math.abs(x - run.player.x) + Math.abs(y - run.player.y) !== 1) return "invalid";
  const tile = run.tiles[y * run.width + x];
  run.actions.push({ x, y });
  if (tile.kind === "lava") {
    tile.visible = true;
    run.player = { ...run.previous };
    run.previous = { ...run.player };
    run.digsLeft = Math.max(0, run.digsLeft - LAVA_DIG_PENALTY);
    run.lavaTouches++;
    revealAdjacent(run);
    if (run.digsLeft === 0) run.ended = true;
    return "lava";
  }
  run.previous = { ...run.player };
  run.player = { x, y };
  if (tile.dug) {
    revealAdjacent(run);
    return "moved";
  }
  tile.dug = true;
  run.digsLeft--;
  run.blocksMined++;
  run.maxDepth = Math.max(run.maxDepth, y);
  if (tile.kind === "iron" || tile.kind === "rich-iron" || tile.kind === "deep-iron") run.ironFragments += IRON_FRAGMENT_SCORE[tile.kind];
  revealAdjacent(run);
  if (run.digsLeft === 0) run.ended = true;
  return "mined";
}

export function cashOutMiningRun(run: MiningRun) {
  run.ended = true;
}
