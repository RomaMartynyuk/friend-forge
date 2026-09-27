# Artifact artwork source — v0.3.7.1

The 12 assets were re-extracted from the owner-approved Friend Forge artwork
sheet at its original resolution.

HQ pipeline:
- border-connected background removal;
- feathered alpha edge;
- LANCZOS upscale to a 512×512 transparent master;
- light unsharp/sharpness recovery;
- source master saved as PNG;
- runtime copy encoded as WebP quality 98.

No NEAREST upscaling is used.

Undiscovered silhouettes are generated in CSS from the same HQ artwork, so the
runtime no longer carries a second set of raster silhouette files.
