import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = new URL("../app/yachts/[id]/imo-crew-list/ImoCrewListPreviewDialog.tsx", import.meta.url);
const compiled = ts.transpileModule(await readFile(source, "utf8"), {
  fileName: source.pathname,
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;

class InlineStyle {
  values = new Map();
  setProperty(key, value, priority = "") { this.values.set(key, [value, priority]); }
  getPropertyValue(key) { return this.values.get(key)?.[0] || ""; }
  getPropertyPriority(key) { return this.values.get(key)?.[1] || ""; }
  removeProperty(key) { this.values.delete(key); }
  snapshot() { return [...this.values.entries()].sort(([a], [b]) => a.localeCompare(b)); }
}

class Listeners {
  listeners = new Map();
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }
  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
  dispatch(type) { for (const listener of this.listeners.get(type) || []) listener(); }
  count(type) { return this.listeners.get(type)?.size || 0; }
}

// Run the actual component's layout effect and handlers with controlled DOM
// surfaces. This checks lifecycle behavior; browser tests cover layout/hit areas.
function harness({ visualViewport = true, explicitReturnFocus = false } = {}) {
  const effects = [];
  const elements = [];
  const calls = [];
  const document = {};
  class Element {
    style = new InlineStyle();
    isConnected = true;
    focus(options) { document.activeElement = this; calls.push({ kind: "focus", element: this, options }); }
  }
  const body = new Element();
  const root = new Element();
  const trigger = new Element();
  const returnTarget = new Element();
  const dialog = new Element();
  const closeButton = new Element();
  dialog.open = false;
  dialog.showModal = () => {
    assert.equal(dialog.open, false, "Each showModal follows a closed dialog");
    dialog.open = true;
    calls.push({ kind: "show" });
  };
  dialog.close = () => { dialog.open = false; calls.push({ kind: "close" }); };
  root.clientWidth = 980;
  body.style.setProperty("position", "relative", "important");
  body.style.setProperty("padding-right", "7px", "important");
  body.style.setProperty("color", "navy");
  root.style.setProperty("overflow", "auto", "important");
  root.style.setProperty("scroll-behavior", "smooth", "important");
  Object.assign(document, { body, documentElement: root, activeElement: explicitReturnFocus ? body : trigger });
  const window = Object.assign(new Listeners(), {
    innerWidth: 1000, innerHeight: 800, scrollX: 17, scrollY: 620,
    visualViewport: visualViewport ? Object.assign(new Listeners(), { width: 390, height: 640, offsetLeft: 2, offsetTop: 30 }) : undefined,
  });
  window.scrollTo = (options) => {
    calls.push({ kind: "scroll", options, behavior: root.style.getPropertyValue("scroll-behavior") });
    window.scrollX = options.left;
    window.scrollY = options.top;
  };
  let id = 0;
  const jsx = (type, props) => {
    const node = { type, props };
    elements.push(node);
    if (props.ref) props.ref.current = type === "dialog" ? dialog : closeButton;
    return node;
  };
  const mocks = {
    react: { useId: () => `preview-${++id}`, useRef: (current) => ({ current }), useLayoutEffect: (effect) => effects.push(effect) },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-dom": { createPortal: (children, container) => ({ children, container }) },
    "next/dynamic": { __esModule: true, default: () => () => null },
    "lucide-react": { Download: () => null, X: () => null },
    "./ImoCrewListPreviewDialog.module.css": { __esModule: true, default: {} },
  };
  const loaded = { exports: {} };
  new Function("require", "module", "exports", "window", "document", "HTMLElement", "getComputedStyle", compiled)(
    (specifier) => {
      assert.ok(Object.hasOwn(mocks, specifier), `Unexpected dependency: ${specifier}`);
      return mocks[specifier];
    }, loaded, loaded.exports, window, document, Element,
    (element) => ({ paddingRight: element.style.getPropertyValue("padding-right") }),
  );
  let closed = 0;
  let downloaded = 0;
  const portal = loaded.exports.default({
    blob: new Blob(["PDF test"]), url: "blob:test-preview", filename: "crew-list.pdf", language: "en",
    onClose: () => { closed += 1; }, onDownload: () => { downloaded += 1; },
    ...(explicitReturnFocus ? { returnFocusRef: { current: returnTarget } } : {}),
  });
  assert.equal(effects.length, 1);
  return { body, root, trigger, returnTarget, dialog, closeButton, document, window, elements, portal, calls,
    setup: effects[0], get closed() { return closed; }, get downloaded() { return downloaded; } };
}

test("preview opens in the body and restores scroll, focus, and owned inline styles on close", () => {
  const h = harness();
  const beforeBody = h.body.style.snapshot();
  const beforeRoot = h.root.style.snapshot();
  assert.equal(h.portal.container, h.body, "Preview escapes document scaling and workspace selectors");
  const cleanup = h.setup();
  assert.equal(h.dialog.open, true);
  assert.equal(h.document.activeElement, h.closeButton);
  assert.equal(h.body.style.getPropertyValue("position"), "fixed");
  assert.equal(h.body.style.getPropertyValue("top"), "-620px");
  assert.equal(h.body.style.getPropertyValue("left"), "-17px");
  assert.equal(h.body.style.getPropertyValue("padding-right"), "27px", "Existing padding plus scrollbar width prevents page shift");
  assert.equal(h.root.style.getPropertyValue("overflow"), "hidden");
  h.body.style.setProperty("background", "white");
  h.window.scrollX = 0;
  h.window.scrollY = 0;
  cleanup();
  assert.equal(h.dialog.open, false);
  assert.equal(h.window.scrollX, 17);
  assert.equal(h.window.scrollY, 620);
  assert.equal(h.document.activeElement, h.trigger);
  assert.deepEqual(h.body.style.snapshot(), [...beforeBody, ["background", ["white", ""]]].sort(([a], [b]) => a.localeCompare(b)), "Unrelated inline changes survive cleanup");
  assert.deepEqual(h.root.style.snapshot(), beforeRoot);
  const scroll = h.calls.find((call) => call.kind === "scroll");
  assert.equal(scroll.behavior, "auto", "Restore position before restoring smooth scrolling");
  assert.deepEqual(scroll.options, { left: 17, top: 620, behavior: "instant" });
  for (const call of h.calls.filter((call) => call.kind === "focus")) assert.deepEqual(call.options, { preventScroll: true });
  assert.equal(h.window.count("resize"), 0);
  assert.equal(h.window.visualViewport.count("resize"), 0);
  assert.equal(h.window.visualViewport.count("scroll"), 0);
});

test("preview follows the visual viewport and balances StrictMode effect replay", () => {
  const h = harness();
  const beforeBody = h.body.style.snapshot();
  const firstCleanup = h.setup();
  assert.equal(h.dialog.style.getPropertyValue("--preview-width"), "390px");
  assert.equal(h.dialog.style.getPropertyValue("--preview-height"), "640px");
  assert.equal(h.dialog.style.getPropertyValue("--preview-left"), "2px");
  assert.equal(h.dialog.style.getPropertyValue("--preview-top"), "30px");
  Object.assign(h.window.visualViewport, { height: 310, offsetTop: 45 });
  h.window.visualViewport.dispatch("resize");
  assert.equal(h.dialog.style.getPropertyValue("--preview-height"), "310px");
  assert.equal(h.dialog.style.getPropertyValue("--preview-top"), "45px");
  firstCleanup();
  const cleanup = h.setup();
  assert.equal(h.dialog.open, true);
  assert.equal(h.body.style.getPropertyValue("padding-right"), "27px", "StrictMode replay must not double scrollbar compensation");
  assert.equal(h.window.count("resize"), 1);
  assert.equal(h.window.visualViewport.count("resize"), 1);
  assert.equal(h.window.visualViewport.count("scroll"), 1);
  Object.assign(h.window.visualViewport, { width: 720, offsetLeft: 0, offsetTop: 0 });
  h.window.visualViewport.dispatch("scroll");
  assert.equal(h.dialog.style.getPropertyValue("--preview-width"), "720px");
  assert.equal(h.dialog.style.getPropertyValue("--preview-left"), "0px");
  cleanup();
  assert.deepEqual(h.body.style.snapshot(), beforeBody);
  assert.equal(h.calls.filter((call) => call.kind === "show").length, 2);
  assert.equal(h.calls.filter((call) => call.kind === "close").length, 2);
  assert.equal(h.window.count("resize"), 0);
  assert.equal(h.window.visualViewport.count("resize"), 0);
  assert.equal(h.window.visualViewport.count("scroll"), 0);
});

test("desktop fallback resizes and close, Escape, and download retain their real callbacks", () => {
  const h = harness({ visualViewport: false });
  const cleanup = h.setup();
  assert.equal(h.dialog.style.getPropertyValue("--preview-width"), "1000px");
  h.window.innerWidth = 1280;
  h.window.innerHeight = 720;
  h.window.dispatch("resize");
  assert.equal(h.dialog.style.getPropertyValue("--preview-width"), "1280px");
  assert.equal(h.dialog.style.getPropertyValue("--preview-height"), "720px");
  const close = h.elements.find((element) => element.type === "button" && element.props["aria-label"] === "Close preview");
  assert.ok(close);
  close.props.onClick();
  assert.equal(h.closed, 1);
  let prevented = false;
  h.portal.children.props.onCancel({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(h.closed, 2);
  const download = h.elements.find((element) => element.type === "a");
  assert.equal(download.props.href, "blob:test-preview");
  assert.equal(download.props.download, "crew-list.pdf");
  download.props.onClick();
  assert.equal(h.downloaded, 1);
  h.trigger.isConnected = false;
  cleanup();
  assert.equal(h.calls.some((call) => call.kind === "focus" && call.element === h.trigger), false, "Never refocus an unmounted route trigger");
  assert.equal(h.window.count("resize"), 0);
});

test("mobile preview restores the explicit trigger even when tapping did not focus it", () => {
  const h = harness({ explicitReturnFocus: true });
  assert.equal(h.document.activeElement, h.body);
  const cleanup = h.setup();
  assert.equal(h.document.activeElement, h.closeButton);
  cleanup();
  assert.equal(h.document.activeElement, h.returnTarget);
  const restored = h.calls.filter((call) => call.kind === "focus").at(-1);
  assert.equal(restored.element, h.returnTarget);
  assert.deepEqual(restored.options, { preventScroll: true });
});
