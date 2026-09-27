import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createFriendForgeEconomy } from "../games/friend-forge/game/SdkEconomy.ts";

const game = JSON.parse(readFileSync(new URL("../games/friend-forge/game.json", import.meta.url), "utf8"));

test("configured odds and redemption value stay frozen", () => {
  assert.equal(game.price, "1000000000000000000");
  assert.equal(game.outcomes.length, 12);
  assert.equal(game.outcomes.reduce((sum, outcome) => sum + outcome.chanceBps, 0), 10000);
  const expected = game.outcomes.reduce((sum, outcome) => sum + BigInt(outcome.reward) * BigInt(outcome.chanceBps), 0n) / 10000n;
  assert.equal(expected, 65000000000000000n);
  assert.equal(Math.max(...game.outcomes.map((outcome) => Number(BigInt(outcome.reward) / 10n ** 18n))), 2);
});

test("pending Forge resumes settlement without a second play", async () => {
  let playCalls = 0;
  let settleCalls = 0;
  const inventory = Array(12).fill(0n);
  let pending = true;
  const snapshot = () => ({
    mode: "preview", friendId: 2728n, rfBalance: 20n * 10n ** 18n,
    consumables: 1n, stake: 0n, freeStake: 0n, reservedPlays: 0n,
    rewardLiability: 0n, inventory: [...inventory],
    plays: [{ id: 7n, outcomeId: pending ? null : 4 }],
  });
  const client = {
    read: async () => snapshot(),
    canBuy: async () => true,
    buy: async () => {},
    play: async () => { playCalls++; return []; },
    settle: async (id) => {
      settleCalls++;
      pending = false;
      inventory[3]++;
      return { id, outcomeId: 4 };
    },
    redeem: async () => {},
  };
  const economy = createFriendForgeEconomy(client, snapshot());
  const result = await economy.forge();
  assert.equal(playCalls, 0);
  assert.equal(settleCalls, 1);
  assert.equal(result.status, "settled");
  assert.equal(result.artifact.name, "Knight Sword");
  assert.equal(result.state.inventory["knight-sword"], 1);
});

test("zero-reward collectibles cannot be redeemed", async () => {
  const inventory = Array(12).fill(0n);
  inventory[0] = 2n;
  const snapshot = {
    mode: "preview", friendId: 2728n, rfBalance: 0n,
    consumables: 0n, stake: 0n, freeStake: 0n, reservedPlays: 0n,
    rewardLiability: 0n, inventory, plays: [],
  };
  let redeemed = false;
  const economy = createFriendForgeEconomy({
    read: async () => snapshot,
    redeem: async () => { redeemed = true; },
  }, snapshot);
  await assert.rejects(() => economy.redeem("rusty-spoon", 1), /collectible only/);
  assert.equal(redeemed, false);
});
