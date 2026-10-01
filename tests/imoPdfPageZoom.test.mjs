import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = new URL("../app/yachts/[id]/imo-crew-list/usePdfPageZoom.ts", import.meta.url);
const compiled = ts.transpileModule(await readFile(source, "utf8"), {
  fileName: source.pathname,
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

// Run the real hook with batched state commits and controlled page geometry.
// Browser integration tests separately cover native touch dispatch and CSS.
function harness() {
  const slots = [];
  const pending = new Map();
  const timers = new Map();
  const frames = new Map();
  const listeners = new Map();
  const captures = new Set();
  let cursor = 0;
  let timerId = 0;
  let frameId = 0;
  let frameZoom = 1;
  let scheduled = [];
  let result;
  let left = 0;
  let top = 0;
  let focused = false;
  const sameDeps = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const effect = (kind, callback, deps) => {
    const index = cursor++;
    if (!sameDeps(slots[index]?.deps, deps)) scheduled.push({ index, kind, callback, deps });
  };
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) {
        slots[index] = { value: typeof initial === "function" ? initial() : initial };
        slots[index].setter = (value) => {
          const previous = pending.has(index) ? pending.get(index) : slots[index].value;
          const next = typeof value === "function" ? value(previous) : value;
          if (!Object.is(previous, next)) pending.set(index, next);
        };
      }
      return [slots[index].value, slots[index].setter];
    },
    useRef(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { current: initial };
      return slots[index];
    },
    useCallback(callback, deps) {
      const index = cursor++;
      if (!sameDeps(slots[index]?.deps, deps)) slots[index] = { value: callback, deps };
      return slots[index].value;
    },
    useLayoutEffect: (callback, deps) => effect("layout", callback, deps),
    useEffect: (callback, deps) => effect("passive", callback, deps),
  };
  const window = {
    setTimeout(callback, delay) { const id = ++timerId; timers.set(id, { callback, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
  };
  const viewport = {
    dataset: {},
    clientHeight: 400,
    get scrollLeft() { return left; },
    set scrollLeft(value) { left = Math.max(0, Math.min(300 * (frameZoom - 1), value)); },
    get scrollTop() { return top; },
    set scrollTop(value) { top = Math.max(0, Math.min(424 * frameZoom + 160 - 400, value)); },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 340, height: 400 }),
    focus(options) { assert.deepEqual(options, { preventScroll: true }); focused = true; },
    matches(selector) { assert.equal(selector, ":focus"); return focused; },
    setPointerCapture(id) { captures.add(id); },
    hasPointerCapture(id) { return captures.has(id); },
    releasePointerCapture(id) { captures.delete(id); },
    addEventListener(type, callback) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(callback);
    },
    removeEventListener(type, callback) { listeners.get(type)?.delete(callback); },
  };
  const frame = {
    getBoundingClientRect: () => ({ left: 20 - left, top: 72 - top, width: 300 * frameZoom, height: 424 * frameZoom }),
  };
  const viewportRef = { current: viewport };
  const frameRef = { current: frame };
  const loaded = { exports: {} };
  new Function("require", "module", "exports", "window", "requestAnimationFrame", "cancelAnimationFrame", compiled)(
    (specifier) => { assert.equal(specifier, "react"); return react; }, loaded, loaded.exports, window,
    (callback) => { const id = ++frameId; frames.set(id, callback); return id; },
    (id) => frames.delete(id),
  );
  function render() {
    cursor = 0;
    scheduled = [];
    result = loaded.exports.usePdfPageZoom(viewportRef, frameRef);
    for (const kind of ["layout", "passive"]) {
      for (const task of scheduled.filter((entry) => entry.kind === kind)) {
        slots[task.index]?.cleanup?.();
        slots[task.index] = { deps: task.deps, cleanup: task.callback() };
      }
    }
  }
  function flushFrame() {
    for (const [id, callback] of [...frames]) { frames.delete(id); callback(); }
  }
  function commit({ flush = true } = {}) {
    if (!pending.size) return;
    for (const [index, value] of pending) slots[index].value = value;
    pending.clear();
    render();
    // Layout-effect reads can still see the preceding frame. The rAF runs once
    // the new dimensions participate in browser layout, as in the real viewer.
    frameZoom = result.zoom;
    if (flush) flushFrame();
  }
  render();
  return {
    viewport, frame, captures, timers, frames, listeners, commit, flushFrame,
    get zoom() { return result.zoom; },
    get renderZoom() { return result.renderZoom; },
    reset: () => result.resetZoom(),
    dispatch(type, properties = {}) {
      const event = { button: 0, prevented: false, preventDefault() { this.prevented = true; }, ...properties };
      for (const listener of listeners.get(type) || []) listener(event);
      return event;
    },
    settle() {
      for (const [id, timer] of [...timers]) { timers.delete(id); timer.callback(); }
      commit();
    },
    cleanup() { for (const slot of slots) slot.cleanup?.(); },
  };
}

const pointer = (pointerId, clientX, clientY = 200) => ({ pointerId, clientX, clientY });
const wheel = (deltaY, extras = {}) => ({ deltaY, deltaMode: 0, ctrlKey: true, clientX: 170, clientY: 200, ...extras });
function pagePoint(h, x, y) {
  const frame = h.frame.getBoundingClientRect();
  return { x: (x - frame.left) / frame.width, y: (y - frame.top) / frame.height };
}
function assertAt(h, point, x, y) {
  const frame = h.frame.getBoundingClientRect();
  const actualX = frame.left + point.x * frame.width;
  const actualY = frame.top + point.y * frame.height;
  assert.ok(Math.abs(actualX - x) < 0.000001, `Horizontal page anchor stays under the gesture center: expected ${x}, got ${actualX}`);
  assert.ok(Math.abs(actualY - y) < 0.000001, `Vertical page anchor stays under the gesture center: expected ${y}, got ${actualY}`);
}

test("two finger moves in one React commit preserve the page anchor and defer sharp rendering", () => {
  const h = harness();
  const point = pagePoint(h, 170, 200);
  h.dispatch("pointerdown", pointer(1, 120));
  h.dispatch("pointerdown", pointer(2, 220));
  h.dispatch("pointermove", pointer(1, 100));
  h.dispatch("pointermove", pointer(2, 240));
  assert.equal(h.zoom, 1, "Both moves run before React updates the page dimensions");
  h.commit({ flush: false });
  assert.equal(h.zoom, 1.4);
  assert.equal(h.frames.size, 1, "Anchor correction waits for the resized browser layout");
  h.flushFrame();
  assertAt(h, point, 170, 200);
  assert.equal(h.renderZoom, 1, "The existing canvas scales during the gesture");
  assert.equal(h.timers.size, 1, "Only the latest sharp-render timer remains");
  h.settle();
  assert.equal(h.renderZoom, 1.4);
  h.cleanup();
});

test("an older animation frame cannot consume the anchor for a newer uncommitted pinch", () => {
  const h = harness();
  const point = pagePoint(h, 170, 200);
  h.dispatch("pointerdown", pointer(1, 120));
  h.dispatch("pointerdown", pointer(2, 220));
  h.dispatch("pointermove", pointer(1, 100));
  h.dispatch("pointermove", pointer(2, 240));
  h.commit({ flush: false });
  assert.equal(h.zoom, 1.4);
  assert.equal(h.frames.size, 1);

  // Fingers move again before React can commit the next width. The previous
  // frame callback fires between this newer input and that pending commit.
  h.dispatch("pointermove", pointer(1, 80));
  h.dispatch("pointermove", pointer(2, 260));
  h.flushFrame();
  assert.equal(h.zoom, 1.4, "The newer zoom has not reached the DOM yet");
  h.commit();
  assert.ok(Math.abs(h.zoom - 1.8) < 0.000001);
  assertAt(h, point, 170, 200);
  h.settle();
  assert.ok(Math.abs(h.renderZoom - 1.8) < 0.000001);
  h.cleanup();
});

test("a pinch clamped at maximum zoom keeps its anchor, then continues panning with one finger", () => {
  const h = harness();
  h.dispatch("wheel", wheel(-200)); h.commit();
  h.dispatch("wheel", wheel(-200)); h.commit();
  assert.equal(h.zoom, 6);
  h.dispatch("keydown", { key: "-" }); h.commit();
  assert.ok(Math.abs(h.zoom - 4.8) < 0.000001);
  const point = pagePoint(h, 170, 200);
  h.dispatch("pointerdown", pointer(1, 140));
  h.dispatch("pointerdown", pointer(2, 200));
  h.dispatch("pointermove", pointer(1, 80));
  h.dispatch("pointermove", pointer(2, 260));
  h.commit();
  assert.equal(h.zoom, 6);
  assertAt(h, point, 170, 200);
  h.dispatch("pointermove", pointer(1, 90));
  h.dispatch("pointermove", pointer(2, 270));
  h.commit();
  assertAt(h, point, 180, 200);
  h.dispatch("pointerup", pointer(2, 270));
  const before = { left: h.viewport.scrollLeft, top: h.viewport.scrollTop };
  h.dispatch("pointermove", pointer(1, 75, 190));
  assert.equal(h.viewport.scrollLeft, before.left + 15);
  assert.equal(h.viewport.scrollTop, before.top + 10);
  h.dispatch("pointercancel", pointer(1, 75, 190));
  assert.equal(h.captures.size, 0);
  h.dispatch("pointermove", pointer(1, 10, 10));
  assert.equal(h.viewport.scrollLeft, before.left + 15, "Cancelled pointers no longer pan the page");
  h.cleanup();
});

test("keyboard and modified-wheel zoom stay bounded while ordinary scrolling stays native", () => {
  const h = harness();
  const ordinary = h.dispatch("wheel", wheel(-100, { ctrlKey: false }));
  assert.equal(ordinary.prevented, false);
  h.commit();
  assert.equal(h.zoom, 1);
  assert.equal(h.dispatch("keydown", { key: "ArrowDown" }).prevented, false);
  assert.equal(h.dispatch("keydown", { key: "+" }).prevented, true);
  h.commit();
  assert.equal(h.zoom, 1.25);
  assert.equal(h.dispatch("wheel", wheel(-3, { deltaMode: 1, ctrlKey: false, metaKey: true })).prevented, true);
  h.commit();
  assert.ok(h.zoom > 1.25);
  for (let i = 0; i < 30; i += 1) { h.dispatch("keydown", { key: "-" }); h.commit(); }
  assert.equal(h.zoom, 1);
  h.dispatch("keydown", { key: "=" }); h.commit();
  h.dispatch("keydown", { key: "0" }); h.commit();
  assert.equal(h.zoom, 1);
  h.cleanup();
});

test("reset clears a queued anchor and cleanup removes listeners and render timers", () => {
  const h = harness();
  h.dispatch("wheel", wheel(-150));
  h.reset();
  h.commit();
  assert.equal(h.zoom, 1);
  assert.equal(h.renderZoom, 1);
  assert.equal(h.viewport.scrollLeft, 0);
  assert.equal(h.viewport.scrollTop, 0);
  h.dispatch("wheel", wheel(-100)); h.commit({ flush: false });
  assert.ok(h.timers.size > 0);
  assert.equal(h.frames.size, 1);
  h.dispatch("keydown", { key: "+" }); h.commit({ flush: false });
  assert.equal(h.frames.size, 1, "A newer commit replaces the pending anchor callback");
  assert.ok([...h.listeners.values()].every((callbacks) => callbacks.size === 1), "State updates do not duplicate listeners");
  const zoom = h.zoom;
  h.cleanup();
  assert.equal(h.timers.size, 0);
  assert.equal(h.frames.size, 0);
  assert.ok([...h.listeners.values()].every((callbacks) => callbacks.size === 0));
  h.dispatch("wheel", wheel(-100));
  h.commit();
  h.settle();
  assert.equal(h.zoom, zoom);
});
