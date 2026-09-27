export type ArtifactRarity =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary"
  | "mythic";

export type ArtifactDefinition = Readonly<{
  id: string;
  name: string;
  rarity: ArtifactRarity;
  icon: string;
  desc: string;
}>;

export const ARTIFACTS: readonly ArtifactDefinition[] = Object.freeze([
  { id: "rusty-spoon", name: "Rusty Spoon", rarity: "common", icon: "🥄", desc: "Just a spoon... but it’s a start." },
  { id: "bent-dagger", name: "Bent Dagger", rarity: "common", icon: "🗡️", desc: "Still sharp enough." },
  { id: "old-pickaxe", name: "Old Pickaxe", rarity: "common", icon: "⛏️", desc: "Mining history in your hands." },

  { id: "knight-sword", name: "Knight Sword", rarity: "uncommon", icon: "⚔️", desc: "A reliable companion." },
  { id: "friend-shield", name: "Friend Shield", rarity: "uncommon", icon: "🛡️", desc: "Protection for friends." },

  { id: "crystal-blade", name: "Crystal Blade", rarity: "rare", icon: "💎", desc: "Shines with inner light." },
  { id: "moon-hammer", name: "Moon Hammer", rarity: "rare", icon: "🔨", desc: "The power of the moon." },

  { id: "neon-katana", name: "Neon Katana", rarity: "epic", icon: "⚡", desc: "Slice the darkness." },
  { id: "arcane-staff", name: "Arcane Staff", rarity: "epic", icon: "✦", desc: "Knowledge in motion." },

  { id: "golden-friend-hammer", name: "Golden Friend Hammer", rarity: "legendary", icon: "🔨", desc: "Built on friendship." },
  { id: "celestial-blade", name: "Celestial Blade", rarity: "legendary", icon: "✧", desc: "For a brighter tomorrow." },

  { id: "the-first-hammer", name: "The First Hammer", rarity: "mythic", icon: "◆", desc: "Where it all began." },
]);

// Mirrors game.json outcome order and reward strings. Zero-value items are collectibles.
const REWARD_WEI_BY_OUTCOME = Object.freeze([
  0n, 0n, 0n,
  50000000000000000n, 50000000000000000n,
  100000000000000000n, 100000000000000000n,
  250000000000000000n, 250000000000000000n,
  500000000000000000n, 500000000000000000n,
  2000000000000000000n,
]);

export function artifactRewardRf(artifactId: string) {
  const index = ARTIFACTS.findIndex((artifact) => artifact.id === artifactId);
  return index < 0 ? 0 : Number(REWARD_WEI_BY_OUTCOME[index]) / 1e18;
}

type SdkGamePlay = Readonly<{
  id: bigint;
  outcomeId: number | null;
}>;

type SdkGameSnapshot = Readonly<{
  mode: "preview" | "chain";
  friendId: bigint;
  rfBalance: bigint;
  consumables: bigint;
  stake: bigint;
  freeStake: bigint;
  reservedPlays: bigint;
  rewardLiability: bigint;
  inventory: readonly bigint[];
  plays: readonly SdkGamePlay[];
}>;

type SdkGameClient = Readonly<{
  mode: "preview" | "chain";
  read(): Promise<SdkGameSnapshot>;
  canBuy(quantity: bigint): Promise<boolean>;
  buy(quantity: bigint): Promise<void>;
  play(quantity?: bigint): Promise<readonly SdkGamePlay[]>;
  settle(playId: bigint): Promise<SdkGamePlay>;
  redeem(outcomeId: number, quantity: bigint): Promise<void>;
}>;

const RF = 10n ** 18n;

export type FriendForgeEconomyState = Readonly<{
  mode: "preview" | "chain";
  rf: number;
  ore: number;
  inventory: Readonly<Record<string, number>>;
  totalForges: number;
  pendingPlayId: bigint | null;
}>;

export type FriendForgeSettledReward = Readonly<{
  status: "settled";
  artifact: ArtifactDefinition;
  playId: bigint;
  outcomeId: number;
  duplicate: boolean;
  state: FriendForgeEconomyState;
}>;

export type FriendForgePendingResult = Readonly<{
  status: "pending";
  playId: bigint;
  state: FriendForgeEconomyState;
}>;

export type FriendForgeResult =
  | FriendForgeSettledReward
  | FriendForgePendingResult;

export type FriendForgeEconomyBridge = Readonly<{
  initial: FriendForgeEconomyState;
  read(): Promise<FriendForgeEconomyState>;
  buy(quantity: number): Promise<FriendForgeEconomyState>;
  forge(): Promise<FriendForgeResult>;
  redeem(artifactId: string, quantity: number): Promise<FriendForgeEconomyState>;
}>;

function rfToNumber(value: bigint) {
  const whole = value / RF;
  const fraction = value % RF;
  return Number(whole) + Number(fraction) / 1e18;
}

function countToNumber(value: bigint) {
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  return Number(value > max ? max : value);
}

function inventoryFromSnapshot(snapshot: SdkGameSnapshot) {
  const inventory: Record<string, number> = {};

  ARTIFACTS.forEach((artifact, index) => {
    inventory[artifact.id] = countToNumber(snapshot.inventory[index] ?? 0n);
  });

  return inventory;
}

function firstPendingPlay(snapshot: SdkGameSnapshot) {
  return snapshot.plays.find((play) => play.outcomeId === null) ?? null;
}

function normalizeSnapshot(
  snapshot: SdkGameSnapshot
): FriendForgeEconomyState {
  const inventory = inventoryFromSnapshot(snapshot);

  return Object.freeze({
    mode: snapshot.mode,
    rf: Math.max(0, rfToNumber(snapshot.rfBalance)),
    ore: Math.max(0, countToNumber(snapshot.consumables)),
    inventory: Object.freeze(inventory),
    totalForges: Object.values(inventory)
      .reduce((sum, count) => sum + count, 0),
    pendingPlayId: firstPendingPlay(snapshot)?.id ?? null,
  });
}

function artifactForOutcome(outcomeId: number) {
  if (
    !Number.isInteger(outcomeId) ||
    outcomeId < 1 ||
    outcomeId > ARTIFACTS.length
  ) {
    throw new Error(`FriendSDK returned invalid outcome ${String(outcomeId)}.`);
  }

  return ARTIFACTS[outcomeId - 1];
}

export function createFriendForgeEconomy(
  rawClient: unknown,
  initialSnapshot: unknown,
  onSettled?: (reward: FriendForgeSettledReward) => void
): FriendForgeEconomyBridge {
  const client = rawClient as SdkGameClient;
  let current = normalizeSnapshot(initialSnapshot as SdkGameSnapshot);

  async function read() {
    current = normalizeSnapshot(await client.read());
    return current;
  }

  async function buy(quantity: number) {
    const count = BigInt(Math.max(1, Math.floor(quantity)));

    if (!(await client.canBuy(count))) {
      throw new Error(
        "FriendSDK reports this Ore purchase is unavailable."
      );
    }

    await client.buy(count);
    return read();
  }

  async function settlePlay(
    play: SdkGamePlay,
    inventoryBefore: Readonly<Record<string, number>>
  ): Promise<FriendForgeResult> {
    const settled =
      play.outcomeId === null
        ? await client.settle(play.id)
        : play;

    if (settled.id !== play.id) {
      throw new Error("FriendSDK settled a different Forge play.");
    }

    if (settled.outcomeId === null) {
      const state = await read();

      return Object.freeze({
        status: "pending",
        playId: play.id,
        state,
      });
    }

    const artifact = artifactForOutcome(settled.outcomeId);
    const duplicate = (inventoryBefore[artifact.id] ?? 0) > 0;
    const state = await read();

    const reward: FriendForgeSettledReward = Object.freeze({
      status: "settled",
      artifact,
      playId: play.id,
      outcomeId: settled.outcomeId,
      duplicate,
      state,
    });

    onSettled?.(reward);
    return reward;
  }

  async function forge() {
    // A pending play always resumes first. No second Ore is consumed.
    const snapshot = await client.read();
    current = normalizeSnapshot(snapshot);

    const pending = firstPendingPlay(snapshot);

    if (pending) {
      return settlePlay(pending, current.inventory);
    }

    if (current.ore < 1) {
      throw new Error("You need Ore before forging.");
    }

    // Exact FriendSDK v0.1.2 contract:
    // client.play() returns readonly GamePlay[] and each play uses `id`.
    const [play] = await client.play(1n);

    if (!play) {
      // Recover state without retrying play().
      const recovered = await client.read();
      current = normalizeSnapshot(recovered);

      const recoveredPending = firstPendingPlay(recovered);

      if (recoveredPending) {
        return settlePlay(recoveredPending, current.inventory);
      }

      throw new Error(
        "FriendSDK did not return the committed Forge play. Sync before trying again."
      );
    }

    return settlePlay(play, current.inventory);
  }

  async function redeem(artifactId: string, quantity: number) {
    const index = ARTIFACTS.findIndex((artifact) => artifact.id === artifactId);
    if (index < 0 || REWARD_WEI_BY_OUTCOME[index] === 0n) {
      throw new Error("This artifact is collectible only and cannot be sold.");
    }
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99) {
      throw new Error("Choose between 1 and 99 copies to sell.");
    }

    // Re-read SDK inventory immediately before the action; never debit the UI locally.
    current = normalizeSnapshot(await client.read());
    if ((current.inventory[artifactId] ?? 0) < quantity) {
      throw new Error("Not enough copies remain. Sync the Collection and try again.");
    }

    await client.redeem(index + 1, BigInt(quantity));
    return read();
  }

  return Object.freeze({
    initial: current,
    read,
    buy,
    forge,
    redeem,
  });
}
