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
const readme = fs.readFileSync("README.md", "utf8");

assert.ok(manifest.version.startsWith("0.3."));

const entries = core.parseTerminology([
    "cholera = 霍乱",
    "case-control study = 病例对照研究"
].join("\n"));
const glossary = core.buildPdf2zhGlossaryCSV(
    entries,
    "zh-CN"
);
assert.ok(glossary.startsWith("source,target,tgt_lng"));
assert.ok(glossary.includes("cholera,霍乱,zh-CN"));

const originalToml = [
    "[translation]",
    "glossaries = \"null\"",
    "no_auto_extract_glossary = false",
    "",
    "[pdf]",
    "no_dual = false"
].join("\n") + "\n";
const configured = core.configurePdf2zhToml(
    originalToml,
    {
        glossaryPath: "C:\\\\pdf2zh\\\\config\\\\ztt.csv",
        mode: "append",
        disableAutoGlossary: true
    }
);
assert.ok(
    configured.text.includes(
        "glossaries = \"C:\\\\\\\\pdf2zh\\\\\\\\config\\\\\\\\ztt.csv\""
    )
);
assert.ok(
    configured.text.includes(
        "no_auto_extract_glossary = true"
    )
);
assert.strictEqual(
    configured.originalAssignments.glossaries,
    'glossaries = "null"'
);

const restored = core.restorePdf2zhToml(
    configured.text,
    {
        glossaryPath: "C:\\\\pdf2zh\\\\config\\\\ztt.csv",
        originalAssignments:
            configured.originalAssignments,
        changedNoAutoGlossary: true
    }
);
assert.ok(restored.includes('glossaries = "null"'));
assert.ok(
    restored.includes("no_auto_extract_glossary = false")
);

const appended = core.configurePdf2zhToml(
    [
        "[translation]",
        'glossaries = "D:/existing.csv"'
    ].join("\n"),
    {
        glossaryPath: "D:/ztt.csv",
        mode: "append"
    }
);
assert.ok(
    appended.text.includes(
        'glossaries = "D:/existing.csv,D:/ztt.csv"'
    )
);

assert.ok(
    prefs.includes("pdf2zhBridgeEnabled")
);
assert.ok(
    preferences.includes("PDF2zh Next 全文翻译术语桥接")
);
assert.ok(
    preferences.includes("恢复桥接前配置")
);
assert.ok(
    preferenceScript.includes("modeGetFolder")
);
assert.ok(
    preferenceScript.includes("syncPdf2zhGlossary")
);
assert.ok(
    bootstrap.includes("Zotero.pdf2zh?.hooks")
);
assert.ok(
    bootstrap.includes('type !== "translatePDF"')
);
assert.ok(
    bootstrap.includes("config.toml.ztt-backup")
    || bootstrap.includes('configPath + ".ztt-backup"')
);
assert.ok(
    bootstrap.includes("PDF2zh 将继续按原配置执行翻译")
);
assert.ok(readme.includes("PDF2zh Next 术语桥接"));
assert.ok(fs.existsSync("docs/PDF2ZH_BRIDGE.md"));

console.log(
    "All 0.3.7 PDF2zh terminology bridge tests passed."
);
