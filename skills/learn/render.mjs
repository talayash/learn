#!/usr/bin/env node
// Renders a lesson JSON into a self-contained HTML page and opens it.
// Usage: node render.mjs <lesson.json> [--out <dir>] [--no-open]

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const args = { input: null, out: ".learn", open: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out") args.out = argv[++i];
    else if (a === "--no-open") args.open = false;
    else if (!args.input) args.input = a;
  }
  return args;
}

function fail(msg) {
  console.error(`learn: ${msg}`);
  process.exit(1);
}

function validate(d) {
  const errors = [];
  const isStr = (v) => typeof v === "string" && v.trim().length > 0;
  if (!d || typeof d !== "object") return ["root must be a JSON object"];
  if (!isStr(d.title)) errors.push("title: required string");
  if (!Array.isArray(d.tldr) || d.tldr.length === 0) errors.push("tldr: required non-empty array of strings");
  for (const [i, q] of (d.quiz || []).entries()) {
    if (!Array.isArray(q.options) || q.options.length < 2) errors.push(`quiz[${i}].options: need at least 2`);
    else if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length)
      errors.push(`quiz[${i}].answer: must be an index into options`);
  }
  for (const [i, r] of (d.resources || []).entries()) {
    if (!/^https?:\/\//.test(r.url || "")) errors.push(`resources[${i}].url: must start with http(s)://`);
  }
  return errors;
}

// JSON inside <script> must not be able to close the tag or break JS parsing.
function embed(data) {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(new RegExp(String.fromCharCode(0x2028), "g"), "\\u2028")
    .replace(new RegExp(String.fromCharCode(0x2029), "g"), "\\u2029");
}

function slugify(s) {
  return (
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/[\s_-]+/g, "-")
      .slice(0, 60) || "lesson"
  );
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function openInBrowser(file) {
  const [cmd, args] =
    process.platform === "win32"
      ? ["cmd", ["/c", "start", "", file]]
      : process.platform === "darwin"
        ? ["open", [file]]
        : ["xdg-open", [file]];
  const child = spawn(cmd, args, { detached: true, stdio: "ignore" });
  child.on("error", () => console.error(`learn: could not open a browser, open ${file} manually`));
  child.unref();
}

function writeIndex(outDir, history) {
  const rows = history
    .slice()
    .reverse()
    .map(
      (h) => `<li><a href="${escapeHtml(h.file)}">${escapeHtml(h.title)}</a>
        <span>${escapeHtml(h.date)}${h.level ? ` &middot; ${escapeHtml(h.level)}` : ""}</span>
        <p>${escapeHtml(h.tldr || "")}</p></li>`
    )
    .join("\n");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Lessons</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Literata:opsz,wght@7..72,400;7..72,700&display=swap" rel="stylesheet">
<style>
:root{--paper:#F4F6F1;--ink:#1D2530;--muted:#5D6672;--mark:#F5DC4E;--rule:#D8DDD3}
@media (prefers-color-scheme:dark){:root{--paper:#14181D;--ink:#E5E8EC;--muted:#97A0AB;--mark:#7A6A12;--rule:#2A3038}}
body{margin:0;background:var(--paper);color:var(--ink);font:17px/1.6 Literata,Georgia,serif}
main{max-width:44rem;margin:0 auto;padding:3rem 1rem}
h1{font-size:2.4rem;line-height:1.1;margin:0 0 2rem}
ul{list-style:none;padding:0;margin:0}li{padding:1.1rem 0;border-top:1px solid var(--rule)}
a{color:var(--ink);font-weight:700;font-size:1.2rem;text-decoration-color:var(--mark);text-decoration-thickness:.35em;text-underline-offset:-.15em;text-decoration-skip-ink:none}
span{display:block;color:var(--muted);font-size:.9rem}p{margin:.3rem 0 0}
</style></head><body><main><h1>What you have learned</h1><ul>${rows}</ul></main></body></html>`;
  writeFileSync(join(outDir, "index.html"), html);
}

const args = parseArgs(process.argv.slice(2));
if (!args.input) fail("usage: node render.mjs <lesson.json> [--out <dir>] [--no-open]");
if (!existsSync(args.input)) fail(`file not found: ${args.input}`);

let data;
try {
  data = JSON.parse(readFileSync(args.input, "utf8").replace(/^﻿/, ""));
} catch (e) {
  fail(`invalid JSON in ${args.input}: ${e.message}`);
}

const errors = validate(data);
if (errors.length) fail(`lesson JSON is invalid:\n  - ${errors.join("\n  - ")}`);

const now = new Date();
const date = now.toISOString().slice(0, 10);
data.generatedAt = now.toISOString();
data.root = process.cwd().replace(/\\/g, "/");

const template = readFileSync(join(here, "template.html"), "utf8");
const marker = "/*__LEARN_DATA__*/null";
if (!template.includes(marker)) fail("template.html is missing the data marker");
const html = template.replace(marker, () => embed(data));

const outDir = resolve(args.out);
mkdirSync(outDir, { recursive: true });
let fileName = `${date}-${slugify(data.title)}.html`;
for (let n = 2; existsSync(join(outDir, fileName)); n++) fileName = `${date}-${slugify(data.title)}-${n}.html`;
const outFile = join(outDir, fileName);
writeFileSync(outFile, html);

const historyPath = join(outDir, "history.json");
let history = [];
try {
  history = JSON.parse(readFileSync(historyPath, "utf8"));
} catch {}
history.push({ file: basename(outFile), title: data.title, date, level: data.level || "", tldr: data.tldr[0] });
writeFileSync(historyPath, JSON.stringify(history, null, 2));
writeIndex(outDir, history);

console.log(outFile);
if (args.open) openInBrowser(outFile);
