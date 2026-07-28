const assert = require("assert");
const fs = require("fs");
const core = require("../core.js");

const manifest = JSON.parse(
    fs.readFileSync("manifest.json", "utf8")
);
const bootstrap = fs.readFileSync("bootstrap.js", "utf8");
const prefs = fs.readFileSync("prefs.js", "utf8");
const preferences = fs.readFileSync(
    "content/preferences.xhtml",
    "utf8"
);
const preferenceScript = fs.readFileSync(
    "content/preferences.js",
    "utf8"
);

assert.ok(manifest.version.startsWith("0.3."));

const originalToml = [
    "[translation]",
    'glossaries = "null"',
    "ignore_cache = false",
    "no_auto_extract_glossary = false"
].join("\n") + "\n";

const configured = core.configurePdf2zhToml(
    originalToml,
    {
        glossaryPath: "D:/pdf2zh/config/ztt.csv",
        mode: "replace",
        disableAutoGlossary: true,
        forceIgnoreCache: true
    }
);

assert.ok(
    configured.text.includes(
        'glossaries = "D:/pdf2zh/config/ztt.csv"'
    )
);
assert.ok(
    configured.text.includes("ignore_cache = true")
);
assert.ok(
    configured.text.includes(
        "no_auto_extract_glossary = true"
    )
);
assert.strictEqual(
    configured.originalAssignments.ignore_cache,
    "ignore_cache = false"
);
assert.strictEqual(configured.changedIgnoreCache, true);

const inspected = core.inspectPdf2zhToml(
    configured.text,
    "D:/pdf2zh/config/ztt.csv"
);
assert.strictEqual(inspected.glossaryConfigured, true);
assert.strictEqual(inspected.ignoreCache, true);
assert.strictEqual(
    inspected.noAutoExtractGlossary,
    true
);

const restored = core.restorePdf2zhToml(
    configured.text,
    {
        glossaryPath: "D:/pdf2zh/config/ztt.csv",
        originalAssignments:
            configured.originalAssignments,
        changedNoAutoGlossary: true,
        changedIgnoreCache: true
    }
);
assert.ok(restored.includes("ignore_cache = false"));
assert.ok(
    restored.includes(
        "no_auto_extract_glossary = false"
    )
);
assert.ok(restored.includes('glossaries = "null"'));

assert.ok(prefs.includes("pdf2zhForceIgnoreCache"));
assert.ok(
    prefs.includes("pdf2zhShowSyncNotification")
);
assert.ok(
    preferences.includes("强制忽略旧翻译缓存")
);
assert.ok(
    preferences.includes("翻译前显示桥接回执")
);
assert.ok(
    preferenceScript.includes("配置引用术语")
);
assert.ok(
    preferenceScript.includes("忽略旧缓存")
);
assert.ok(
    bootstrap.includes("inspectPdf2zhToml")
);
assert.ok(
    bootstrap.includes("PDF2zh 术语桥接已生效")
);
assert.ok(
    bootstrap.includes("本次已强制忽略旧翻译缓存")
);

console.log(
    "All 0.3.8 PDF2zh cache and verification tests passed."
);
