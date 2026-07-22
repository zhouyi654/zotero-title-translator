const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(
    fs.readFileSync(path.join(root, "manifest.json"), "utf8")
);
const prefs = fs.readFileSync(path.join(root, "prefs.js"), "utf8");
const bootstrap = fs.readFileSync(path.join(root, "bootstrap.js"), "utf8");
const preferences = fs.readFileSync(
    path.join(root, "content", "preferences.xhtml"),
    "utf8"
);

assert.ok(manifest.version.startsWith("0.3."));
assert.ok(prefs.includes('showCompletionNotification", true'));
assert.ok(prefs.includes('completionNotificationSeconds", 6'));

assert.ok(bootstrap.includes("new Zotero.ProgressWindow"));
assert.ok(bootstrap.includes("showSilentNotification"));
assert.ok(bootstrap.includes("progressWindow.startCloseTimer"));
assert.ok(bootstrap.includes("completionNotificationEnabled"));
assert.ok(
    !bootstrap.includes(
        'alert(window, "标题翻译完成", lines.join("\\n"))'
    )
);
assert.ok(
    bootstrap.includes("不回退到 Services.prompt.alert")
);

assert.ok(
    preferences.includes(
        "extensions.zotero.titleTranslator.showCompletionNotification"
    )
);
assert.ok(
    preferences.includes(
        "extensions.zotero.titleTranslator.completionNotificationSeconds"
    )
);

console.log("All 0.3.1 notification tests passed.");
