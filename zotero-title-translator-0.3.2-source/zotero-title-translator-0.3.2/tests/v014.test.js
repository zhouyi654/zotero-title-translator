const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(
    fs.readFileSync(path.join(root, "manifest.json"), "utf8")
);
const bootstrap = fs.readFileSync(
    path.join(root, "bootstrap.js"), "utf8"
);

assert.strictEqual(manifest.version, "0.1.4");
assert.strictEqual(
    manifest.icons["48"],
    "icons/icon-48.png"
);
assert.ok(
    bootstrap.includes('target: "main/library/collection"')
);
assert.ok(
    bootstrap.includes("Zotero.Items.getAll")
);
assert.ok(
    bootstrap.includes("翻译文献库全部未翻译标题")
);
assert.ok(
    bootstrap.includes("classifyItems(regularItems, false)")
);
assert.ok(
    bootstrap.includes("可能需要较长时间并产生 API 费用")
);

console.log("All 0.1.4 static tests passed.");
