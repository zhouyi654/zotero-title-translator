const assert = require("assert");
const fs = require("fs");

const manifest = JSON.parse(
    fs.readFileSync("manifest.json", "utf8")
);
const bootstrap = fs.readFileSync("bootstrap.js", "utf8");
const readme = fs.readFileSync("README.md", "utf8");

assert.ok(manifest.version.startsWith("0.3."));

assert.ok(bootstrap.includes("getCollectionFromRow"));
assert.ok(bootstrap.includes("selectedScopeContext"));
assert.ok(bootstrap.includes("scopeFromRows"));
assert.ok(bootstrap.includes("getScopeRegularItems"));
assert.ok(bootstrap.includes("context.collection.getChildItems()"));

assert.ok(
    bootstrap.includes("翻译此分类中的未翻译标题")
);
assert.ok(
    bootstrap.includes("翻译整个文献库中的未翻译标题")
);
assert.ok(
    bootstrap.includes("不会处理其子分类中的条目")
);

assert.ok(!bootstrap.includes("selectedLibraryContext"));
assert.ok(!bootstrap.includes("translateCurrentLibrary"));
assert.ok(!bootstrap.includes("translateLibrary(window"));

assert.ok(readme.includes("按所选分类翻译"));
assert.ok(readme.includes("不自动递归翻译子分类"));

console.log("All 0.3.3 collection-scope tests passed.");
