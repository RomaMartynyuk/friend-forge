export type ForgeMaterialId = "iron" | "gold" | "diamond";

export type ForgeRarity =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary"
  | "mythic";

export type ForgeMaterialProfile = Readonly<{
  id: ForgeMaterialId;
  label: string;
  priceRf: number;
  forgeable: boolean;
  tone: string;
  tagline: string;
  rule: string;
  compareLabel: string;
  oddsBps: Readonly<Record<ForgeRarity, number>>;
}>;

export const FORGE_RARITIES: readonly ForgeRarity[] = Object.freeze([
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
  "mythic",
]);

export const FORGE_MATERIALS: Readonly<
  Record<ForgeMaterialId, ForgeMaterialProfile>
> = Object.freeze({
  iron: Object.freeze({
    id: "iron",
    label: "Iron",
    priceRf: 1,
    forgeable: true,
    tone: "STANDARD RNG",
    tagline: "Baseline Forge profile",
    rule: "Standard Friend Forge distribution.",
    compareLabel: "BASE PROFILE",
    oddsBps: Object.freeze({
      common: 5000,
      uncommon: 2700,
      rare: 1400,
      epic: 600,
      legendary: 250,
      mythic: 50,
    }),
  }),

  gold: Object.freeze({
    id: "gold",
    label: "Gold",
    priceRf: 3,
    forgeable: false,
    tone: "BOOSTED RNG",
    tagline: "Common chance reduced",
    rule:
      "Common loses 20 percentage points. Those 20 points are redistributed proportionally across Uncommon → Mythic.",
    compareLabel: "VS IRON · COMMON −20pp",
    oddsBps: Object.freeze({
      common: 3000,
      uncommon: 3780,
      rare: 1960,
      epic: 840,
      legendary: 350,
      mythic: 70,
    }),
  }),

  diamond: Object.freeze({
    id: "diamond",
    label: "Diamond",
    priceRf: 5,
    forgeable: false,
    tone: "HIGH RNG",
    tagline: "Rare tiers heavily boosted",
    rule:
      "From Gold: Common loses another 20 percentage points and Uncommon loses 10. Those 30 points are redistributed proportionally across Rare → Mythic.",
    compareLabel: "VS GOLD · COMMON −20pp · UNCOMMON −10pp",
    oddsBps: Object.freeze({
      common: 1000,
      uncommon: 2780,
      rare: 3786,
      epic: 1623,
      legendary: 676,
      mythic: 135,
    }),
  }),
});

export function forgeOddsPercent(profile: ForgeMaterialProfile) {
  return Object.freeze(
    Object.fromEntries(
      FORGE_RARITIES.map((rarity) => [
        rarity,
        profile.oddsBps[rarity] / 100,
      ])
    ) as Record<ForgeRarity, number>
  );
}

export function verifyForgeProfiles() {
  for (const profile of Object.values(FORGE_MATERIALS)) {
    const total = Object.values(profile.oddsBps)
      .reduce((sum, value) => sum + value, 0);

    if (total !== 10_000) {
      throw new Error(`${profile.label} Forge odds must equal 10,000 bps.`);
    }
  }
}

verifyForgeProfiles();
