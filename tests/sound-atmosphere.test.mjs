import test from "node:test";
import assert from "node:assert/strict";
import { createSoundAtmosphere } from "../games/friend-forge/game/SoundAtmosphere.ts";

test("audio is lazy, muted and paused without touching SDK outcomes", async () => {
  const original = { AudioContext: globalThis.AudioContext, document: globalThis.document, window: globalThis.window };
  let contexts = 0;
  let notes = 0;
  const parameter = { value: 0, setTargetAtTime() {}, setValueAtTime() {}, exponentialRampToValueAtTime() {} };
  class FakeNode { connect() { return this; } disconnect() {} }
  class FakeContext {
    constructor() { contexts++; this.currentTime = 0; this.state = "suspended"; this.destination = new FakeNode(); }
    createGain() { return Object.assign(new FakeNode(), { gain: { ...parameter } }); }
    createOscillator() { return Object.assign(new FakeNode(), { frequency: { ...parameter }, start() { notes++; }, stop() {}, onended: null }); }
    async resume() { this.state = "running"; }
    async close() { this.state = "closed"; }
  }
  globalThis.AudioContext = FakeContext;
  globalThis.document = { hidden: false, addEventListener() {}, removeEventListener() {} };
  globalThis.window = { setInterval() { return 1; }, clearInterval() {} };
  try {
    const layer = createSoundAtmosphere();
    assert.equal(contexts, 0);
    assert.equal(layer.accent("ui"), false);
    assert.equal(await layer.unlock(), true);
    assert.equal(contexts, 1);
    layer.setScene("mine");
    assert.equal(layer.accent("stone"), true);
    assert.ok(notes > 0);
    layer.setMuted(true);
    assert.equal(layer.accent("lava"), false);
    layer.setMuted(false);
    layer.setPaused(true);
    assert.equal(layer.accent("ore"), false);
    layer.setPaused(false);
    globalThis.document.hidden = true;
    assert.equal(layer.accent("rarity"), false);
    layer.dispose();
    assert.equal(await layer.unlock(), false);
  } finally {
    Object.assign(globalThis, original);
  }
});
