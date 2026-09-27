# Economy and odds — v1.0

`games/friend-forge/game.json` is the authoritative outcome configuration.
One **Iron Ore costs 1 RF**; one normal Forge play consumes one Iron Ore. Gold
and Diamond cards are previews only and cannot execute SDK plays in v1.0.

| Rarity | Configured chance | Redemption per artifact |
|---|---:|---:|
| Common | 50.00% | 0 RF |
| Uncommon | 27.00% | 0.05 RF |
| Rare | 14.00% | 0.10 RF |
| Epic | 6.00% | 0.25 RF |
| Legendary | 2.50% | 0.50 RF |
| Mythic | 0.50% | 2.00 RF |

Each rarity except Mythic has multiple distinct artifacts. The table sums
their outcome basis points; `game.json` sums to 10,000. The configured
expected redemption value is **0.065 RF per play** and the maximum single
redemption is **2 RF**. This is not a promise of player profit: most artifacts
are collectibles, and purchasing Ore costs 1 RF. The SDK check command
independently reports the same expected and maximum rewards in base units.

Mining Dig has no additional payout. Free practice spends and awards nothing.
A paid expedition buys **2 Iron Ore for 2 RF** via the SDK; reaching rich veins
does not award extra Ore or alter Forge odds. Lava only costs digs. The player
can Forge the purchased Ore afterward using normal SDK plays.

Collection sale uses `client.redeem` only for positive-reward outcomes and
refreshes the SDK wallet afterward. Common 0-RF artifacts cannot be sold or
used by the current Reforge salvage path. Reforge does **not** upgrade or
guarantee rarity: Dice, Lots and Cases are distinct presentations of the same
ordinary Iron odds. Community Furnace mini-games do not pay RF or artifacts.

Preview balances, inventory and outcomes are simulated by FriendSDK's local
preview. No client-side UI count is treated as a wallet or settlement source.
