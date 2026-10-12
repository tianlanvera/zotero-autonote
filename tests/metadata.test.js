const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(
  path.join(root, "zotero-autonote", "manifest.json"),
  "utf8"
));
const packageJSON = JSON.parse(fs.readFileSync(
  path.join(root, "package.json"),
  "utf8"
));

test("package and plugin versions match", () => {
  assert.equal(packageJSON.version, manifest.version);
});

test("manifest contains no placeholder release URLs", () => {
  const source = JSON.stringify(manifest);
  assert.doesNotMatch(source, /example\.invalid/);
  assert.equal(manifest.homepage_url, undefined);
  assert.equal(manifest.applications.zotero.update_url, undefined);
});

test("manifest targets the tested Zotero 10.0 release line", () => {
  assert.equal(manifest.applications.zotero.strict_min_version, "10.0");
  assert.equal(manifest.applications.zotero.strict_max_version, "10.0.*");
});

