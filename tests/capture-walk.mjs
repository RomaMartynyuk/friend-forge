// Reproducible mock-wallet UI clip; no real transactions or public identity.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdir } from "node:fs/promises";
import { testGame } from "@rarefriends/friendsdk/testing";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const frames = process.env.FRIEND_FORGE_FRAMES || join(root, "media/frames");
await mkdir(frames, { recursive: true });

await testGame(join(root, "games/friend-forge"), {
  width: 960,
  height: 800,
  check: async ({ page, game }) => {
    const frame = page.locator(".rf-game-frame");
    await frame.screenshot({ path: join(frames, "frame-000.png") });
    await game.locator("#oreMineLabel").click();
    for (let index = 1; index <= 25; index++) {
      await page.waitForTimeout(95);
      await frame.screenshot({ path: join(frames, `frame-${String(index).padStart(3, "0")}.png`) });
    }
    await game.locator("#oreModal.show").waitFor({ timeoutMs: 12000 });
  },
});

console.log(`PASS mock-wallet walk capture: ${frames}`);
