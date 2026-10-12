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
const updates = JSON.parse(fs.readFileSync(
  path.join(root, "updates.json"),
  "utf8"
));

test("package and plugin versions match", () => {
  assert.equal(packageJSON.version, manifest.version);
});

test("manifest uses the public repository and update manifest", () => {
  const source = JSON.stringify(manifest);
  assert.doesNotMatch(source, /example\.invalid/);
  assert.equal(
    manifest.homepage_url,
    "https://github.com/tianlanvera/zotero-autonote"
  );
  assert.equal(
    manifest.applications.zotero.update_url,
    "https://raw.githubusercontent.com/tianlanvera/zotero-autonote/main/updates.json"
  );
});

test("manifest targets the tested Zotero 10.0 release line", () => {
  assert.equal(manifest.applications.zotero.strict_min_version, "10.0");
  assert.equal(manifest.applications.zotero.strict_max_version, "10.0.*");
});

test("update manifest matches the plugin release metadata", () => {
  const pluginID = manifest.applications.zotero.id;
  const entry = updates.addons[pluginID].updates[0];
  assert.equal(entry.version, manifest.version);
  assert.equal(
    entry.update_link,
    `https://github.com/tianlanvera/zotero-autonote/releases/download/v${manifest.version}/zotero-autonote-${manifest.version}.xpi`
  );
  assert.match(entry.update_hash, /^sha256:[a-f0-9]{64}$/);
  assert.deepEqual(entry.applications.zotero, {
    strict_min_version: "10.0",
    strict_max_version: "10.0.*"
  });
});

