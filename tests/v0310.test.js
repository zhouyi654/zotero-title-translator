const assert = require("assert");
const fs = require("fs");

const manifest = JSON.parse(
    fs.readFileSync("manifest.json", "utf8")
);
const bootstrap = fs.readFileSync("bootstrap.js", "utf8");

assert.ok(/^\d+\.\d+\.\d+$/.test(manifest.version));
assert.ok(
    bootstrap.includes("reorderTranslateForZoteroInfoRows")
);
assert.ok(
    bootstrap.includes("scheduleSidebarTranslationRowReorder")
);
assert.ok(
    bootstrap.includes("restoreTranslateForZoteroInfoRows")
);
assert.ok(
    bootstrap.includes('ZTT_TITLE_INFO_ROW_ID = "titleTranslation"')
);
assert.ok(
    bootstrap.includes('ZTT_ABSTRACT_INFO_ROW_ID = "abstractTranslation"')
);
assert.ok(
    bootstrap.includes('position: "start"')
);
assert.ok(
    bootstrap.includes(
        "已将 Translate for Zotero 的摘要翻译移动到标题翻译下方"
    )
);
assert.ok(
    bootstrap.indexOf("const titleKey = safelyRegisterInfoRow")
    < bootstrap.indexOf("const abstractKey = safelyRegisterInfoRow")
);

console.log(
    "All 0.3.10 sidebar-row ordering tests passed."
);
