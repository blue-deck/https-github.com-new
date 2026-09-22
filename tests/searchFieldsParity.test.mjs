import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const root = new URL("../", import.meta.url);
const requireDependency = createRequire(import.meta.url);

// Render the production field components and retain their real DOM callbacks.
// Only the app-wide language context is supplied by this isolated fixture.
function loadFields(language, { statefulHome = false } = {}) {
  const cache = new Map();
  const elements = [];
  const navigations = [];
  const jsxRuntime = requireDependency("react/jsx-runtime");
  const homeHookSlots = new Map();
  let homeHookCursor = 0;

  function load(file) {
    if (cache.has(file.href)) return cache.get(file.href).exports;
    const compiled = ts.transpileModule(readFileSync(file, "utf8"), {
      fileName: file.pathname,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    }).outputText;
    const loaded = { exports: {} };
    cache.set(file.href, loaded);
    function requireLocal(specifier) {
      // The callback tests drive just the homepage controller with persistent
      // state/ref slots. Field rendering above still uses React's real hooks;
      // browser coverage verifies the DOM lifecycle and responsive presentation.
      if (statefulHome && specifier === "react" && file.pathname.endsWith("/app/DesktopHomeSearch.tsx")) {
        return {
          ...requireDependency("react"),
          useId: () => "home-search-fixture",
          useRef(value) {
            const slot = homeHookCursor++;
            if (!homeHookSlots.has(slot)) homeHookSlots.set(slot, { current: value });
            return homeHookSlots.get(slot);
          },
          useState(initialValue) {
            const slot = homeHookCursor++;
            if (!homeHookSlots.has(slot)) {
              homeHookSlots.set(slot, typeof initialValue === "function" ? initialValue() : initialValue);
            }
            return [homeHookSlots.get(slot), (update) => {
              homeHookSlots.set(slot, typeof update === "function" ? update(homeHookSlots.get(slot)) : update);
            }];
          },
        };
      }
      if (specifier === "react/jsx-runtime") {
        return {
          ...jsxRuntime,
          jsx(type, props, key) {
            elements.push({ type, props });
            return jsxRuntime.jsx(type, props, key);
          },
          jsxs(type, props, key) {
            elements.push({ type, props });
            return jsxRuntime.jsxs(type, props, key);
          },
        };
      }
      if (specifier === "next/navigation") return { useRouter: () => ({ push: (href) => navigations.push(href) }) };
      if (specifier === "next/link") return { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) };
      if (!specifier.startsWith(".")) return requireDependency(specifier);
      const resolved = [specifier, `${specifier}.ts`, `${specifier}.tsx`]
        .map((candidate) => new URL(candidate, file))
        .find((candidate) => existsSync(candidate));
      assert.ok(resolved, `Cannot resolve ${specifier}`);
      if (resolved.pathname.endsWith(".css")) {
        return { __esModule: true, default: new Proxy({}, { get: (_, name) => name }) };
      }
      if (resolved.pathname.endsWith("/components/LanguageProvider.tsx")) {
        return { useLanguage: () => ({ language }) };
      }
      return load(resolved);
    }
    new Function("require", "module", "exports", compiled)(
      requireLocal, loaded, loaded.exports,
    );
    return loaded.exports;
  }

  return {
    jobs: load(new URL("app/components/JobSearchFields.tsx", root)),
    crew: load(new URL("app/components/CrewSearchFields.tsx", root)),
    home: () => load(new URL("app/DesktopHomeSearch.tsx", root)).DesktopHomeSearch,
    elements,
    navigations,
    renderHomeController() {
      assert.equal(statefulHome, true);
      elements.length = 0;
      homeHookCursor = 0;
      const HomeSearch = load(new URL("app/DesktopHomeSearch.tsx", root)).DesktopHomeSearch;
      HomeSearch({ language });
    },
    render(Component, props) {
      elements.length = 0;
      return renderToStaticMarkup(React.createElement(Component, props));
    },
  };
}

for (const language of ["en", "tr"]) {
  test(`shared ${language} keyword controls preserve exact copy, controlled values and explicit search`, () => {
    const fixture = loadFields(language);
    for (const [Component, placeholder] of [
      [fixture.jobs.JobKeywordSearchField, language === "en"
        ? "Position, location, yacht type or any"
        : "Pozisyon, beceri, dil veya herhangi bir anahtar kelime"],
      [fixture.crew.CrewKeywordSearchField, language === "en"
        ? "Position, skills, language or any"
        : "Pozisyon, beceri, dil veya diğer"],
    ]) {
      const updates = [];
      let searches = 0;
      const html = fixture.render(Component, {
        language,
        value: "Refit captain",
        inputId: "fixture-keyword",
        onChange: (value) => updates.push(value),
        onKeywordSearch: () => searches++,
      });
      const input = fixture.elements.find(({ type }) => type === "input").props;
      const button = fixture.elements.find(({ type }) => type === "button").props;
      assert.equal(input.placeholder, placeholder);
      assert.equal(input.value, "Refit captain");
      assert.equal(input.maxLength, 120);
      assert.match(html, /for="fixture-keyword"/);
      assert.ok(html.includes(language === "en" ? "Keyword" : "Anahtar kelime"));
      input.onChange({ target: { value: "istanbul" } });
      assert.deepEqual(updates, [language === "tr" ? "İstanbul" : "Istanbul"]);
      assert.equal(searches, 0, "typing must not apply filters");
      let prevented = false;
      input.onKeyDown({ key: "Enter", preventDefault: () => { prevented = true; } });
      assert.equal(prevented, true);
      assert.equal(searches, 1);
      assert.equal(button.type, "button", "keyword search must not submit the entire filter form");
      button.onClick();
      assert.equal(searches, 2);
    }
  });

  test(`shared ${language} position controls preserve selected roles and the 12-selection boundary`, () => {
    const fixture = loadFields(language);
    for (const Component of [fixture.jobs.JobPositionSearchField, fixture.crew.CrewPositionSearchField]) {
      const updates = [];
      fixture.render(Component, { language, values: [], onChange: (values) => updates.push(values) });
      const emptySummary = fixture.elements.find(({ type }) => type === "summary").props;
      assert.equal(emptySummary["aria-label"], language === "en" ? "Position: All positions" : "Pozisyon: Tüm pozisyonlar");

      const html = fixture.render(Component, { language, values: ["Captain", "Deckhand"], onChange: (values) => updates.push(values) });
      assert.ok(html.includes(language === "en" ? "2 selected" : "2 seçili"));
      const checkboxes = fixture.elements.filter(({ type, props }) => type === "input" && props.type === "checkbox");
      assert.equal(checkboxes.filter(({ props }) => props.checked).length, 2);
      assert.ok(checkboxes.every(({ props }) => !props.disabled));
      checkboxes.find(({ props }) => props.checked).props.onChange();
      assert.equal(updates.at(-1).length, 1);
      assert.ok(updates.at(-1).every((value) => ["Captain", "Deckhand"].includes(value)));

      const roles = fixture.elements
        .filter(({ type, props }) => type === "span" && Object.hasOwn(props, "data-i18n-ignore"))
        .map(({ props }) => props.children);
      fixture.render(Component, { language, values: roles.slice(0, 12), onChange: () => {} });
      const limited = fixture.elements.filter(({ type, props }) => type === "input" && props.type === "checkbox");
      assert.equal(limited.filter(({ props }) => props.checked).length, 12);
      assert.ok(limited.every(({ props }) => props.checked ? !props.disabled : props.disabled));
      let prevented = false;
      fixture.elements.find(({ type, props }) => type === "input" && props.type === "search")
        .props.onKeyDown({ key: "Enter", preventDefault: () => { prevented = true; } });
      assert.equal(prevented, true, "searching the position list must not submit the outer form");
    }
  });

  test(`shared ${language} location and nationality render their selected destination values`, () => {
    const fixture = loadFields(language);
    fixture.render(fixture.jobs.JobLocationSearchField, {
      language, value: "Athens, Greece", onChange: () => {},
    });
    const location = fixture.elements.find(({ type, props }) => type === "input" && props.role === "combobox").props;
    assert.equal(location.value, "Athens, Greece");
    assert.equal(location.placeholder, language === "en" ? "Search location" : "Konum ara");
    assert.equal(location.maxLength, 120);
    fixture.render(fixture.crew.CrewNationalitySearchField, {
      language, value: "Turkey", onChange: () => {},
    });
    const nationality = fixture.elements.find(({ type, props }) => type === "input" && props.role === "combobox").props;
    assert.equal(nationality.value, language === "en" ? "Turkey" : "Türkiye");
    assert.equal(nationality.placeholder, language === "en" ? "Nationality" : "Uyruklar");
  });
}

test("homepage initially renders the real Careers fields with an accessible selected tab and working search", () => {
  const fixture = loadFields("en");
  const html = fixture.render(fixture.home(), { language: "en" });
  for (const Component of [fixture.jobs.JobKeywordSearchField, fixture.jobs.JobPositionSearchField, fixture.jobs.JobLocationSearchField]) {
    assert.equal(fixture.elements.filter(({ type }) => type === Component).length, 1);
  }
  const tabs = fixture.elements.filter(({ type, props }) => type === "button" && props.role === "tab");
  assert.equal(tabs.length, 2);
  assert.deepEqual(tabs.map(({ props }) => props["aria-selected"]), [true, false]);
  assert.deepEqual(tabs.map(({ props }) => props.tabIndex), [0, -1]);
  const panel = fixture.elements.find(({ props }) => props.role === "tabpanel").props;
  assert.equal(panel["aria-labelledby"], tabs[0].props.id);
  assert.equal(panel.id, tabs[0].props["aria-controls"]);
  assert.match(html, /href="\/yacht-os"/);
  assert.ok(html.includes("Position, location, yacht type or any"));
  assert.ok(html.includes("Search location"));
  fixture.elements.find(({ type, props }) => type === "button" && props.className === "submit").props.onClick();
  assert.deepEqual(fixture.navigations, ["/jobs"]);
});

function homeController(language = "en") {
  const fixture = loadFields(language, { statefulHome: true });
  const propsFor = (Component) => {
    const element = fixture.elements.find(({ type }) => type === Component);
    assert.ok(element, `Expected active field ${Component.name}`);
    return element.props;
  };
  const tabs = () => fixture.elements.filter(({ type, props }) => type === "button" && props.role === "tab");
  const render = () => fixture.renderHomeController();
  const select = (index) => {
    tabs()[index].props.onClick();
    render();
  };
  const searchAll = () => fixture.elements.find(({ type, props }) => type === "button" && props.className === "submit").props.onClick();
  render();
  return { ...fixture, propsFor, tabs, render, select, searchAll };
}

test("homepage Careers and Crew tabs preserve independent drafts without navigating on edits or tab changes", () => {
  const home = homeController();
  home.propsFor(home.jobs.JobKeywordSearchField).onChange("Refit captain");
  home.propsFor(home.jobs.JobPositionSearchField).onChange(["Captain", "Deckhand"]);
  home.propsFor(home.jobs.JobLocationSearchField).onChange("Athens, Greece");
  home.select(1);

  assert.deepEqual(home.tabs().map(({ props }) => props["aria-selected"]), [false, true]);
  assert.equal(home.propsFor(home.crew.CrewKeywordSearchField).value, "");
  assert.deepEqual(home.propsFor(home.crew.CrewPositionSearchField).values, []);
  assert.equal(home.propsFor(home.crew.CrewNationalitySearchField).value, "");
  home.propsFor(home.crew.CrewKeywordSearchField).onChange("Silver service");
  home.propsFor(home.crew.CrewPositionSearchField).onChange(["Chief Stewardess"]);
  home.propsFor(home.crew.CrewNationalitySearchField).onChange("Turkey");
  home.select(0);

  assert.equal(home.propsFor(home.jobs.JobKeywordSearchField).value, "Refit captain");
  assert.deepEqual(home.propsFor(home.jobs.JobPositionSearchField).values, ["Captain", "Deckhand"]);
  assert.equal(home.propsFor(home.jobs.JobLocationSearchField).value, "Athens, Greece");
  home.select(1);
  assert.equal(home.propsFor(home.crew.CrewKeywordSearchField).value, "Silver service");
  assert.deepEqual(home.propsFor(home.crew.CrewPositionSearchField).values, ["Chief Stewardess"]);
  assert.equal(home.propsFor(home.crew.CrewNationalitySearchField).value, "Turkey");
  assert.deepEqual(home.navigations, []);
});

test("homepage main search transfers all active filters while keyword action transfers only its keyword", () => {
  const home = homeController();
  home.propsFor(home.jobs.JobKeywordSearchField).onChange("  Refit   captain  ");
  home.propsFor(home.jobs.JobPositionSearchField).onChange(["Deckhand", "Captain"]);
  home.propsFor(home.jobs.JobLocationSearchField).onChange("Athens, Greece");
  home.render();
  home.searchAll();
  const careers = new URL(home.navigations.at(-1), "https://bluedeck.test");
  assert.equal(careers.pathname, "/jobs");
  assert.deepEqual([...careers.searchParams], [
    ["q", "Refit captain"], ["position", "Captain"], ["position", "Deckhand"], ["location", "Athens, Greece"],
  ]);
  home.propsFor(home.jobs.JobKeywordSearchField).onKeywordSearch();
  const careerKeyword = new URL(home.navigations.at(-1), "https://bluedeck.test");
  assert.equal(careerKeyword.pathname, "/jobs");
  assert.deepEqual([...careerKeyword.searchParams], [["q", "Refit captain"]]);

  home.select(1);
  home.propsFor(home.crew.CrewKeywordSearchField).onChange("  Silver   service ");
  home.propsFor(home.crew.CrewPositionSearchField).onChange(["Chief Stewardess", "Deckhand"]);
  home.propsFor(home.crew.CrewNationalitySearchField).onChange("Turkish");
  home.render();
  home.searchAll();
  const crew = new URL(home.navigations.at(-1), "https://bluedeck.test");
  assert.equal(crew.pathname, "/find-crew");
  assert.deepEqual([...crew.searchParams], [
    ["q", "Silver service"], ["position", "Chief Stewardess"], ["position", "Deckhand"], ["nationality", "Turkey"],
  ]);
  home.propsFor(home.crew.CrewKeywordSearchField).onKeywordSearch();
  const crewKeyword = new URL(home.navigations.at(-1), "https://bluedeck.test");
  assert.equal(crewKeyword.pathname, "/find-crew");
  assert.deepEqual([...crewKeyword.searchParams], [["q", "Silver service"]]);
  assert.equal(home.navigations.length, 4);
});

test("homepage keyboard tab navigation moves focus and keeps the active panel relationship synchronized", () => {
  const home = homeController("tr");
  const focused = [];
  for (const [index, tab] of home.tabs().entries()) {
    tab.props.ref.current = { focus: () => focused.push(index) };
  }
  for (const [key, expectedIndex] of [["ArrowRight", 1], ["ArrowLeft", 0], ["End", 1], ["Home", 0]]) {
    const active = home.tabs().find(({ props }) => props["aria-selected"]);
    let prevented = false;
    active.props.onKeyDown({ key, preventDefault: () => { prevented = true; } });
    home.render();
    assert.equal(prevented, true);
    assert.equal(focused.at(-1), expectedIndex);
    const tabs = home.tabs();
    assert.deepEqual(tabs.map(({ props }) => props["aria-selected"]), [expectedIndex === 0, expectedIndex === 1]);
    assert.equal(tabs[expectedIndex].props.tabIndex, 0);
    assert.equal(tabs[1 - expectedIndex].props.tabIndex, -1);
    const panel = home.elements.find(({ props }) => props.role === "tabpanel").props;
    assert.equal(panel["aria-labelledby"], tabs[expectedIndex].props.id);
    assert.equal(panel.id, tabs[expectedIndex].props["aria-controls"]);
  }
  home.tabs()[0].props.onKeyDown({ key: "Tab", preventDefault: () => assert.fail("normal Tab navigation must remain native") });
  assert.equal(focused.length, 4);
  assert.deepEqual(home.navigations, []);
});
