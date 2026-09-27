# Friend Forge v1.0

An isometric Rare Friends game about mining, forging and collecting twelve
artifacts with your Friend. The game uses FriendSDK v0.1.2 for its wallet,
inventory, payments, plays, settlement and canonical Friend identity.

## Play

1. Connect a browser wallet on Robinhood mainnet holding a hardwired
   Generations NFT (generation 1 or higher), then select that Friend. The
   local SDK preview uses simulated balances and results; it does not spend
   real RF or require a transaction signature.
2. Walk with WASD or arrow keys, tap the ground, or click a building label to
   auto-walk there.
3. Buy Iron Ore in **Ore Mine** (1 RF per Ore), then use **Central Forge**.
4. Watch the cosmetic rarity roll and cinematic; the artifact itself comes
   from FriendSDK settlement. Browse the twelve-slot **Collection**.

The Ore Mine also includes Mining Dig. Free practice awards nothing. A paid
expedition buys exactly two Iron Ore for 2 RF through FriendSDK; digging score
is cosmetic, and each Ore is forged through the ordinary SDK flow afterward.
Community Furnace has three local mini-games with no RF or artifact rewards.

## Controls and accessibility

| Action | Desktop | Touch |
|---|---|---|
| Move Friend | WASD / arrows | Tap ground |
| Visit building | Click label | Tap label |
| Mine adjacent tile | Click or WASD / arrows | Tap tile |
| Sound | ENABLE SOUND, then MIX | Same controls |

Menus adapt to desktop and mobile, scroll within the viewport, and reopen at
their headings. Sound starts only after a user gesture. MIX offers shared
volume, mute and optional quiet ambience for the current session. Reduced-motion settings disable
nonessential visual animation.

## What is authoritative

FriendSDK owns RF, Ore, inventory, purchases, play IDs, settlement and
redemption. Iron is the only executable Forge material in v1.0. Gold and
Diamond are labelled odds previews, not purchasable/forgeable tiers. The
roulette, Mine score, VFX, audio, Dice/Lots/Cases and rarity presentation
never choose or upgrade an outcome.

Reforge is an SDK-only **salvage loop**, not a guaranteed rarity upgrade:
sell one redeemable duplicate while keeping one, buy one Iron Ore, then run
the normal Forge. These are separate SDK actions, not an atomic contract
operation. Common artifacts with 0 RF redemption value remain collectibles
and cannot enter that loop. See [economy notes](../../ECONOMY.md).

## Run locally

From the repository root, with Node.js 22+ and FriendSDK v0.1.2:

```sh
npx friendsdk check ./games/friend-forge
npx friendsdk build ./games/friend-forge
npx friendsdk dev ./games/friend-forge --host 0.0.0.0 --port 4173
```

The SDK preview is useful for local QA but is **not** a public deployment.
Refresh the browser after editing source. If port 4173 is in use, stop the old
preview process before starting another.

## Release status

This v1.0 package freezes gameplay at v0.9 and performs documentation and QA.
No new FriendSDK API or contract action is introduced. See
[architecture](../../ARCHITECTURE.md), [QA report](../../QA.md), and
[submission checklist](../../SUBMISSION.md). Public demo and upstream
Vibeathon PR are tracked there until their real URLs are supplied and verified.

Artwork provenance for the twelve artifacts is in
[`assets/artifacts/SOURCE.md`](assets/artifacts/SOURCE.md).
