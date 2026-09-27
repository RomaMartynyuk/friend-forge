# Release media

These are captures of the real FriendSDK v0.1.2 runtime in its **automated
mock-wallet, simulated-economy test fixture**. They are not evidence of a
real-wallet playthrough or a publicly deployed preview.

- `island-desktop.png` — island and navigation, 1280 px browser QA.
- `ore-mine-desktop.png` — Ore Mine order view.
- `central-forge-desktop.png` — authoritative-odds Forge view.
- `island-mobile.png` — 360 px mobile QA.
- `central-forge-mobile.png` — narrow-screen Forge layout.
- `walkthrough-mock.gif` — short captured mock-wallet island-to-Mine UI clip.

The `desktop-qa.png` and `mobile-qa.png` files are the SDK CLI's own initial
screenshots. `tests/browser-release.mjs` makes the more focused captures and
`tests/capture-walk.mjs` records the frames for the GIF. None of the captures
uses a real wallet or changes RF on chain.
