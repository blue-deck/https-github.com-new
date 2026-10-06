import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const requireDependency = createRequire(import.meta.url);
const componentFile = new URL("../app/crew/tasks/TaskCompletionControl.tsx", import.meta.url);
const compiled = ts.transpileModule(readFileSync(componentFile, "utf8"), {
  fileName: componentFile.pathname,
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX,
    esModuleInterop: true,
  },
}).outputText;

function loadControl(language = "en") {
  const elements = [];
  const loaded = { exports: {} };
  const jsxRuntime = requireDependency("react/jsx-runtime");
  function requireLocal(specifier) {
    if (specifier === "react") {
      return { ...React, useId: () => `task-control-${language}` };
    }
    if (specifier === "../../components/LanguageProvider") {
      return { useLanguage: () => ({ language }) };
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
    return requireDependency(specifier);
  }
  new Function("require", "module", "exports", compiled)(requireLocal, loaded, loaded.exports);

  return {
    elements,
    render(overrides = {}) {
      elements.length = 0;
      const tree = loaded.exports.TaskCompletionControl({
        task: { task_text: "Inspect the engine room", completed: false },
        pending: false,
        disabled: false,
        error: false,
        onToggle() {},
        ...overrides,
      });
      return { tree, html: renderToStaticMarkup(tree) };
    },
    checkbox() {
      const buttons = elements.filter(({ type }) => type === "button");
      assert.equal(buttons.length, 1);
      assert.equal(buttons[0].props.role, "checkbox");
      return buttons[0];
    },
    accessibleName() {
      return this.checkbox().props["aria-labelledby"].split(/\s+/).map((id) => {
        const label = elements.find(({ props }) => props.id === id);
        assert.ok(label, `missing accessible label ${id}`);
        assert.equal(typeof label.props.children, "string");
        return label.props.children;
      }).join(" ");
    },
  };
}

test("only the trailing checkbox button can complete a task; text and surrounding space stay passive", () => {
  const fixture = loadControl();
  let toggles = 0;
  const { tree } = fixture.render({ onToggle: () => { toggles += 1; } });
  const button = fixture.checkbox();
  assert.equal(button.props.type, "button", "must not submit an enclosing form");
  const handlers = fixture.elements.filter(({ type, props }) =>
    typeof type === "string" && Object.keys(props).some((key) => /^on[A-Z]/.test(key)),
  );
  assert.deepEqual(handlers, [button]);

  const row = tree.props.children[0];
  const [taskText, controlColumn] = row.props.children;
  assert.equal(taskText.type, "p");
  assert.equal(taskText.props.children, "Inspect the engine room");
  assert.equal(taskText.props.onClick, undefined);
  assert.equal(taskText.props.role, undefined);
  assert.equal(taskText.props.tabIndex, undefined);
  assert.equal(row.type, "div");
  assert.equal(row.props.onClick, undefined);
  assert.equal(tree.props.onClick, undefined);
  assert.equal(controlColumn.props.children[0].type, "button");
  assert.equal(controlColumn.props.children[0].props.onClick, button.props.onClick);
  assert.match(row.props.className, /justify-between/);
  assert.match(button.props.className, /\bh-12\b/);
  assert.match(button.props.className, /\bw-12\b/);
  assert.doesNotMatch(button.props.className, /\bw-full\b/);
  assert.equal(fixture.elements.some(({ type }) => type === "label"), false);
  assert.equal(toggles, 0);
  button.props.onClick();
  assert.equal(toggles, 1);
});

for (const language of ["en", "tr"]) {
  test(`${language} checkbox exposes task name and confirmed completion state`, () => {
    const fixture = loadControl(language);
    const taskText = "Inspect deck / Güverteyi kontrol et";
    for (const completed of [false, true]) {
      const { tree, html } = fixture.render({ task: { task_text: taskText, completed } });
      const button = fixture.checkbox();
      assert.equal(button.props["aria-checked"], completed);
      assert.equal(button.props.disabled, false);
      assert.equal(button.props["aria-busy"], false);
      assert.equal(tree.props["data-i18n-ignore"], true);
      const action = language === "tr"
        ? completed ? "Tamamlandı" : "Tamamla"
        : completed ? "Completed" : "Mark complete";
      assert.equal(fixture.accessibleName(), `${action} ${taskText}`);
      assert.ok(html.includes(`aria-checked="${completed}"`));
      assert.equal(button.props["aria-describedby"], undefined);
      assert.equal(fixture.elements.some(({ props }) => props.role === "alert"), false);
    }
  });

  test(`${language} pending save disables only the control and keeps the last confirmed state`, () => {
    const fixture = loadControl(language);
    for (const completed of [false, true]) {
      fixture.render({ task: { task_text: "Check equipment", completed }, pending: true });
      const button = fixture.checkbox();
      assert.equal(button.props.disabled, true);
      assert.equal(button.props["aria-busy"], true);
      assert.equal(button.props["aria-checked"], completed);
      assert.equal(fixture.accessibleName(), `${language === "tr" ? "Kaydediliyor" : "Saving"} Check equipment`);
      const status = fixture.elements.find(({ props }) => props.id === `task-control-${language}-action`);
      assert.equal(status.props["aria-live"], "polite");
    }
  });

  test(`${language} failure is an associated alert and leaves an available retry control`, () => {
    const fixture = loadControl(language);
    fixture.render({ error: true });
    const button = fixture.checkbox();
    const alerts = fixture.elements.filter(({ props }) => props.role === "alert");
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].type, "p");
    assert.equal(button.props["aria-describedby"], alerts[0].props.id);
    assert.equal(alerts[0].props.children, language === "tr"
      ? "Kaydedilemedi. Tekrar denemek için kutuya basın."
      : "Couldn’t save. Select the checkbox to try again.");
    assert.equal(button.props.disabled, false);
    assert.equal(button.props["aria-checked"], false);
  });
}

test("completed or otherwise locked lists keep their completion control disabled", () => {
  const fixture = loadControl();
  for (const completed of [false, true]) {
    const { html } = fixture.render({ task: { task_text: "Locked task", completed }, disabled: true });
    assert.equal(fixture.checkbox().props.disabled, true);
    assert.equal(fixture.checkbox().props["aria-busy"], false);
    assert.match(html, /disabled=""/);
  }
});
