const assert = require("assert");
const fs = require("fs");
const core = require("../core.js");

const manifest = JSON.parse(
    fs.readFileSync("manifest.json", "utf8")
);
const bootstrap = fs.readFileSync("bootstrap.js", "utf8");
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

// New "=" format and legacy "=>" compatibility.
const textEntries = core.parseTerminology([
    "cholera = 霍乱",
    "case-control study = 病例对照研究 | 病例控制研究",
    "airway organoid => 气道类器官"
].join("\n"));
assert.strictEqual(textEntries.length, 3);
assert.strictEqual(textEntries[0].target, "霍乱");
assert.deepStrictEqual(
    textEntries[1].aliases,
    ["病例控制研究"]
);
assert.strictEqual(textEntries[2].target, "气道类器官");

const canonical = core.formatTerminology(textEntries);
assert.ok(canonical.includes("cholera = 霍乱"));
assert.ok(!canonical.includes("cholera => 霍乱"));

const normalizedText = core.normalizeTerminologyText(
    "# 分组\ncholera => 霍乱\n\n无效行"
);
assert.strictEqual(
    normalizedText,
    "# 分组\ncholera = 霍乱\n\n无效行"
);

// CSV with header, quoted comma, and aliases.
const csvEntries = core.parseTerminologyDocument(
    [
        "source,target,aliases",
        '"risk, ratio",风险比,危险比 | 风险比例',
        "cholera,霍乱,"
    ].join("\n"),
    "terms.csv"
);
assert.strictEqual(csvEntries.length, 2);
assert.strictEqual(csvEntries[0].source, "risk, ratio");
assert.deepStrictEqual(
    csvEntries[0].aliases,
    ["危险比", "风险比例"]
);

// TSV without header.
const tsvEntries = core.parseTerminologyDocument(
    "odds ratio\t比值比\t优势比\n",
    "terms.tsv"
);
assert.strictEqual(tsvEntries.length, 1);
assert.strictEqual(tsvEntries[0].target, "比值比");
assert.deepStrictEqual(tsvEntries[0].aliases, ["优势比"]);

// JSON array and object-map formats.
const jsonArray = core.parseTerminologyDocument(
    JSON.stringify([
        {
            source: "confidence interval",
            target: "置信区间",
            aliases: ["信赖区间"]
        }
    ]),
    "terms.json"
);
assert.strictEqual(jsonArray[0].target, "置信区间");

const jsonMap = core.parseTerminologyDocument(
    JSON.stringify({
        cholera: "霍乱",
        "case-control study": {
            target: "病例对照研究",
            aliases: ["病例控制研究"]
        }
    }),
    "terms.json"
);
assert.strictEqual(jsonMap.length, 2);

// Imported duplicate overrides existing rule.
const merged = core.mergeTerminologyEntries(
    core.parseTerminology("cholera = 霍乱病"),
    core.parseTerminology("cholera = 霍乱")
);
assert.strictEqual(merged.length, 1);
assert.strictEqual(merged[0].target, "霍乱");

// Export formats.
const csvExport = core.exportTerminologyDocument(
    jsonMap,
    "csv"
);
assert.ok(csvExport.startsWith("source,target,aliases"));
assert.ok(csvExport.includes("cholera"));

const jsonExport = core.exportTerminologyDocument(
    jsonMap,
    "json"
);
assert.strictEqual(JSON.parse(jsonExport).length, 2);

// Preference pane and file picker integration.
assert.ok(
    /const ZTT_MIGRATION_VERSION = [4-9]/.test(bootstrap)
);
assert.ok(
    bootstrap.includes('rootURI + "content/preferences.js"')
);
assert.ok(
    preferences.includes("导入一个或多个术语文件")
);
assert.ok(
    preferences.includes("保存 CSV 模板")
);
assert.ok(
    preferences.includes("源术语 = 标准译法")
);
assert.ok(
    preferenceScript.includes("modeOpenMultiple")
);
assert.ok(
    preferenceScript.includes("Zotero.File.getContentsAsync")
);
assert.ok(
    preferenceScript.includes("Zotero.File.putContentsAsync")
);
assert.ok(
    preferenceScript.includes("合并导入")
);
assert.ok(
    preferenceScript.includes("替换全部")
);

assert.ok(readme.includes("导入外部术语集合"));
assert.ok(
    fs.existsSync("docs/TERMINOLOGY_IMPORT.md")
);

console.log(
    "All 0.3.6 terminology import/export tests passed."
);
