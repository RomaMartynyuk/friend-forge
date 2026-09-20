# Friend Forge v0.3.2 — SDK Island Port

This checkpoint moves the real Friend Forge island into the FriendSDK game sandbox.

## Included

- current Friend Forge island and bridge;
- Ore Mine, Central Forge, Collection, Reforge and Community Furnace;
- all current decorative trees and flowers;
- WASD / arrows;
- tap/click-to-walk;
- building-label auto-navigation using the existing A* pathfinder;
- building colliders;
- dynamic building/Friend depth sorting;
- tree/Friend depth sorting;
- responsive building menus;
- current demo Ore → Forge → Collection loop;
- selected Friend ID displayed in the HUD;
- FriendSDK `paused` support.

## SDK bridge

`index.tsx` is intentionally thin:

1. receives `friendId`, `client`, and `paused`;
2. performs the required initial `client.read()`;
3. verifies the snapshot belongs to the selected Friend;
4. mounts the existing Friend Forge renderer;
5. passes `friendId` and a live `paused` accessor into the game engine.

When FriendSDK pauses the game, movement, pointer input, auto-navigation, and menu interactions are blocked.

## Scope of v0.3.2

Still intentionally **not integrated**:

- canonical Rare Friend NFT sprite rendering;
- SDK `buy()` for Ore;
- SDK `play()` / `settle()` for Forge randomness;
- SDK inventory as the Collection source of truth;
- live/on-chain economy.

The current demo economy is in-memory only. Browser `localStorage` was removed because the FriendSDK sandbox does not expose durable browser storage.

## Run

From the repository root:

```bash
npx friendsdk check ./games/friend-forge
npx friendsdk build ./games/friend-forge
npx friendsdk dev ./games/friend-forge --host 0.0.0.0 --port 4173
```

In Codespaces, keep port 4173 Public.

## Next checkpoints

- v0.3.3 — canonical selected Rare Friend sprite
- v0.3.4 — SDK Ore purchase + play/settle Forge + SDK inventory
- v0.3.5 — deploy `.friendsdk/` to GitHub Pages

## v0.3.2.2 — IIFE-safe inline assets

The FriendSDK game bundle is currently compiled as IIFE. The previous
`new URL(..., import.meta.url)` asset approach is therefore not compatible
with this build target.

This version embeds the scene PNG files directly in `GameMarkup.ts` as
`data:image/png;base64,...` URLs.

This removes runtime asset-path resolution from the checkpoint and makes the
same build usable in FriendSDK dev preview, generated `.friendsdk/`,
Codespaces, and GitHub Pages.

The original PNG files remain under `assets/` as source files.
