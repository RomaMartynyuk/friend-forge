import test from "node:test";
import assert from "node:assert/strict";
import { createWorldVfx } from "../games/friend-forge/game/GlobalVfx.ts";

function fakeContext() {
  const rectangles = [];
  return {
    rectangles,
    save() {}, restore() {},
    fillRect(x, y, width, height) { rectangles.push([x, y, width, height]); },
    set imageSmoothingEnabled(_) {},
    set globalAlpha(_) {},
    set fillStyle(_) {},
  };
}

const friend = { x: 500, y: 500, walking: true, facing: "down", family: "sparkling" };

test("ambient VFX are deterministic and bounded", () => {
  const first = fakeContext();
  const second = fakeContext();
  createWorldVfx(2728).draw(first, 4000, friend, true);
  createWorldVfx(2728).draw(second, 4000, friend, true);
  assert.deepEqual(first.rectangles, second.rectangles);
  assert.ok(first.rectangles.length > 20 && first.rectangles.length < 60);
  assert.ok(first.rectangles.every(([x, y, width, height]) => Number.isFinite(x) && Number.isFinite(y) && width > 0 && height > 0));
});

test("paused or reduced-motion rendering adds no animated pixels", () => {
  const ctx = fakeContext();
  createWorldVfx(2728).draw(ctx, 4000, friend, false);
  assert.equal(ctx.rectangles.length, 0);
});
