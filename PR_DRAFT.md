# Draft upstream PR — do not open with placeholders

Title: `Submission: Friend Forge (Character Spotlight)`

## Summary

Friend Forge is an isometric Rare Friends collecting game. An owned hardwired
Generations NFT is the playable Friend; players spend simulated RF on Iron
Ore, forge SDK-settled artifacts, and fill a twelve-item Collection. This PR
adds `submissions/friend-forge/README.md` with controls, exact odds, source,
playable preview, QA evidence and limitations.

## Links to fill before opening

- Builder/contact: @RomaMartynyuk (add a preferred contact if desired)
- Public source repository: https://github.com/RomaMartynyuk/friend-forge/tree/sdk-integration
- Public playable HTTPS preview: PENDING
- Screenshot or short walkthrough in source repo: [mock-wallet GIF](media/walkthrough-mock.gif)

## Validation

- FriendSDK v0.1.2 `check` and `build` passed.
- Ten local tests passed, including odds, pending play resume and the
  zero-reward redemption guard.
- Official SDK mock-wallet browser test passed at 960 and 360 px.
- Focused desktop and mobile island/Ore Mine/Forge browser checks passed.
- Real-wallet and deployed-site checks remain pending until the links above
  are live. State their actual result before posting.

## Known limits

Preview economy is simulated. Gold/Diamond are odds previews, Mining Dig
score awards no extra Ore, Community Furnace is local-only, and Reforge is
not an atomic upgrade. Production Rare Friends publication is separate.
