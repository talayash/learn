import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => JSON.parse(readFileSync(new URL("../" + path, import.meta.url), "utf8"));

// The release workflow tags plugin.json's version, so the other manifests must agree with it.
test("package, plugin and marketplace versions match", () => {
  const plugin = read(".claude-plugin/plugin.json").version;
  assert.match(plugin, /^\d+\.\d+\.\d+$/);
  assert.equal(read("package.json").version, plugin, "package.json");
  const entry = read(".claude-plugin/marketplace.json").plugins.find((p) => p.name === "learn");
  assert.equal(entry.version, plugin, "marketplace.json");
});
