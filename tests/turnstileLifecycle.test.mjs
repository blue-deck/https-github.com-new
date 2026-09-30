import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const requireNative = createRequire(import.meta.url);
const root = new URL("../", import.meta.url);
const compiled = new Map();

function load(path, globals = {}, mocks = {}) {
  if (!compiled.has(path)) compiled.set(path, ts.transpileModule(readFileSync(new URL(path, root), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText);
  const loadedModule = { exports: {} };
  const require = (name) => name in mocks ? mocks[name] : requireNative(name);
  new Function("require", "module", "exports", ...Object.keys(globals), compiled.get(path))(
    require, loadedModule, loadedModule.exports, ...Object.values(globals),
  );
  return loadedModule.exports;
}

function browser() {
  const scripts = [];
  const timers = new Map();
  let nextTimer = 0;
  const document = Object.assign(new EventTarget(), {
    visibilityState: "visible",
    getElementById(id) { return scripts.find((script) => script.id === id) || null; },
    createElement() {
      const script = new EventTarget();
      script.remove = () => { const i = scripts.indexOf(script); if (i !== -1) scripts.splice(i, 1); };
      return script;
    },
    head: { appendChild(script) { scripts.push(script); } },
  });
  const window = {
    setTimeout(callback, delay) { const id = ++nextTimer; timers.set(id, { callback, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
  };
  return { window, document, scripts, timers };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

test("concurrent widgets share one async script and resolve on load without calling incompatible ready", async () => {
  const context = browser();
  const { loadTurnstile } = load("app/lib/turnstileClient.ts", context);
  const first = loadTurnstile();
  assert.equal(loadTurnstile(), first);
  assert.equal(context.scripts.length, 1);
  assert.equal(context.scripts[0].async, true);
  let readyCalls = 0;
  const api = {
    render() {},
    ready() {
      readyCalls++;
      throw new Error("[Cloudflare Turnstile] Remove async/defer from the Turnstile api.js script tag before using turnstile.ready()..");
    },
  };
  context.window.turnstile = api;
  let resolved = false;
  first.then(() => { resolved = true; });
  await flush();
  assert.equal(resolved, false, "the shared loader waits for the script load event");
  context.scripts[0].dispatchEvent(new Event("load"));
  assert.equal(readyCalls, 0, "async Turnstile scripts must not call turnstile.ready()");
  assert.equal(await first, api);
  assert.equal(loadTurnstile(), first, "later forms reuse the successful load");
  assert.equal(context.timers.size, 0);
  context.scripts[0].dispatchEvent(new Event("error"));
  assert.equal(await loadTurnstile(), api, "late script events cannot invalidate the loaded API");
});

test("an API already loaded by a previous form is reused without injecting a script or calling ready", async () => {
  const context = browser();
  const api = {
    render() {},
    ready() { assert.fail("ready is incompatible with the async script"); },
  };
  context.window.turnstile = api;
  const { loadTurnstile } = load("app/lib/turnstileClient.ts", context);
  assert.equal(await loadTurnstile(), api);
  assert.equal(context.scripts.length, 0);
  assert.equal(context.timers.size, 0);
});

test("failed or blocked script loads are removed so navigation/manual retry can recover", async () => {
  for (const kind of ["error", "timeout", "missing-api"]) {
    const context = browser();
    const { loadTurnstile } = load("app/lib/turnstileClient.ts", context);
    const pending = loadTurnstile();
    const rejected = assert.rejects(pending, /could not load/);
    const oldScript = context.scripts[0];
    if (kind === "error") oldScript.dispatchEvent(new Event("error"));
    else if (kind === "timeout") [...context.timers.values()][0].callback();
    else oldScript.dispatchEvent(new Event("load"));
    await rejected;
    assert.equal(context.scripts.length, 0);
    assert.equal(context.timers.size, 0);
    const retry = loadTurnstile();
    assert.equal(context.scripts.length, 1);
    assert.notEqual(context.scripts[0], oldScript);
    const api = { render() {} };
    context.window.turnstile = api;
    context.scripts[0].dispatchEvent(new Event("load"));
    assert.equal(await retry, api);
  }
});

function reactHarness() {
  const values = [], effects = [], pending = [];
  let cursor = 0;
  const react = {
    useRef(value) { const i = cursor++; return values[i] ||= { current: value }; },
    useState(initial) {
      const i = cursor++;
      if (!(i in values)) values[i] = initial;
      return [values[i], (next) => { values[i] = typeof next === "function" ? next(values[i]) : next; }];
    },
    useEffect(effect, deps) {
      const i = cursor++;
      if (!effects[i] || deps.some((dep, index) => !Object.is(dep, effects[i].deps[index]))) {
        pending.push(() => { effects[i]?.cleanup?.(); effects[i] = { deps, cleanup: effect() }; });
      }
    },
  };
  return {
    react, values,
    render(component, props) { cursor = 0; return component(props); },
    commit() { while (pending.length) pending.shift()(); },
    unmount() { effects.forEach((effect) => effect?.cleanup?.()); },
  };
}

test("removed widgets cannot overwrite a new form token, while error/expiry clear the active token", async () => {
  const context = browser();
  const hooks = reactHarness();
  const options = [], removed = [];
  const api = { render(container, opts) { options.push(opts); return String(options.length); }, remove(id) { removed.push(id); } };
  context.window.turnstile = api;
  const { TurnstileWidget } = load("app/components/TurnstileWidget.tsx", context, {
    react: hooks.react, "../lib/turnstileClient": { loadTurnstile: async () => api },
  });
  let token = "", errors = 0;
  const props = { siteKey: "0xAAAAAAAAAAAAAAAAAAAAAA", size: "flexible", action: "account_access", onVerify(value) { token = value; }, onExpire() { token = ""; }, onError() { token = ""; errors++; } };
  hooks.render(TurnstileWidget, props);
  hooks.values[0].current = {};
  hooks.commit();
  await flush();
  options[0].callback("first-token");
  assert.equal(token, "first-token");
  hooks.render(TurnstileWidget, { ...props, action: "signup" });
  hooks.commit();
  await flush();
  assert.deepEqual(removed, ["1"]);
  assert.equal(token, "");
  options[0].callback("stale-token");
  assert.equal(token, "");
  options[1].callback("current-token");
  options[0]["error-callback"]("old-error");
  assert.equal(token, "current-token");
  assert.equal(errors, 0);
  options[1]["expired-callback"]();
  assert.equal(token, "");
  options[1].callback("new-token");
  options[1]["error-callback"]("300000");
  assert.equal(token, "");
  assert.equal(errors, 1);
  assert.equal(options[1].retry, "auto");
  assert.equal(options[1]["refresh-expired"], "auto");
  assert.equal(options[1]["refresh-timeout"], "auto");
  hooks.unmount();
  options[1].callback("after-unmount");
  assert.equal(token, "");
});

test("responsive widget selects compact below 300px and replaces tokens only across size changes", async () => {
  const context = browser();
  const hooks = reactHarness();
  const options = [], removed = [], observers = [];
  let width = 196, token = "";
  class ResizeObserver {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe(element) { this.element = element; }
    disconnect() { this.disconnected = true; }
  }
  const api = { render(container, opts) { options.push(opts); return String(options.length); }, remove(id) { removed.push(id); } };
  context.window.turnstile = api;
  const { TurnstileWidget } = load("app/components/TurnstileWidget.tsx", { ...context, ResizeObserver }, {
    react: hooks.react, "../lib/turnstileClient": { loadTurnstile: async () => api },
  });
  const props = { siteKey: "0xAAAAAAAAAAAAAAAAAAAAAA", onVerify(value) { token = value; }, onExpire() { token = ""; }, onError() { token = ""; } };
  hooks.render(TurnstileWidget, props);
  hooks.values[0].current = {};
  hooks.values[2].current = { getBoundingClientRect: () => ({ width }) };
  hooks.commit();
  await flush();
  assert.equal(options.length, 0, "waits for first container measurement");
  hooks.render(TurnstileWidget, props);
  hooks.commit();
  await flush();
  assert.equal(options[0].size, "compact");
  options[0].callback("narrow-token");
  width = 266;
  observers[0].callback();
  hooks.render(TurnstileWidget, props);
  hooks.commit();
  await flush();
  assert.equal(options.length, 1, "resizing within compact retains the widget");
  assert.equal(token, "narrow-token");
  width = 300;
  observers[0].callback();
  hooks.render(TurnstileWidget, props);
  hooks.commit();
  await flush();
  assert.equal(options[1].size, "flexible");
  assert.deepEqual(removed, ["1"]);
  assert.equal(token, "");
  options[0].callback("stale-narrow-token");
  assert.equal(token, "");
  options[1].callback("wide-token");
  width = 299;
  observers[0].callback();
  hooks.render(TurnstileWidget, props);
  hooks.commit();
  await flush();
  assert.equal(options[2].size, "compact");
  assert.equal(token, "");
  hooks.render(TurnstileWidget, { ...props, size: "normal" });
  hooks.commit();
  await flush();
  assert.equal(options[3].size, "normal", "explicit size remains authoritative");
  assert.equal(observers[0].disconnected, true);
  hooks.unmount();
  assert.deepEqual(removed, ["1", "2", "3", "4"]);
});

test("configuration failure without a compiled key keeps verification required and offers retry", async () => {
  const context = browser();
  const hooks = reactHarness();
  const { plausibleTurnstileSiteKey } = load("app/lib/turnstileClient.ts", context);
  const { useTurnstileConfiguration } = load("app/lib/useTurnstileConfiguration.ts", {
    ...context, process: { env: {} }, fetch: async () => { throw new Error("offline"); },
  }, { react: hooks.react, "./turnstileClient": { plausibleTurnstileSiteKey } });
  hooks.render(useTurnstileConfiguration);
  hooks.commit();
  await flush();
  let result = hooks.render(useTurnstileConfiguration);
  assert.equal(result.ready, false);
  assert.equal(result.enabled, true);
  assert.equal(result.unavailable, true);
  result.retry();
  result = hooks.render(useTurnstileConfiguration);
  assert.equal(result.ready, false);
  assert.equal(result.unavailable, false);
  hooks.unmount();
});

test("valid compiled key recovers a failed probe and runtime site keys are validated", async () => {
  const validKey = "0xAAAAAAAAAAAAAAAAAAAAAA";
  for (const payload of [null, { enabled: true, siteKey: "placeholder-key-not-real" }]) {
    const context = browser();
    const hooks = reactHarness();
    const { plausibleTurnstileSiteKey } = load("app/lib/turnstileClient.ts", context);
    const { useTurnstileConfiguration } = load("app/lib/useTurnstileConfiguration.ts", {
      ...context, process: { env: { NEXT_PUBLIC_TURNSTILE_SITE_KEY: validKey } }, fetch: async () => Response.json(payload),
    }, { react: hooks.react, "./turnstileClient": { plausibleTurnstileSiteKey } });
    hooks.render(useTurnstileConfiguration);
    hooks.commit();
    await flush();
    const result = hooks.render(useTurnstileConfiguration);
    assert.equal(result.ready, true);
    assert.equal(result.enabled, true);
    assert.equal(result.siteKey, validKey);
    hooks.unmount();
  }
});
