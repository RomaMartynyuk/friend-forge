# Friend Forge — Vibeathon release candidate

Friend Forge is a Rare Friends isometric collecting game. Mine or buy Iron
Ore, forge one artifact through FriendSDK, and complete a twelve-item
Collection. This repository contains the v1.0 feature freeze of the
game, documentation and reproducible QA tests.

Start with the [game README](games/friend-forge/README.md). The
[architecture](ARCHITECTURE.md) and [economy](ECONOMY.md) documents distinguish
SDK-authoritative actions from cosmetic presentation.

```sh
npm ci
npm test
npm run check:game
npm run build:game
npx friendsdk dev ./games/friend-forge --host 0.0.0.0 --port 4173
```

The SDK local preview is simulated. Publish only the generated FriendSDK build
from the dedicated `gh-pages` branch, never the legacy root `index.html`. The expected
URL is `https://romamartynyuk.github.io/friend-forge/`, but it must be tested
with an eligible Friend before being advertised as playable. The public
preview and upstream Vibeathon PR are **not yet verified**; see
[submission status](SUBMISSION.md). Do not present this local preview as a
public deployment.

Mock-wallet QA captures: [island](media/island-desktop.png),
[Ore Mine](media/ore-mine-desktop.png),
[Central Forge](media/central-forge-desktop.png), and
[short UI GIF](media/walkthrough-mock.gif). They show the test fixture, not a
real-wallet public session.
