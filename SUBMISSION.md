# Rare Friends Vibeathon submission status

Target: [spokesz/rarefriends-vibeathon](https://github.com/spokesz/rarefriends-vibeathon/).
The [official instructions](https://github.com/spokesz/rarefriends-vibeathon/#how-to-submit)
require one `submissions/friend-forge/README.md` PR, a public source repository,
and a **public playable preview** for games by September 30, 2026 (exact cutoff
time/timezone TBA). A browser wallet on Robinhood mainnet holding an eligible
hardwired Generations NFT is required even in the simulated preview.

## Current status

- Feature freeze, README, architecture/economy notes, SDK validation, desktop
  and mobile mock-wallet browser QA: complete.
- Screenshots and a short mock-wallet UI GIF: complete; see `media/`.
- Public source repository: [RomaMartynyuk/friend-forge](https://github.com/RomaMartynyuk/friend-forge/tree/sdk-integration).
- A dedicated `gh-pages` branch contains the generated SDK build. Its Pages
  deployment success remains to be verified.
- Public playable URL, real-wallet playtest and upstream PR: **pending**.
- Builder handle: `@RomaMartynyuk`; preferred contact details, if any, remain
  the builder's choice.

## Publish a simulated preview

The official [FriendSDK hosting guide](https://github.com/spokesz/friendsdk/#build-and-share-a-preview)
allows GitHub Pages. The generated contents of
`games/friend-forge/.friendsdk/` belong at the root of a dedicated `gh-pages`
branch, with `.nojekyll`. Configure Pages source as **Deploy from a branch**,
branch `gh-pages`, folder `/(root)`. Do not publish the source repository root:
its legacy `index.html` is the old standalone prototype. Preserve the SDK
ownership gate and sandbox CSP; do not substitute the test harness's mock wallet.
Verify `https://romamartynyuk.github.io/friend-forge/` with an eligible Friend
in a browser wallet, then place the verified URL in the draft submission README
and PR description.

The upstream PR should copy **only** `submissions/friend-forge/README.md` into
the Vibeathon repository, replacing its clearly marked placeholders. The
source code, art and media should remain in the builder's public source repo.
The upstream repo does not host this game's source or generated preview.

Official Rare Friends production publication is a separate review and is
**not** accomplished by a Vibeathon PR.
