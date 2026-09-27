// Run with FriendSDK v0.1.2 and Playwright installed in the repository.
// The SDK test helper uses a mock wallet and simulated RPC; never a real wallet.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
import { testGame } from "@rarefriends/friendsdk/testing";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const media = join(root, "media");
await mkdir(media, { recursive: true });

await testGame(join(root, "games/friend-forge"), {
  width: 1280,
  height: 900,
  check: async ({ page, game }) => {
    const frame = page.locator(".rf-game-frame");
    await frame.screenshot({ path: join(media, "island-desktop.png") });
    await game.locator("#oreMineLabel").click();
    await game.locator("#oreModal.show").waitFor({ timeoutMs: 12000 });
    await frame.screenshot({ path: join(media, "ore-mine-desktop.png") });
    await game.locator("#closeOre").click();
    await game.locator("#centralForgeLabel").click();
    await game.locator("#forgeModal.show").waitFor({ timeoutMs: 12000 });
    await frame.screenshot({ path: join(media, "central-forge-desktop.png") });
  },
});

await testGame(join(root, "games/friend-forge"), {
  width: 360,
  height: 800,
  check: async ({ page, game }) => {
    const frame = page.locator(".rf-game-frame");
    await frame.screenshot({ path: join(media, "island-mobile.png") });
    await game.locator("#centralForgeLabel").click();
    await game.locator("#forgeModal.show").waitFor({ timeoutMs: 12000 });
    const bounds = await game.locator("#forgeModal .building-card").evaluate((card) => {
      const rect = card.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, width: innerWidth };
    });
    assert(bounds.left >= 0 && bounds.right <= bounds.width + 1 && bounds.top >= 0,
      `Mobile Forge card escaped viewport: ${JSON.stringify(bounds)}`);
    const materials = await game.locator("#forgeModal .forge-material-card").evaluateAll((cards) =>
      cards.map((card) => {
        const rect = card.getBoundingClientRect();
        return { left: rect.left, right: rect.right, width: innerWidth };
      }));
    assert(materials.every((card) => card.left >= 0 && card.right <= card.width + 1),
      `Mobile material card escaped viewport: ${JSON.stringify(materials)}`);
    await frame.screenshot({ path: join(media, "central-forge-mobile.png") });
    await game.locator("#closeForge").click();
    await game.locator("#forgeModal.show").waitFor({ state: "hidden" });
  },
});

console.log("PASS Friend Forge release browser checks; captures in media/");
