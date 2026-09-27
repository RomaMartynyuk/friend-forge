# Friend Forge

**Builder / contact:** [@RomaMartynyuk](https://github.com/RomaMartynyuk).

**Category:** Character Spotlight.

**One sentence:** Explore an isometric island with your own Rare Friend, buy
Iron Ore with simulated RF, forge SDK-settled artifacts and fill a twelve-item
Collection.

**Source:** [RomaMartynyuk/friend-forge (`sdk-integration`)](https://github.com/RomaMartynyuk/friend-forge/tree/sdk-integration) — code, assets,
economy explanation, credits and setup instructions.

**Playable preview:** [Friend Forge on GitHub Pages](https://romamartynyuk.github.io/friend-forge/).
The public FriendSDK loader and assets were checked; full gameplay requires an
eligible browser wallet and has not yet been verified in this release QA.

**Requirements:** A browser wallet on Robinhood mainnet holding a hardwired
Generations NFT of generation 1 or higher. Preview RF, Ore and results are
simulated; no real RF funding or transaction signature is needed to play.

**Stack:** FriendSDK v0.1.2, TypeScript/React, HTML/CSS/canvas, canonical
Friend sprites and sounds. Local run: `npx friendsdk check
./games/friend-forge`, `npx friendsdk build ./games/friend-forge`, then
`npx friendsdk dev ./games/friend-forge --host 0.0.0.0 --port 4173`.

**How to play:** Select your Friend. Move with WASD/arrows or tap the island;
click/tap building labels to auto-walk. At Ore Mine, buy Iron Ore for 1 RF
each. At Central Forge, spend one Ore per ordinary SDK play. The cinematic
reveals the SDK-settled artifact; Collection tracks twelve items and
duplicates. Mining Dig has free practice or a 2 RF expedition that buys two
ordinary Iron Ore; dig score is cosmetic. Reforge is a salvage loop (sell a
redeemable duplicate, buy one Iron, forge with unchanged odds). Community
Furnace has three local mini-games with no economy rewards. MIX controls
volume/mute/ambience.

**Odds and RF rewards:** Common 50% → 0 RF; Uncommon 27% → 0.05 RF; Rare
14% → 0.10 RF; Epic 6% → 0.25 RF; Legendary 2.5% → 0.50 RF; Mythic 0.5%
→ 2 RF. Expected redemption 0.065 RF per Forge, maximum 2 RF. Gold and
Diamond are locked previews. Zero-reward artifacts are collectibles and
cannot be redeemed. See the source repository's `ECONOMY.md` for exact
outcome weights and caveats.

**Checks:** FriendSDK check/build; 10 unit tests; official mock-wallet
browser checks at 960/360 px; focused island/Ore Mine/Forge checks at desktop
and mobile. The public host loads the SDK wallet gate and main assets; an
eligible-wallet end-to-end playthrough remains outstanding.

**Known limitations:** Simulated progress lasts for the SDK preview session.
No live RF transfer, Gold/Diamond Forge tier, global Furnace state, or
atomic Reforge action. Mining score never awards extra Ore. The island is
visually dense at 360 px; touch labels require a real-device review.

**Credits:** Canonical Friend identity and sound cues come from FriendSDK.
The twelve artifact assets derive from the project owner's approved artwork
sheet; provenance is documented in `assets/artifacts/SOURCE.md` in the source
repository. All other presentation is original to Friend Forge.
