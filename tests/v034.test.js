const assert = require("assert");
const fs = require("fs");

const manifest = JSON.parse(
    fs.readFileSync("manifest.json", "utf8")
);
const bootstrap = fs.readFileSync("bootstrap.js", "utf8");
const prefs = fs.readFileSync("prefs.js", "utf8");
const preferences = fs.readFileSync(
    "content/preferences.xhtml",
    "utf8"
);
const readme = fs.readFileSync("README.md", "utf8");

assert.strictEqual(manifest.version, "0.3.4");

assert.ok(
    prefs.includes('autoTranslateOnAdd", false')
);
assert.ok(
    prefs.includes('autoTranslateDelaySeconds", 3')
);

assert.ok(
    bootstrap.includes("Zotero.Notifier.registerObserver")
);
assert.ok(
    bootstrap.includes("Zotero.Notifier.unregisterObserver")
);
assert.ok(
    bootstrap.includes('event !== "add"')
);
assert.ok(
    bootstrap.includes('type !== "item"')
);
assert.ok(
    bootstrap.includes("queueAutomaticTranslation")
);
assert.ok(
    bootstrap.includes("processAutomaticTranslationQueue")
);
assert.ok(
    bootstrap.includes("Zotero.Items.getAsync(ids)")
);
assert.ok(
    bootstrap.includes("classifyItems(items, false)")
);
assert.ok(
    bootstrap.includes("autoTranslatePendingIDs.clear()")
);
assert.ok(
    bootstrap.includes("unregisterAutomaticTranslationObserver")
);

assert.ok(
    preferences.includes(
        "extensions.zotero.titleTranslator.autoTranslateOnAdd"
    )
);
assert.ok(
    preferences.includes(
        "extensions.zotero.titleTranslator.autoTranslateDelaySeconds"
    )
);
assert.ok(
    preferences.includes("导入文献后自动翻译标题")
);

assert.ok(readme.includes("导入后自动翻译"));
assert.ok(readme.includes("默认关闭"));

console.log("All 0.3.4 automatic-translation tests passed.");
