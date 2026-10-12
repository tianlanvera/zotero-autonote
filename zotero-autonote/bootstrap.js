var ZoteroAutoNote;

function install() {}

async function startup({ id, version, rootURI }) {
  Services.scriptloader.loadSubScript(rootURI + "autonote.js");

  ZoteroAutoNote.init({ id, version, rootURI });
  Zotero.PreferencePanes.register({
    pluginID: id,
    src: rootURI + "preferences.xhtml",
    scripts: [rootURI + "preferences.js"],
    stylesheets: [rootURI + "preferences.css"]
  });

  ZoteroAutoNote.start();
}

function onMainWindowLoad({ window }) {
  ZoteroAutoNote.onMainWindowLoad(window);
}

function onMainWindowUnload({ window }) {
  ZoteroAutoNote.onMainWindowUnload(window);
}

function shutdown() {
  if (ZoteroAutoNote) {
    ZoteroAutoNote.shutdown();
    ZoteroAutoNote = undefined;
  }
}

function uninstall() {}
