#!/usr/bin/env node
// Sets the same version in package.json, plugin.json and marketplace.json.
// Edits the text in place so each file keeps its own formatting.
// Usage: npm run bump -- 0.2.0
import { readFileSync, writeFileSync } from "node:fs";

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(version || "")) {
  console.error("usage: npm run bump -- <major.minor.patch>");
  process.exit(1);
}

// Each file has exactly one "version" field.
for (const path of ["package.json", ".claude-plugin/plugin.json", ".claude-plugin/marketplace.json"]) {
  const text = readFileSync(path, "utf8");
  const fields = text.match(/"version":\s*"[^"]*"/g) || [];
  if (fields.length !== 1) {
    console.error(`${path}: expected one "version" field, found ${fields.length}`);
    process.exit(1);
  }
  writeFileSync(path, text.replace(/("version":\s*)"[^"]*"/, `$1"${version}"`));
  console.log(`${path} -> ${version}`);
}
