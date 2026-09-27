# Architecture and authority boundary

Friend Forge is one FriendSDK game folder (`games/friend-forge`).

| Layer | Source | Responsibility |
|---|---|---|
| SDK runtime | `index.tsx` | Select Friend, read SDK snapshot, mount game, own canonical sound kit and cinematic result |
| Economy adapter | `game/SdkEconomy.ts` | Translate SDK RF/Ore/inventory/play data; call `buy`, `play`, `settle`, `redeem`; resume a pending play |
| Island UI | `game/FriendForgeGame.ts`, `game/GameMarkup.ts`, CSS | World, A* navigation, colliders, buildings, menus, Collection and Reforge presentation |
| Cosmetic activities | `game/MiningDig*`, `game/CommunityFurnace*`, `game/GlobalVfx.ts`, `game/SoundAtmosphere.ts` | Local score, particles and sound; never mutate SDK rewards |
| Config and art | `game.json`, `assets/` | The twelve configured SDK outcomes, art and visual props |

## One Forge play

`client.read()` → if an unsettled play exists, resume its ID → otherwise
`client.play(1n)` consumes one SDK Ore → `client.settle(play.id)` returns the
outcome ID → adapter maps that ID to an artifact → UI runs its cosmetic
rarity/silhouette/artwork reveal → Collection re-reads the SDK inventory.

The adapter never rolls an item on the client. If `play()` does not return its
record, it reads SDK state and checks for a pending play before allowing any
new action. The cinematic's seeded rarity cycling is presentation only.

## Other actions

- Ore Mine purchase: `canBuy(quantity)` then `buy(quantity)` and `read()`.
- Collection sale: positive-reward items only; re-read inventory, call
  `redeem(outcomeId, quantity)`, then `read()`.
- Reforge: one redeem, one ordinary Iron Ore purchase, one ordinary Forge.
  The steps are **not atomic**; a failure may leave RF or Ore in the wallet.
  The UI shows recovery/sync guidance instead of silently retrying payment.
- Mining Expedition: `buy(2)` purchases two ordinary Iron Ore. The dig map,
  lava and vein score are local presentation; each result still needs one
  normal `play`/`settle`.
- Community Furnace: three local arcade mini-games only. Shared-state
  contributions and global rewards are not implemented.

The game does not modify or extend FriendSDK. The mounted web game is
responsive; menus are viewport-sized and scroll internally. Canonical SDK
sounds lead the procedural atmosphere layer, which starts only after a user
gesture and can be muted independently from ambient pulses.
