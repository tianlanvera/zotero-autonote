const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const manifestPath = path.join(root, "zotero-autonote", "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const version = manifest.version;
const pluginID = manifest.applications.zotero.id;
const compatibility = {
  strict_min_version: manifest.applications.zotero.strict_min_version,
  strict_max_version: manifest.applications.zotero.strict_max_version
};
const filename = `zotero-autonote-${version}.xpi`;
const xpiPath = path.join(root, "dist", filename);

if (!fs.existsSync(xpiPath)) {
  throw new Error(`Missing ${xpiPath}; run npm run build first.`);
}

const hash = crypto
  .createHash("sha256")
  .update(fs.readFileSync(xpiPath))
  .digest("hex");
const updates = {
  addons: {
    [pluginID]: {
      updates: [
        {
          version,
          update_link: `https://github.com/tianlanvera/zotero-autonote/releases/download/v${version}/${filename}`,
          update_hash: `sha256:${hash}`,
          applications: {
            zotero: compatibility
          }
        }
      ]
    }
  }
};

const outputPath = path.join(root, "updates.json");
fs.writeFileSync(outputPath, `${JSON.stringify(updates, null, 2)}\n`);
console.log(outputPath);
console.log(`sha256:${hash}`);
