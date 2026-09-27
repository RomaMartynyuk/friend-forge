// @ts-nocheck
import * as FriendWorldSDK from "@rarefriends/friendsdk/world";
import friendWorldCatalog from "@rarefriends/friendsdk/worlds.json";

export type CanonicalWorldProp = Readonly<{
  dataUrl: string;
  sourceIndex: number;
}>;

const canonicalPropCache = new Map<
  string,
  Promise<readonly CanonicalWorldProp[]>
>();

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function collectWorldCandidates(
  value: unknown,
  result: unknown[],
  depth = 0
) {
  if (depth > 6 || result.length >= 32) return;

  if (Array.isArray(value)) {
    for (const entry of value) {
      collectWorldCandidates(entry, result, depth + 1);
    }
    return;
  }

  if (!isObject(value)) return;

  const keys = Object.keys(value);
  const worldLike =
    keys.includes("terrain") ||
    keys.includes("props") ||
    keys.includes("actors") ||
    keys.includes("signals") ||
    keys.includes("anchors") ||
    (keys.includes("width") && keys.includes("height"));

  if (worldLike) result.push(value);

  for (const nested of Object.values(value)) {
    if (isObject(nested)) {
      collectWorldCandidates(nested, result, depth + 1);
    }
  }
}

function extractSvgObjects(value: unknown) {
  if (!isObject(value)) return [];

  const direct = Array.isArray(value.objects)
    ? value.objects
    : [];

  const objects = direct.filter(
    (entry) =>
      isObject(entry) &&
      typeof entry.svg === "string" &&
      entry.svg.includes("<svg")
  );

  const props = objects.filter(
    (entry) => entry.kind === "prop"
  );

  return props.length ? props : objects;
}

async function maybeLayers(
  fn: (...args: any[]) => any,
  world: unknown
) {
  const attempts = [
    [world, { color: true }],
    [world, { color: false }],
    [world],
  ];

  for (const args of attempts) {
    try {
      const value = await fn(...args);
      const objects = extractSvgObjects(value);

      if (objects.length) return objects;
    } catch {
      // Try the next documented-style invocation shape.
    }
  }

  return [];
}

function svgDataUrl(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function seededOrder(length: number, seed: number) {
  const order = Array.from({ length }, (_, index) => index);
  let state = seed >>> 0;

  const next = () => {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  for (let index = order.length - 1; index > 0; index--) {
    const target = Math.floor(next() * (index + 1));
    [order[index], order[target]] = [order[target], order[index]];
  }

  return order;
}

async function loadCanonicalWorldPropsUncached(
  seed: number,
  limit = 4
): Promise<readonly CanonicalWorldProp[]> {
  const sdk = FriendWorldSDK as Record<string, unknown>;

  // Some SDK builds may expose already rendered layers/constants.
  for (const value of Object.values(sdk)) {
    const objects = extractSvgObjects(value);

    if (objects.length) {
      const order = seededOrder(objects.length, seed);

      return Object.freeze(
        order.slice(0, Math.min(limit, objects.length)).map((index) =>
          Object.freeze({
            dataUrl: svgDataUrl(String(objects[index].svg)),
            sourceIndex: index,
          })
        )
      );
    }
  }

  const worlds: unknown[] = [];
  collectWorldCandidates(friendWorldCatalog, worlds);

  // Prefer explicit / likely pure world rendering exports. Namespace import
  // keeps this compatible with the public `./world` export without relying on
  // a private friend-world.ts symbol.
  const preferredNames = [
    "renderFriendWorld",
    "renderWorld",
    "renderWorldLayers",
    "createWorldLayers",
    "worldLayers",
    "composeWorld",
  ];

  const functions = Object.entries(sdk)
    .filter(([, value]) => typeof value === "function")
    .sort(([a], [b]) => {
      const ai = preferredNames.indexOf(a);
      const bi = preferredNames.indexOf(b);
      const ar = ai === -1 ? 99 : ai;
      const br = bi === -1 ? 99 : bi;
      return ar - br;
    })
    .filter(([name]) =>
      preferredNames.includes(name) ||
      /render.*world|world.*render|world.*layer|layer.*world/i.test(name)
    );

  for (const [, value] of functions) {
    const fn = value as (...args: any[]) => any;

    for (const world of worlds) {
      const objects = await maybeLayers(fn, world);

      if (!objects.length) continue;

      // Deduplicate exact canonical SVG payloads.
      const unique = [
        ...new Map(
          objects.map((entry, index) => [
            String(entry.svg),
            { entry, index },
          ])
        ).values(),
      ];

      const order = seededOrder(unique.length, seed);

      return Object.freeze(
        order.slice(0, Math.min(limit, unique.length)).map((position) => {
          const chosen = unique[position];

          return Object.freeze({
            dataUrl: svgDataUrl(String(chosen.entry.svg)),
            sourceIndex: chosen.index,
          });
        })
      );
    }
  }

  // If a future SDK changes the world renderer shape, fail visually soft:
  // island personalization still works and gameplay remains untouched.
  return Object.freeze([]);
}


export function loadCanonicalWorldProps(
  seed: number,
  limit = 4
): Promise<readonly CanonicalWorldProp[]> {
  const safeSeed = seed >>> 0;
  const safeLimit = Math.max(0, Math.min(8, Math.floor(limit)));
  const key = `${safeSeed}:${safeLimit}`;

  const cached = canonicalPropCache.get(key);
  if (cached) return cached;

  const result = loadCanonicalWorldPropsUncached(safeSeed, safeLimit)
    .catch((cause) => {
      canonicalPropCache.delete(key);
      console.warn("FriendSDK canonical world props could not render.", cause);
      return Object.freeze([]);
    });

  canonicalPropCache.set(key, result);
  return result;
}
