const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.join(__dirname, "..", "zotero-autonote", "autonote.js"),
  "utf8"
);

function loadPlugin(zotero = {}) {
  const sandbox = {
    Zotero: {
      Items: { getAsync: async () => null },
      ItemTypes: { getName: () => "journalArticle" },
      debug: () => {},
      ...zotero
    },
    Services: {},
    Map,
    Set,
    Date,
    URL,
    fetch: async () => {
      throw new Error("Unexpected fetch");
    },
    setTimeout,
    clearTimeout
  };
  vm.createContext(sandbox);
  vm.runInContext(`${source}\nthis.plugin = ZoteroAutoNote;`, sandbox);
  return sandbox.plugin;
}

function regularItem(overrides = {}) {
  return {
    id: 1,
    key: "ITEM1",
    libraryID: 1,
    dateAdded: new Date().toISOString(),
    isRegularItem: () => true,
    getNotes: () => [],
    getAttachments: () => [],
    getField: () => "",
    ...overrides
  };
}

test("automatic generation skips an item without a PDF", async () => {
  const plugin = loadPlugin();
  let generated = false;
  plugin.getPref = (name) => ({
    apiKey: "test-key",
    automaticMaxDateAddedAgeMinutes: 0
  })[name];
  plugin.generateNoteHTML = async () => {
    generated = true;
    return "<p>note</p>";
  };

  const result = await plugin.createAutoNoteForItem(regularItem(), {
    source: "automatic",
    skipExisting: true
  });

  assert.equal(result.status, "skipped");
  assert.equal(result.reason, "no-pdf-attachment");
  assert.equal(generated, false);
});

test("manual generation works without a PDF", async () => {
  const plugin = loadPlugin();
  let contextOptions;
  let created = false;
  plugin.getPref = (name) => name === "apiKey" ? "test-key" : "";
  plugin.buildContext = async (_item, options) => {
    contextOptions = options;
    return { title: "Metadata-only item" };
  };
  plugin.generateNoteHTML = async () => "<p>note</p>";
  plugin.createChildNote = async () => {
    created = true;
  };

  const result = await plugin.createAutoNoteForItem(regularItem(), {
    source: "manual",
    skipExisting: true
  });

  assert.equal(result.status, "created");
  assert.equal(contextOptions.pdfOnly, false);
  assert.equal(created, true);
});

test("automatic generation uses only PDF attachment text", async () => {
  const attachments = {
    10: {
      attachmentContentType: "application/pdf",
      isPDFAttachment: () => true,
      attachmentText: "PDF content"
    },
    11: {
      attachmentContentType: "text/html",
      isPDFAttachment: () => false,
      attachmentText: "HTML content"
    }
  };
  const plugin = loadPlugin({
    Items: { getAsync: async (id) => attachments[id] }
  });
  plugin.getPref = (name) => name === "maxFullTextChars" ? 12000 : "";

  const text = await plugin.getAttachmentText(
    regularItem({ getAttachments: () => [10, 11] }),
    { pdfOnly: true }
  );

  assert.equal(text, "PDF content");
});

test("automatic generation waits when PDF text is not ready", async () => {
  const plugin = loadPlugin();
  let generated = false;
  plugin.getPref = (name) => name === "apiKey" ? "test-key" : 0;
  plugin.hasPDFAttachment = async () => true;
  plugin.buildContext = async () => ({ title: "PDF item", attachmentText: "" });
  plugin.generateNoteHTML = async () => {
    generated = true;
    return "<p>note</p>";
  };

  const result = await plugin.createAutoNoteForItem(regularItem(), {
    source: "automatic",
    skipExisting: true
  });

  assert.equal(result.status, "skipped");
  assert.equal(result.reason, "pdf-text-unavailable");
  assert.equal(generated, false);
});

test("a newly added PDF attachment triggers its parent item", async () => {
  const parent = regularItem({ id: 20, key: "PARENT" });
  const pdf = {
    id: 21,
    parentItemID: 20,
    attachmentContentType: "application/pdf",
    isAttachment: () => true,
    isPDFAttachment: () => true
  };
  const plugin = loadPlugin({
    Items: { getAsync: async (id) => id === 21 ? pdf : parent }
  });
  let generatedItem;
  let generatedOptions;
  plugin.createAutoNoteForItem = async (item, options) => {
    generatedItem = item;
    generatedOptions = options;
    return { status: "created" };
  };

  await plugin.processItem(21);

  assert.equal(generatedItem, parent);
  assert.equal(generatedOptions.source, "automatic");
});

test("PDF readiness failures schedule a retry for the parent item", async () => {
  const parent = regularItem({ id: 30, key: "RETRY" });
  const plugin = loadPlugin({
    Items: { getAsync: async () => parent }
  });
  plugin.createAutoNoteForItem = async () => ({
    status: "skipped",
    reason: "pdf-text-unavailable"
  });
  let queued;
  plugin.enqueue = (itemID, options) => {
    queued = { itemID, options };
  };

  await plugin.processItem(30, { retryAttempt: 0 });

  assert.equal(queued.itemID, 30);
  assert.equal(queued.options.retryAttempt, 1);
  assert.equal(queued.options.delaySeconds, 30);
});

test("Zotero SQL dates are parsed as UTC", () => {
  const plugin = loadPlugin();
  const date = plugin.parseZoteroDate("2026-10-12 11:43:21");

  assert.equal(date.toISOString(), "2026-10-12T11:43:21.000Z");
});

test("token and request usage logging code is absent", () => {
  assert.doesNotMatch(source, /usageLog|requestLog|normalizeUsage|recordUsage|recordAPIRequest/);
});

test("automatic generation has no daily limit or counter", () => {
  assert.doesNotMatch(source, /automaticDaily|daily-limit|getDailyAutomatic|incrementDailyAutomatic/);
});
