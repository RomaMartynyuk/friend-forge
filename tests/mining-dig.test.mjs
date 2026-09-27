import test from "node:test";
import assert from "node:assert/strict";
import {
  createMiningRun, generateMine, stepMiningRun, cashOutMiningRun,
  IRON_FRAGMENT_SCORE, MINE_WIDTH, MINE_HEIGHT, RUN_DIGS,
} from "../games/friend-forge/game/MiningDigCore.ts";

function neighbors(run, point) {
  return [[point.x + 1, point.y], [point.x - 1, point.y], [point.x, point.y + 1], [point.x, point.y - 1]]
    .filter(([x, y]) => x >= 0 && x < run.width && y >= 0 && y < run.height)
    .map(([x, y]) => ({ x, y, index: y * run.width + x }))
    .filter(cell => run.tiles[cell.index].kind !== "lava");
}

test("vein score is cosmetic iron only", () => {
  assert.deepEqual(IRON_FRAGMENT_SCORE, { iron: 1, "rich-iron": 3, "deep-iron": 5 });
  assert.deepEqual(generateMine(123), generateMine(123), "seed should generate a deterministic presentation map");
});

test("runs use 28 digs; lava is unmineable and costs at most three digs", () => {
  const run = createMiningRun(42);
  assert.equal(run.digsLeft, RUN_DIGS);
  assert.equal(run.tiles.length, MINE_WIDTH * MINE_HEIGHT);
  const first = [
    { x: 3, y: 0 }, { x: 5, y: 0 }, { x: 4, y: 1 },
  ].find(point => run.tiles[point.y * run.width + point.x].kind !== "lava");
  assert.equal(stepMiningRun(run, first.x, first.y), "mined");
  assert.equal(run.digsLeft, RUN_DIGS - 1);
  const previous = { ...run.previous };
  const lavaX = first.x;
  const lavaY = first.y + 1;
  run.tiles[lavaY * run.width + lavaX].kind = "lava";
  const lavaDigs = run.digsLeft;
  assert.equal(stepMiningRun(run, lavaX, lavaY), "lava");
  assert.equal(run.digsLeft, lavaDigs - 3);
  assert.deepEqual(run.player, previous);
  assert.equal(run.tiles[lavaY * run.width + lavaX].dug, false);
  assert.equal(stepMiningRun(run, 8, 12), "invalid");
  cashOutMiningRun(run);
  assert.equal(stepMiningRun(run, 4, 0), "finished");
});

test("iron is shallower; rich and deep iron and lava trend deeper", () => {
  const depths = { iron: [], "rich-iron": [], "deep-iron": [], lava: [] };
  for (let seed = 1; seed <= 200; seed++) {
    generateMine(seed).forEach((tile, index) => {
      if (tile.kind in depths) depths[tile.kind].push(Math.floor(index / MINE_WIDTH));
    });
  }
  const mean = values => values.reduce((a, b) => a + b, 0) / values.length;
  assert.ok(mean(depths.iron) < mean(depths["rich-iron"]));
  assert.ok(mean(depths["rich-iron"]) < mean(depths["deep-iron"]));
  assert.ok(mean(depths.iron) < mean(depths.lava));
});

test("mining never itself creates Ore or artifacts", () => {
  const run = createMiningRun(7);
  for (let i = 0; i < 10 && !run.ended; i++) {
    const next = neighbors(run, run.player)[0];
    if (!next) break;
    stepMiningRun(run, next.x, next.y);
  }
  assert.equal("ore" in run, false);
  assert.equal("inventory" in run, false);
  assert.equal("outcomeId" in run, false);
});
