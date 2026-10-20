// Run with: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const render = join(root, "skills", "learn", "render.mjs");

function run(lesson) {
  const dir = mkdtempSync(join(tmpdir(), "learn-"));
  const input = join(dir, "lesson.json");
  writeFileSync(input, typeof lesson === "string" ? lesson : JSON.stringify(lesson));
  const out = join(dir, "out");
  const res = spawnSync(process.execPath, [render, input, "--out", out, "--no-open"], { encoding: "utf8" });
  return { ...res, out };
}

test("renders the bundled example", () => {
  const res = run(readFileSync(join(root, "examples", "checkout-api.json"), "utf8"));
  assert.equal(res.status, 0, res.stderr);
  const files = readdirSync(res.out);
  assert.ok(files.some((f) => f.endsWith("-idempotent-checkout-api-with-a-redis-cart-cache.html")));
  assert.ok(files.includes("index.html"));
  assert.ok(files.includes("history.json"));
});

test("lesson text cannot close the data script tag", () => {
  const res = run({ title: "x</script><script>alert(1)</script>", tldr: ["<img src=x onerror=alert(1)>"] });
  assert.equal(res.status, 0, res.stderr);
  const page = readdirSync(res.out).find((f) => f !== "index.html" && f.endsWith(".html"));
  const html = readFileSync(join(res.out, page), "utf8");
  assert.equal(html.match(/<\/script>/g).length, 2, "only the template's own two script tags may close");
  assert.ok(!html.includes("<img src=x"));
});

test("history index escapes titles", () => {
  const res = run({ title: "<b>bold</b>", tldr: ["t"] });
  const index = readFileSync(join(res.out, "index.html"), "utf8");
  assert.ok(index.includes("&lt;b&gt;bold&lt;/b&gt;"));
});

test("rejects a lesson without title or tldr", () => {
  const res = run({ title: "" });
  assert.equal(res.status, 1);
  assert.match(res.stderr, /title: required/);
  assert.match(res.stderr, /tldr: required/);
});

test("rejects a quiz answer outside its options", () => {
  const res = run({ title: "t", tldr: ["t"], quiz: [{ q: "q", options: ["a", "b"], answer: 2 }] });
  assert.equal(res.status, 1);
  assert.match(res.stderr, /quiz\[0\]\.answer/);
});

test("rejects non-http resource links", () => {
  const res = run({ title: "t", tldr: ["t"], resources: [{ title: "x", url: "javascript:alert(1)" }] });
  assert.equal(res.status, 1);
  assert.match(res.stderr, /resources\[0\]\.url/);
});

test("tampered history entries are dropped from the index", () => {
  const dir = mkdtempSync(join(tmpdir(), "learn-"));
  const out = join(dir, "out");
  execFileSync(process.execPath, ["-e", "require('fs').mkdirSync(process.argv[1])", out]);
  writeFileSync(join(out, "history.json"), JSON.stringify([{ file: "javascript:alert(1)", title: "evil" }]));
  const input = join(dir, "lesson.json");
  writeFileSync(input, JSON.stringify({ title: "Real", tldr: ["t"] }));
  execFileSync(process.execPath, [render, input, "--out", out, "--no-open"]);
  const index = readFileSync(join(out, "index.html"), "utf8");
  assert.ok(!index.includes("javascript:"));
  assert.ok(index.includes("Real"));
});

test("same title on the same day does not overwrite", () => {
  const dir = mkdtempSync(join(tmpdir(), "learn-"));
  const input = join(dir, "lesson.json");
  writeFileSync(input, JSON.stringify({ title: "Same", tldr: ["t"] }));
  const out = join(dir, "out");
  for (let i = 0; i < 2; i++) execFileSync(process.execPath, [render, input, "--out", out, "--no-open"]);
  assert.equal(readdirSync(out).filter((f) => f.includes("-same")).length, 2);
});

test("challenge snippets preserve hostile-looking source as JSON data", () => {
  const lesson = JSON.parse(readFileSync(join(root, "examples", "renderer-challenge.json"), "utf8"));
  const code = '</script><img src=x onerror=alert(1)>\nconst value = "hello";';
  lesson.snippets[0].code = code;
  const res = run(lesson);
  assert.equal(res.status, 0, res.stderr);
  const file = readdirSync(res.out).find(f => f !== "index.html" && f.endsWith(".html"));
  const html = readFileSync(join(res.out, file), "utf8");
  assert.equal(html.match(/<\/script>/g).length, 2);
  assert.ok(!html.includes("<img src=x"));
  const payload = html.match(/<script id="lesson-data" type="application\/json">([\s\S]*?)<\/script>/)[1];
  assert.equal(JSON.parse(payload).snippets[0].code, code);
});

test("malformed optional sections fail cleanly before writing output", () => {
  for (const fields of [{ quiz: {} }, { resources: [null] }, { snippets: "bad" }, { challenges: [null] }]) {
    const res = run({ title: "Bad", tldr: ["Text"], ...fields });
    assert.equal(res.status, 1);
    assert.match(res.stderr, /lesson JSON is invalid/);
    assert.doesNotMatch(res.stderr, /TypeError/);
  }
});
