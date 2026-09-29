# v1.0 QA report — 2026-09-27

## FriendSDK v0.1.3 hotfix verification — 2026-09-29

The dependency was updated to the official v0.1.3 release archive after
verifying its published SHA-256 checksum. This release fixes owned Friend
discovery on Robinhood mainnet; Friend Forge's economy and outcome table were
not changed. The 10 release tests, `friendsdk check`, and `friendsdk build`
pass with v0.1.3. `friendsdk check` still reports an expected reward of
0.065 RF and a maximum prize of 2 RF.

The automated browser check was not rerun for this hotfix: this checkout does
not include Playwright. A real eligible-wallet discovery check on the public
preview remains necessary after deploying the rebuilt SDK output.

## Automated checks passed

| Check | Result |
|---|---|
| `friendsdk check` (FriendSDK v0.1.2) | PASS; expected reward 0.065 RF, maximum 2 RF |
| `friendsdk build` | PASS |
| Node release tests | 10/10 PASS: odds, pending resume, zero-reward redemption guard, Mining Dig, VFX and audio |
| Official `friendsdk test` at 960 px | PASS; mock wallet, ownership gate, sandbox and browser errors checked |
| Official `friendsdk test` at 360 px | PASS |
| Focused browser QA at 1280 px | PASS: island → Ore Mine → Forge; screenshots captured |
| Focused browser QA at 360 px | PASS: Forge fits viewport, all three material cards fit, footer close button clickable |
| Mock-wallet GIF capture | PASS; 26 real runtime frames assembled into `media/walkthrough-mock.gif` |
| Public Pages smoke check | PASS; SDK runtime and assets return HTTP 200; wallet/Friend gate renders |

The mobile run found and fixed an overflow of Forge material cards in the
narrow SDK viewport. This was a layout-only release fix; odds and SDK calls
were not changed.

## Not yet verified

- A real wallet holding an eligible hardwired Friend on Robinhood mainnet.
- End-to-end playthrough of the public deployment with an eligible wallet.
- Live-chain transactions or receipts. This release targets the simulated
  Vibeathon preview, not production publication.
- Formal TypeScript typecheck and a human audio-mix review on speakers/phone.

## Known limitations

- The island is visually dense at 360 px; buildings remain accessible by
  touch, but their labels are small. A phone-sized real-wallet playtest is
  still required before calling the public demo final.
- Sound settings last for the current mounted session only. FriendSDK's
  sandbox does not provide `localStorage`.
- Only Iron is actionable. Gold/Diamond odds are previews. Community
  Furnace games are local-only, and Mining Dig score pays no extra Ore.
- Reforge is three separate SDK actions and does not guarantee an upgrade.

All screenshots and the GIF use the SDK mock wallet, not a user wallet.
