ZoteroAutoNote = {
  id: null,
  version: null,
  rootURI: null,
  observerID: null,
  observer: null,
  timers: new Map(),
  running: new Set(),
  activeItems: new Set(),
  noticeTimes: new Map(),
  menuIDs: [],

  PREF_PREFIX: "extensions.zotero-autonote.",
  NOTE_MARKER: "data-zotero-autonote=\"true\"",
  MANUAL_LABEL: "Generate AutoNote for Selected Items",
  PDF_RETRY_DELAYS_SECONDS: [30, 60, 120, 240, 480],

  init({ id, version, rootURI }) {
    this.id = id;
    this.version = version;
    this.rootURI = rootURI;
  },

  start() {
    if (this.observerID) {
      return;
    }

    this.observer = {
      notify: (event, type, ids) => this.onNotify(event, type, ids)
    };
    this.observerID = Zotero.Notifier.registerObserver(this.observer, ["item"], this.id);
    this.registerMenus();
    this.log("Started");
  },

  shutdown() {
    this.unregisterMenus();

    if (this.observerID) {
      Zotero.Notifier.unregisterObserver(this.observerID);
      this.observerID = null;
    }

    for (let timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.running.clear();
    this.activeItems.clear();
    this.noticeTimes.clear();
    this.log("Stopped");
  },

  onMainWindowLoad(win) {
    // MenuManager handles main-window menus. This hook is kept for Zotero's
    // bootstrapped plugin lifecycle.
  },

  onMainWindowUnload(win) {
    // MenuManager removes menu DOM when the menu is rebuilt or unregistered.
  },

  registerMenus() {
    if (!Zotero.MenuManager || this.menuIDs.length) {
      return;
    }

    let itemMenuID = Zotero.MenuManager.registerMenu({
      pluginID: this.id,
      menuID: "generate-autonote-for-items",
      target: "main/library/item",
      menus: [this.createGenerateMenuDefinition()]
    });
    if (itemMenuID) {
      this.menuIDs.push(itemMenuID);
    }

    let toolsMenuID = Zotero.MenuManager.registerMenu({
      pluginID: this.id,
      menuID: "generate-autonote-for-items-tools",
      target: "main/menubar/tools",
      menus: [this.createGenerateMenuDefinition()]
    });
    if (toolsMenuID) {
      this.menuIDs.push(toolsMenuID);
    }
  },

  unregisterMenus() {
    if (!Zotero.MenuManager) {
      this.menuIDs = [];
      return;
    }
    for (let menuID of this.menuIDs) {
      Zotero.MenuManager.unregisterMenu(menuID);
    }
    this.menuIDs = [];
  },

  createGenerateMenuDefinition() {
    return {
      menuType: "menuitem",
      onShowing: (_event, context) => {
        if (context.menuElem) {
          context.menuElem.setAttribute("label", this.MANUAL_LABEL);
        }
        context.setVisible(this.getRegularItemsFromContext(context).length > 0);
        context.setEnabled(this.getRegularItemsFromContext(context).length > 0);
      },
      onCommand: (_event, context) => this.generateForItems(
        this.getRegularItemsFromContext(context),
        this.getWindowFromContext(context),
        { skipExisting: true }
      )
    };
  },

  getRegularItemsFromContext(context) {
    return (context.items || []).filter((item) => item && item.isRegularItem && item.isRegularItem());
  },

  getWindowFromContext(context) {
    return context.menuElem ? context.menuElem.ownerGlobal : Services.wm.getMostRecentWindow("navigator:browser");
  },

  async generateForItems(items, win, options = {}) {
    if (!items.length) {
      this.alert(win, "Zotero AutoNote", "Please select one or more regular Zotero items.");
      return;
    }

    if (!this.getPref("apiKey")) {
      this.alert(win, "Zotero AutoNote", "Please configure the AI service API key in Zotero AutoNote preferences first.");
      return;
    }

    let summary = {
      created: 0,
      skipped: 0,
      failed: 0
    };

    for (let item of items) {
      let result = await this.createAutoNoteForItem(item, {
        skipExisting: options.skipExisting !== false,
        source: "manual"
      });
      if (result.status === "created") {
        summary.created++;
      }
      else if (result.status === "skipped") {
        summary.skipped++;
      }
      else {
        summary.failed++;
      }
    }

    this.alert(
      win,
      "Zotero AutoNote",
      `Done.\nCreated: ${summary.created}\nSkipped existing AutoNotes: ${summary.skipped}\nFailed: ${summary.failed}`
    );
  },

  async onNotify(event, type, ids) {
    if (type !== "item" || !this.getPref("enabled")) {
      return;
    }

    if (event === "add") {
      for (let id of ids) {
        this.enqueue(id);
      }
      return;
    }

    if (event === "modify") {
      for (let id of ids) {
        await this.enqueueModifiedPDFParent(id);
      }
    }
  },

  async enqueueModifiedPDFParent(itemID) {
    try {
      let attachment = await Zotero.Items.getAsync(itemID);
      if (!this.isPDFAttachment(attachment) || !attachment.parentItemID) {
        return;
      }
      this.log(`PDF attachment ${itemID} changed; checking parent ${attachment.parentItemID}`);
      this.enqueue(attachment.parentItemID, { delaySeconds: 0 });
    }
    catch (err) {
      this.log(`Could not inspect modified attachment ${itemID}: ${err}`);
    }
  },

  enqueue(itemID, options = {}) {
    if (this.timers.has(itemID) || this.running.has(itemID)) {
      return;
    }

    let delaySeconds = options.delaySeconds === undefined
      ? Math.max(0, Number(this.getPref("delaySeconds")) || 0)
      : Math.max(0, Number(options.delaySeconds) || 0);
    let retryAttempt = Math.max(0, Number(options.retryAttempt) || 0);
    let timer = setTimeout(async () => {
      this.timers.delete(itemID);
      await this.processItem(itemID, { retryAttempt });
    }, delaySeconds * 1000);
    this.timers.set(itemID, timer);
  },

  async processItem(itemID, options = {}) {
    if (this.running.has(itemID)) {
      return;
    }
    this.running.add(itemID);

    let result = null;
    let targetItemID = itemID;
    try {
      let item = await Zotero.Items.getAsync(itemID);
      if (item && item.isAttachment && item.isAttachment()) {
        if (!this.isPDFAttachment(item)) {
          result = { status: "skipped", reason: "not-pdf-attachment" };
          return result;
        }
        if (!item.parentItemID) {
          result = { status: "skipped", reason: "pdf-parent-unavailable" };
          return result;
        }
        item = await Zotero.Items.getAsync(item.parentItemID);
      }
      if (item) {
        targetItemID = item.id;
      }
      result = await this.createAutoNoteForItem(item, { skipExisting: true, source: "automatic" });
    }
    catch (err) {
      this.log(`Failed to create note for ${itemID}: ${err && err.stack ? err.stack : err}`);
      result = { status: "failed", reason: String(err) };
    }
    finally {
      this.running.delete(itemID);

      let retryAttempt = Math.max(0, Number(options.retryAttempt) || 0);
      let retryable = result && (
        result.reason === "no-pdf-attachment" ||
        result.reason === "pdf-text-unavailable" ||
        result.reason === "pdf-parent-unavailable"
      );
      if (retryable && retryAttempt < this.PDF_RETRY_DELAYS_SECONDS.length) {
        let delaySeconds = this.PDF_RETRY_DELAYS_SECONDS[retryAttempt];
        this.log(
          `PDF is not ready for item ${targetItemID}; retry ${retryAttempt + 1}/` +
          `${this.PDF_RETRY_DELAYS_SECONDS.length} in ${delaySeconds} seconds`
        );
        this.enqueue(targetItemID, {
          retryAttempt: retryAttempt + 1,
          delaySeconds
        });
      }
      else if (retryable) {
        this.log(`PDF remained unavailable for item ${targetItemID}; automatic retries exhausted`);
        this.showNoticeOnce(
          `pdf-unavailable:${targetItemID}`,
          "Zotero AutoNote",
          "The PDF was added, but its readable text was still unavailable. You can reindex the PDF or generate the note manually."
        );
      }
      else if (result && result.status === "failed") {
        this.showAutomaticFailure(targetItemID, result.reason);
      }
    }

    return result;
  },

  async createAutoNoteForItem(item, options = {}) {
    if (!item || !item.isRegularItem()) {
      return { status: "skipped", reason: "not-regular-item" };
    }

    let lockKey = this.getItemLockKey(item);
    if (this.activeItems.has(lockKey)) {
      this.log(`Skipping ${item.id}; AutoNote generation is already in progress`);
      return { status: "skipped", reason: "already-running" };
    }
    this.activeItems.add(lockKey);

    try {
      return await this.createAutoNoteForItemUnlocked(item, options);
    }
    finally {
      this.activeItems.delete(lockKey);
    }
  },

  async createAutoNoteForItemUnlocked(item, options = {}) {
    if (options.skipExisting !== false && await this.hasAutoNote(item)) {
      this.log(`Skipping ${item.id}; auto note already exists`);
      return { status: "skipped", reason: "existing-autonote" };
    }

    let autoSkipReason = await this.getAutomaticSkipReason(item, options);
    if (autoSkipReason) {
      this.log(`Skipping automatic note for ${item.id}: ${autoSkipReason}`);
      return { status: "skipped", reason: autoSkipReason };
    }

    let apiKey = this.getPref("apiKey");
    if (!apiKey) {
      this.log("API key is empty; note was not generated");
      return { status: "failed", reason: "missing-api-key" };
    }

    try {
      let isAutomatic = options.source === "automatic";
      let context = await this.buildContext(item, { pdfOnly: isAutomatic });
      if (isAutomatic && !String(context.attachmentText || "").trim()) {
        this.log(`PDF text is not available yet for item ${item.id}`);
        return { status: "skipped", reason: "pdf-text-unavailable" };
      }
      let noteHTML = await this.generateNoteHTML(context);
      await this.createChildNote(item, noteHTML);
      this.log(`Created ${options.source || "requested"} note for item ${item.id}`);
      return { status: "created" };
    }
    catch (err) {
      this.log(`Failed to create note for ${item.id}: ${err && err.stack ? err.stack : err}`);
      return { status: "failed", reason: String(err) };
    }
  },

  getItemLockKey(item) {
    return `${item.libraryID || "local"}:${item.key || item.id}`;
  },

  async getAutomaticSkipReason(item, options = {}) {
    if (options.source !== "automatic") {
      return "";
    }

    if (!await this.hasPDFAttachment(item)) {
      return "no-pdf-attachment";
    }

    let maxAgeMinutes = Number(this.getPref("automaticMaxDateAddedAgeMinutes")) || 0;
    if (maxAgeMinutes > 0) {
      let dateAdded = this.parseZoteroDate(item.dateAdded || item.getField("dateAdded"));
      if (dateAdded) {
        let ageMinutes = (Date.now() - dateAdded.getTime()) / 60000;
        if (ageMinutes > maxAgeMinutes) {
          return "old-date-added";
        }
      }
    }

    return "";
  },

  async hasAutoNote(item) {
    for (let noteID of item.getNotes()) {
      let note = await Zotero.Items.getAsync(noteID);
      if (note && note.getNote().includes(this.NOTE_MARKER)) {
        return true;
      }
    }
    return false;
  },

  async hasPDFAttachment(item) {
    for (let id of item.getAttachments()) {
      let attachment = await Zotero.Items.getAsync(id);
      if (this.isPDFAttachment(attachment)) {
        return true;
      }
    }
    return false;
  },

  isPDFAttachment(attachment) {
    if (!attachment) {
      return false;
    }
    if (typeof attachment.isPDFAttachment === "function" && attachment.isPDFAttachment()) {
      return true;
    }
    return attachment.attachmentContentType === "application/pdf";
  },

  async buildContext(item, options = {}) {
    let creators = item.getCreators()
      .map((creator) => [creator.firstName, creator.lastName, creator.name].filter(Boolean).join(" "))
      .filter(Boolean)
      .join("; ");

    let attachmentsText = await this.getAttachmentText(item, options);

    return {
      itemKey: item.key,
      itemType: Zotero.ItemTypes.getName(item.itemTypeID),
      title: item.getField("title") || "",
      creators,
      date: item.getField("date") || "",
      publicationTitle: item.getField("publicationTitle") || "",
      DOI: item.getField("DOI") || "",
      url: item.getField("url") || "",
      abstractNote: item.getField("abstractNote") || "",
      attachmentText: attachmentsText
    };
  },

  async getAttachmentText(item, options = {}) {
    let maxChars = Math.max(0, Number(this.getPref("maxFullTextChars")) || 0);
    if (!maxChars) {
      return "";
    }

    let chunks = [];
    let remaining = maxChars;
    for (let id of item.getAttachments()) {
      if (remaining <= 0) {
        break;
      }

      let attachment = await Zotero.Items.getAsync(id);
      if (!attachment) {
        continue;
      }

      let type = attachment.attachmentContentType;
      if (options.pdfOnly && !this.isPDFAttachment(attachment)) {
        continue;
      }
      if (!options.pdfOnly && type !== "application/pdf" && type !== "text/html" && type !== "text/plain") {
        continue;
      }

      try {
        let text = await attachment.attachmentText;
        if (!text) {
          continue;
        }
        text = text.replace(/\s+/g, " ").trim();
        chunks.push(text.slice(0, remaining));
        remaining -= text.length;
      }
      catch (err) {
        this.log(`Could not read attachment text ${id}: ${err}`);
      }
    }

    return chunks.join("\n\n");
  },

  async generateNoteHTML(context) {
    let endpoint = this.getPref("endpoint");
    let apiKey = this.getPref("apiKey");
    let model = this.getPref("model");
    let systemPrompt = this.getPref("prompt");
    let language = this.getPref("language");
    let response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: `${systemPrompt}\n输出语言：${language}。`
          },
          {
            role: "user",
            content: JSON.stringify(context, null, 2)
          }
        ],
        temperature: 0.2
      })
    });

    if (!response.ok) {
      let body = await response.text();
      throw new Error(`AI request failed: ${response.status} ${body}`);
    }

    let data = await response.json();
    let text = data && data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : "";
    if (!text) {
      throw new Error("AI response did not contain note text");
    }

    return this.markdownishToHTML(text);
  },

  async createChildNote(item, bodyHTML) {
    let note = new Zotero.Item("note");
    note.libraryID = item.libraryID;
    note.parentItemID = item.id;
    note.setNote(
      `<div ${this.NOTE_MARKER}>` +
      `<p><strong>AutoNote</strong> generated ${this.escapeHTML(new Date().toISOString())}</p>` +
      bodyHTML +
      "</div>"
    );
    await note.saveTx();
    return note;
  },

  showAutomaticFailure(itemID, reason) {
    let description = reason === "missing-api-key"
      ? "No API key is configured on this computer. Open Zotero AutoNote settings and enter the endpoint, API key, and model."
      : "The automatic AI request failed. Check the endpoint, API key, model, network connection, and provider balance, then try manual generation.";
    this.showNoticeOnce(
      `automatic-failure:${itemID}:${reason === "missing-api-key" ? reason : "request"}`,
      "Zotero AutoNote",
      description
    );
  },

  showNoticeOnce(key, headline, description) {
    let now = Date.now();
    let lastShown = this.noticeTimes.get(key) || 0;
    if (now - lastShown < 60000) {
      return;
    }
    this.noticeTimes.set(key, now);

    try {
      let progress = new Zotero.ProgressWindow();
      progress.changeHeadline(headline);
      progress.addDescription(description);
      progress.show();
      progress.startCloseTimer(10000);
    }
    catch (err) {
      this.log(`Could not show automatic-generation notice: ${err}`);
    }
  },

  parseZoteroDate(value) {
    if (!value) {
      return null;
    }
    if (value instanceof Date) {
      return isNaN(value) ? null : value;
    }

    if (Zotero.Date && typeof Zotero.Date.sqlToDate === "function") {
      let zoteroDate = Zotero.Date.sqlToDate(String(value), true);
      if (zoteroDate instanceof Date && !isNaN(zoteroDate)) {
        return zoteroDate;
      }
    }

    let match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2}))?/);
    if (match) {
      return new Date(Date.UTC(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3]),
        Number(match[4]) || 0,
        Number(match[5]) || 0,
        Number(match[6]) || 0
      ));
    }

    let date = new Date(value);
    return isNaN(date) ? null : date;
  },

  markdownishToHTML(text) {
    text = this.unescapeMarkdownControls(text);

    let lines = text.split(/\r?\n/);
    let html = [];
    let inList = false;

    for (let rawLine of lines) {
      let line = rawLine.trim();
      if (!line) {
        if (inList) {
          html.push("</ul>");
          inList = false;
        }
        continue;
      }

      let heading = line.match(/^(#{1,6})\s+(.+)$/);
      if (heading) {
        if (inList) {
          html.push("</ul>");
          inList = false;
        }
        let level = Math.min(4, Math.max(2, heading[1].length + 1));
        html.push(`<h${level}>${this.inlineMarkdownToHTML(heading[2])}</h${level}>`);
        continue;
      }

      let bullet = line.match(/^[-*]\s+(.+)$/);
      if (bullet) {
        if (!inList) {
          html.push("<ul>");
          inList = true;
        }
        html.push(`<li>${this.inlineMarkdownToHTML(bullet[1])}</li>`);
        continue;
      }

      if (inList) {
        html.push("</ul>");
        inList = false;
      }
      html.push(`<p>${this.inlineMarkdownToHTML(line)}</p>`);
    }

    if (inList) {
      html.push("</ul>");
    }

    return html.join("");
  },

  unescapeMarkdownControls(text) {
    return String(text)
      .replace(/\\([\\`*_{}\[\]()#+\-.!>])/g, "$1")
      .replace(/^\s*```(?:markdown|md|html)?\s*/i, "")
      .replace(/\s*```\s*$/i, "");
  },

  inlineMarkdownToHTML(value) {
    let html = this.escapeHTML(value);
    let placeholders = [];

    html = html.replace(/`([^`]+)`/g, (match, code) => {
      let token = `@@AUTONOTE_CODE_${placeholders.length}@@`;
      placeholders.push(`<code>${code}</code>`);
      return token;
    });

    html = html
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/__([^_]+)__/g, "<strong>$1</strong>")
      .replace(/(^|[^\*])\*([^*\s][^*]*?)\*/g, "$1<em>$2</em>")
      .replace(/(^|[^_])_([^_\s][^_]*?)_/g, "$1<em>$2</em>");

    for (let i = 0; i < placeholders.length; i++) {
      html = html.replace(`@@AUTONOTE_CODE_${i}@@`, placeholders[i]);
    }

    return html;
  },

  escapeHTML(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  },

  getPref(name) {
    return Zotero.Prefs.get(this.PREF_PREFIX + name, true);
  },

  alert(win, title, message) {
    let promptWin = win || Services.wm.getMostRecentWindow("navigator:browser");
    Services.prompt.alert(promptWin, title, message);
  },

  log(message) {
    Zotero.debug(`Zotero AutoNote: ${message}`);
  }
};
