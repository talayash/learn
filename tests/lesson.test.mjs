import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { validate } from "../skills/learn/validate.mjs";

const example = JSON.parse(readFileSync(new URL("../examples/renderer-challenge.json", import.meta.url), "utf8"));
const template = readFileSync(new URL("../skills/learn/template.html", import.meta.url), "utf8");

function page(lesson) {
  const dom = new JSDOM(template, { runScripts: "outside-only" });
  const { window } = dom;
  window.IntersectionObserver = class { observe() {} };
  window.document.getElementById("lesson-data").textContent = JSON.stringify(lesson);
  // These fixtures have no diagrams, so the async renderer returns before importing Mermaid.
  window.eval(window.document.querySelector('script[type="module"]').textContent);
  return dom;
}

test("example validates and challenges reveal hints sequentially without revealing the solution", () => {
  assert.deepEqual(validate(example), []);
  const dom = page(example);
  const doc = dom.window.document;
  const button = doc.querySelector(".hint-button");
  const hints = doc.querySelector("#challenge-hints-0");
  const solution = doc.querySelector(".challenge details");
  assert.equal(hints.children.length, 0);
  assert.equal(solution.open, false);
  button.click();
  assert.equal(hints.children.length, 1);
  assert.equal(hints.firstChild.textContent, example.challenges[0].hints[0]);
  assert.equal(button.disabled, false);
  button.click();
  assert.equal(hints.children.length, 2);
  assert.equal(button.disabled, true);
  button.click();
  assert.equal(hints.children.length, 2);
  assert.equal(solution.open, false);
  assert.equal(solution.querySelector("p").textContent, example.challenges[0].solution);
  assert.ok(doc.querySelector('#toc a[href="#challenges"]'));
  dom.window.close();
});

test("snippets render literal code at all supported locations with source links", () => {
  const snippet = { ...example.snippets[0], code: '<img src=x onerror="alert(1)">\n</script>', startLine: 7 };
  const dom = page({
    title: "Code", tldr: ["Text"], root: "/repo",
    snippets: [snippet], patterns: [{ name: "Safety", snippets: [snippet] }],
    challenges: [{ ...example.challenges[0], snippets: [snippet] }],
  });
  const doc = dom.window.document;
  assert.equal(doc.querySelectorAll(".snippet").length, 3);
  for (const figure of doc.querySelectorAll(".snippet")) {
    assert.equal(figure.querySelector("code").textContent, snippet.code);
    assert.match(figure.querySelector("a").href, /render\.mjs:7$/);
    assert.match(figure.querySelector("figcaption").textContent, /lines 7–8/);
  }
  assert.equal(doc.querySelectorAll("img").length, 0);
  dom.window.close();
});

test("old minimal lessons render without new sections", () => {
  const dom = page({ title: "Old lesson", tldr: ["Still supported"] });
  assert.equal(dom.window.document.querySelector("#challenges"), null);
  assert.equal(dom.window.document.querySelector("#code"), null);
  dom.window.close();
});

test("malformed nested fields report paths instead of throwing", () => {
  const cases = [
    [[], "root"],
    [{ tldr: [42] }, "tldr[0]"],
    [{ quiz: {} }, "quiz"],
    [{ quiz: [null] }, "quiz[0]"],
    [{ patterns: [{ name: "x", tradeoffs: [] }] }, "patterns[0].tradeoffs"],
    [{ flows: [{ name: "x", steps: "wrong" }] }, "flows[0].steps"],
    [{ data: { cache: [null] } }, "data.cache[0]"],
    [{ resources: [null] }, "resources[0]"],
    [{ snippets: [{ ...example.snippets[0], startLine: 0 }] }, "snippets[0].startLine"],
    [{ challenges: [{ ...example.challenges[0], hints: [] }] }, "challenges[0].hints"],
    [{ challenges: [{ ...example.challenges[0], solution: null }] }, "challenges[0].solution"],
  ];
  for (const [fields, path] of cases) {
    const value = Array.isArray(fields) ? fields : { title: "Test", tldr: ["Text"], ...fields };
    assert.ok(validate(value).some(e => e.startsWith(path + ":")), path);
  }
});
