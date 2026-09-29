# Draft upstream PR — do not open with placeholders

Title: `Submission: Friend Forge (Token Activity)`

## Summary

Friend Forge is an isometric Rare Friends collecting game. An owned hardwired
Generations NFT is the playable Friend; players spend simulated RF on Iron
Ore, forge SDK-settled artifacts, and fill a twelve-item Collection. This PR
adds `submissions/friend-forge/README.md` with controls, exact odds, source,
playable preview, QA evidence and limitations.

## Links to fill before opening

- Builder/contact: @RomaMartynyuk (add a preferred contact if desired)
- Public source repository: https://github.com/RomaMartynyuk/friend-forge/tree/sdk-integration
- Public preview: https://romamartynyuk.github.io/friend-forge/ (SDK wallet gate loads; eligible-wallet playthrough pending)
- Screenshot or short walkthrough in source repo: [mock-wallet GIF](media/walkthrough-mock.gif)

## Validation

- FriendSDK v0.1.3 `check` and `build` passed.
- Ten local tests passed, including odds, pending play resume and the
  zero-reward redemption guard.
- Official SDK mock-wallet browser test passed at 960 and 360 px.
- Focused desktop and mobile island/Ore Mine/Forge browser checks passed.
- Public deployed loader and main assets return successfully; the FriendSDK
  wallet gate renders. Eligible-wallet gameplay remains to be checked.

## Known limits

Preview economy is simulated. Gold/Diamond are odds previews, Mining Dig
score awards no extra Ore, Community Furnace is local-only, and Reforge is
not an atomic upgrade. Production Rare Friends publication is separate.
