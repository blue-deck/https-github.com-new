import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../app/components/ContractPdfPreview.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source.replace("function ContractPdfPage(", "export function ContractPdfPage("), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;
const settle = () => new Promise((resolve) => setImmediate(resolve));

// Exercise the component's real effects with controlled observers and PDF tasks.
// Browser QA covers page geometry and actual PDF.js rendering separately.
function harness(componentName = "ContractPdfPage", overrides = {}) {
  const hooks = [], pending = [], timers = new Map(), observers = [], calls = [], elements = [];
  let cursor = 0, dirty = true, timerId = 0, rendered, currentProps;
  const pageElement = { clientWidth: 600 };
  const makeCanvas = () => ({ width: 300, height: 150, getContext: () => ({ drawImage: (canvas) => calls.push({ kind: "draw", width: canvas.width, height: canvas.height }) }) });
  const canvas = makeCanvas();
  const page = {
    getViewport: ({ scale }) => ({ width: 600 * scale, height: 900 * scale }),
    render: (input) => { calls.push({ kind: "render", ...input }); return { promise: Promise.resolve(), cancel: () => calls.push({ kind: "cancel" }) }; },
    getTextContent: async () => ({ items: [{ str: "Stored contract text" }] }),
    cleanup: () => calls.push({ kind: "pageCleanup" }),
    ...overrides.page,
  };
  const pdf = { numPages: 4, getPage: async (number) => { calls.push({ kind: "getPage", number }); return page; } };
  const task = { promise: Promise.resolve(pdf), destroy: async () => { calls.push({ kind: "destroy" }); }, ...overrides.task };
  const react = {
    useId: () => "contract-page-text",
    useRef(initial) { const index = cursor++; return hooks[index] ?? (hooks[index] = { current: initial }); },
    useState(initial) {
      const index = cursor++;
      if (!hooks[index]) hooks[index] = { value: typeof initial === "function" ? initial() : initial };
      return [hooks[index].value, (next) => { const value = typeof next === "function" ? next(hooks[index].value) : next; if (!Object.is(value, hooks[index].value)) { hooks[index].value = value; dirty = true; } }];
    },
    useEffect(effect, dependencies) {
      const index = cursor++, before = hooks[index];
      if (!before || dependencies.some((value, i) => !Object.is(value, before.dependencies[i]))) {
        hooks[index] = { dependencies, cleanup: before?.cleanup };
        pending.push(() => { hooks[index].cleanup?.(); hooks[index].cleanup = effect(); });
      }
    },
  };
  const jsx = (type, props) => {
    const node = { type, props }; elements.push(node);
    if (props.ref) props.ref.current = type === "canvas" ? canvas : pageElement;
    return node;
  };
  class Observer {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe() {}
    disconnect() { this.disconnected = true; }
  }
  const mocks = {
    react,
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "lucide-react": { LoaderCircle: () => null, RefreshCw: () => null },
    "./ContractPdfPreview.module.css": { __esModule: true, default: {} },
    "pdfjs-dist/legacy/build/pdf.mjs": { GlobalWorkerOptions: {}, getDocument: () => task },
  };
  const window = {
    IntersectionObserver: Observer, devicePixelRatio: 2,
    setTimeout: (callback) => { timers.set(++timerId, callback); return timerId; },
    clearTimeout: (id) => timers.delete(id),
    addEventListener() {}, removeEventListener() {},
  };
  const loaded = { exports: {} };
  new Function("require", "module", "exports", "window", "document", "IntersectionObserver", "ResizeObserver", "requestAnimationFrame", "cancelAnimationFrame", compiled)(
    (specifier) => { assert.ok(Object.hasOwn(mocks, specifier), `Unexpected dependency: ${specifier}`); return mocks[specifier]; },
    loaded, loaded.exports, window, { createElement: () => makeCanvas() }, Observer, Observer, () => 1, () => {},
  );
  const component = loaded.exports[componentName];
  function commit(props = currentProps) {
    currentProps = props;
    let passes = 0;
    do {
      assert.ok(++passes < 15, "Effects settle without a render loop");
      dirty = false; cursor = 0; elements.length = 0;
      rendered = component(currentProps);
      while (pending.length) pending.shift()();
    } while (dirty);
    return rendered;
  }
  return {
    pdf, page, task, canvas, calls, observers, elements, timers, commit,
    async flush() { await settle(); commit(); await settle(); commit(); },
    intersect(value) { observers[0].callback([{ isIntersecting: value }]); commit(); },
    expire() { for (const callback of [...timers.values()]) callback(); commit(); },
    unmount() { for (const hook of hooks) hook?.cleanup?.(); },
    get rendered() { return rendered; },
  };
}

test("contract pages render near the viewport, release offscreen pixels, and render again on return", async () => {
  const h = harness();
  h.commit({ pdf: h.pdf, pageNumber: 2, width: 600, dpr: 2, tr: false });
  assert.equal(h.calls.length, 0, "Distant pages do not open or render yet");
  assert.equal(h.canvas.width, 0);
  h.intersect(true); await h.flush();
  assert.equal(h.rendered.props["data-ready"], true);
  assert.equal(h.canvas.width, 1200);
  assert.equal(h.canvas.height, 1800);
  assert.equal(h.calls.filter((call) => call.kind === "render").length, 1);
  h.intersect(false);
  assert.equal(h.canvas.width * h.canvas.height, 0, "Offscreen canvases release their backing store");
  assert.equal(h.rendered.props["data-ready"], false);
  h.intersect(true); await h.flush();
  assert.equal(h.rendered.props["data-ready"], true);
  assert.equal(h.calls.filter((call) => call.kind === "render").length, 2);
  h.unmount();
  assert.equal(h.canvas.width * h.canvas.height, 0);
  assert.equal(h.observers[0].disconnected, true);
  assert.equal(h.timers.size, 0);
});

test("contract rendering has bounded canvas allocation and recovers a failed page", async () => {
  let fail = true;
  const h = harness("ContractPdfPage", { page: {
    render: () => ({ promise: fail ? Promise.reject(new Error("Synthetic render failure")) : Promise.resolve(), cancel() {} }),
  } });
  h.commit({ pdf: h.pdf, pageNumber: 1, width: 8000, dpr: 3, tr: false });
  h.intersect(true); await h.flush();
  assert.equal(h.rendered.props["data-ready"], false);
  const retry = h.elements.find((element) => element.type === "button");
  assert.ok(retry, "Render errors expose a retry button");
  fail = false; retry.props.onClick(); h.commit(); await h.flush();
  assert.equal(h.rendered.props["data-ready"], true);
  assert.ok(h.canvas.width <= 4096 && h.canvas.height <= 4096);
  assert.ok(h.canvas.width * h.canvas.height <= 8_388_608);
  h.unmount();
});

test("a stalled PDF load ends with recovery and destroys the abandoned worker", async () => {
  const h = harness("default", { task: { promise: new Promise(() => {}) } });
  h.commit({ blob: new Blob(["synthetic PDF bytes"]), language: "en" });
  await h.flush();
  h.expire();
  assert.ok(h.elements.some((element) => element.props.role === "alert"));
  assert.ok(h.elements.some((element) => element.type === "button"));
  assert.equal(h.calls.filter((call) => call.kind === "destroy").length, 1);
  h.unmount();
});

test("an old document cannot return after its preview was replaced", async () => {
  let resolveDocument;
  const h = harness("default", { task: { promise: new Promise((resolve) => { resolveDocument = resolve; }) } });
  const firstBlob = new Blob(["first synthetic document"]);
  h.commit({ blob: firstBlob }); await h.flush();
  const replacement = new Blob(["replacement synthetic document"]);
  h.commit({ blob: replacement });
  h.unmount();
  resolveDocument(h.pdf);
  await settle();
  assert.ok(h.calls.some((call) => call.kind === "destroy"), "Abandoned document worker is destroyed");
  assert.equal(h.rendered.props["data-page-count"], 0, "Stale document does not populate the replacement preview");
});

test("document readiness follows successful PDF parsing rather than Blob creation", async () => {
  let resolveDocument;
  const states = [];
  const h = harness("default", { task: { promise: new Promise((resolve) => { resolveDocument = resolve; }) } });
  h.commit({ blob: new Blob(["synthetic PDF bytes"]), onDocumentReadyChange: (ready) => states.push(ready) });
  await h.flush();
  assert.deepEqual(states, [false], "A Blob alone does not enable signing or downloading");
  resolveDocument(h.pdf); await h.flush();
  assert.deepEqual(states, [false, true], "Only the successfully parsed PDF enables document actions");
  h.unmount();
  assert.deepEqual(states, [false, true, false], "Retiring the document clears its ready state");
});
