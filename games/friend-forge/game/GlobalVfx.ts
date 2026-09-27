/** Presentation only. Nothing in this module reads or writes FriendSDK state. */
type FriendVisual = Readonly<{
  x: number;
  y: number;
  walking: boolean;
  facing: "up" | "down" | "left" | "right";
  family: string;
}>;

function randomSource(seed: number) {
  let state = (seed >>> 0) || 0x719c42d3;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

export function createWorldVfx(seed: number) {
  const random = randomSource(seed ^ 0x583d921a);
  const motes = Array.from({ length: 17 }, () => ({
    x: 116 + random() * 973,
    y: 275 + random() * 276,
    phase: random(),
    drift: 3 + random() * 7,
    size: random() > 0.72 ? 3 : 2,
  }));

  function draw(ctx: CanvasRenderingContext2D, now: number, friend: FriendVisual, motion: boolean) {
    if (!motion) return;
    const seconds = now / 1000;
    ctx.save();
    ctx.imageSmoothingEnabled = false;

    // Small drifting island motes, bounded and seeded for stable ambience.
    for (const mote of motes) {
      const wave = seconds * 0.35 + mote.phase * 6.283;
      ctx.globalAlpha = 0.16 + 0.17 * (Math.sin(wave * 1.7) + 1) / 2;
      ctx.fillStyle = mote.phase > 0.5 ? "#fff9df" : "#e9f4c9";
      ctx.fillRect(Math.round(mote.x + Math.sin(wave) * mote.drift), Math.round(mote.y + Math.cos(wave * 0.7) * 5), mote.size, mote.size);
    }

    // Mine dust, Forge smoke/embers and Collection glints stay near landmarks.
    for (let i = 0; i < 5; i++) {
      let phase = (seconds * 0.32 + i * 0.21) % 1;
      ctx.globalAlpha = (1 - phase) * 0.24;
      ctx.fillStyle = "#a99e87";
      ctx.fillRect(Math.round(253 + Math.sin(i * 2.4 + seconds) * 13), Math.round(385 - phase * 35), 3 + (i % 2), 3 + (i % 2));

      phase = (seconds * 0.46 + i * 0.2) % 1;
      ctx.globalAlpha = (1 - phase) * 0.30;
      ctx.fillStyle = i % 2 ? "#b7aaa0" : "#d4c8b8";
      ctx.fillRect(Math.round(565 + Math.sin(i * 2.1 + seconds) * 10), Math.round(405 - phase * 65), 4 + (i % 2) * 2, 4);
      ctx.globalAlpha = (1 - phase) * 0.52;
      ctx.fillStyle = i % 2 ? "#f1b46a" : "#ee8f74";
      ctx.fillRect(Math.round(557 + i * 4), Math.round(435 - phase * 29), 2, 3);
    }
    for (let i = 0; i < 3; i++) {
      const phase = (seconds * 0.45 + i / 3) % 1;
      ctx.globalAlpha = Math.sin(phase * Math.PI) * 0.55;
      ctx.fillStyle = "#fffdf4";
      const x = Math.round(826 + i * 30);
      const y = Math.round(427 - phase * 28);
      ctx.fillRect(x - 1, y, 5, 2);
      ctx.fillRect(x + 1, y - 2, 2, 6);
    }

    if (friend.walking) {
      const palette: Record<string, string> = {
        sparkling: "#fff7c6", cellular: "#d9f1d6", skeleton: "#ece7d9",
        mask: "#dfd9ef", hoverer: "#d4e9f0", hollow: "#eee9f8",
        colossus: "#d4c7b3", asymmetry: "#ead9dc", family: "#f7e4bc",
      };
      const color = palette[friend.family] ?? "#fff7df";
      const opposite = friend.facing === "left" ? [10, 0] : friend.facing === "right" ? [-10, 0] : friend.facing === "up" ? [0, 7] : [0, -7];
      for (let i = 0; i < 3; i++) {
        const phase = (seconds * 3.2 + i / 3) % 1;
        ctx.globalAlpha = (1 - phase) * 0.36;
        ctx.fillStyle = color;
        ctx.fillRect(Math.round(friend.x + opposite[0] + (i - 1) * 5), Math.round(friend.y + 31 + opposite[1] - phase * 8), 2, 2);
      }
    }

    ctx.restore();
  }

  return { draw };
}

export function mountUiVfx(root: HTMLElement, isPaused: () => boolean) {
  const app = root.querySelector<HTMLElement>(".app") ?? root;
  const stage = app.querySelector<HTMLElement>(".stage");
  const surface = document.createElement("div");
  surface.className = "global-vfx-surface";
  surface.setAttribute("aria-hidden", "true");
  app.append(surface);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  let lastHover = 0;
  let feedbackTimer = 0;
  let destroyed = false;

  function burst(target: Element, color = "#f2d996", count = 5) {
    if (destroyed || reduced.matches || document.hidden || isPaused()) return;
    const targetRect = target.getBoundingClientRect();
    const appRect = app.getBoundingClientRect();
    const x = targetRect.left + targetRect.width / 2 - appRect.left;
    const y = targetRect.top + targetRect.height / 2 - appRect.top;
    if (surface.childElementCount > 50) surface.firstElementChild?.remove();
    for (let i = 0; i < count; i++) {
      const pixel = document.createElement("i");
      pixel.className = "global-vfx-pixel";
      pixel.style.left = `${x}px`;
      pixel.style.top = `${y}px`;
      pixel.style.backgroundColor = color;
      pixel.style.setProperty("--dx", `${(i - (count - 1) / 2) * 11}px`);
      pixel.style.setProperty("--dy", `${-12 - (i % 3) * 9}px`);
      pixel.addEventListener("animationend", () => pixel.remove(), { once: true });
      surface.append(pixel);
    }
  }

  function feedback() {
    if (!stage || reduced.matches || document.hidden || isPaused()) return;
    stage.classList.remove("vfx-camera-tap");
    void stage.offsetWidth;
    stage.classList.add("vfx-camera-tap");
    window.clearTimeout(feedbackTimer);
    feedbackTimer = window.setTimeout(() => stage.classList.remove("vfx-camera-tap"), 230);
  }

  const onPointerOver = (event: PointerEvent) => {
    const target = (event.target as Element | null)?.closest?.(".ore-mine-label,.central-forge-label,.collection-label,.reforge-label,.community-furnace-label,.collection-item.artifact-frame,button:not(:disabled)");
    if (!target || (event.relatedTarget instanceof Node && target.contains(event.relatedTarget))) return;
    const now = performance.now();
    if (now - lastHover < 90) return;
    lastHover = now;
    const color = target.classList.contains("collection-item") ? "#b9d4ee" : target.classList.contains("central-forge-label") ? "#efab86" : target.classList.contains("ore-mine-label") ? "#e7ce8b" : "#d8c5e8";
    burst(target, color, 4);
  };

  const onClick = (event: MouseEvent) => {
    const target = (event.target as Element | null)?.closest?.("#buyOreConfirm,#forgeOre,#miningCashOut,#miningForge,.ore-mine-label,.central-forge-label,.collection-label,.reforge-label,.community-furnace-label");
    if (!target) return;
    burst(target, "#fff4d7", 7);
    feedback();
  };

  root.addEventListener("pointerover", onPointerOver);
  root.addEventListener("click", onClick);
  return {
    burst,
    feedback,
    destroy() {
      destroyed = true;
      window.clearTimeout(feedbackTimer);
      stage?.classList.remove("vfx-camera-tap");
      root.removeEventListener("pointerover", onPointerOver);
      root.removeEventListener("click", onClick);
      surface.remove();
    },
  };
}
