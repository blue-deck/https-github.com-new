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
function loadFields(language) {
  const cache = new Map();
  const elements = [];
  const navigations = [];
  const jsxRuntime = requireDependency("react/jsx-runtime");

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
        ? "Position, skill, language or any"
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
  assert.ok(html.includes("Position, skill, language or any"));
  assert.ok(html.includes("Search location"));
  fixture.elements.find(({ type, props }) => type === "button" && props.className === "submit").props.onClick();
  assert.deepEqual(fixture.navigations, ["/jobs"]);
});
