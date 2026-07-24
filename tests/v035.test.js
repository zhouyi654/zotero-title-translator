const assert = require("assert");
const fs = require("fs");

const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
const bootstrap = fs.readFileSync("bootstrap.js", "utf8");
const prefs = fs.readFileSync("prefs.js", "utf8");
const preferences = fs.readFileSync("content/preferences.xhtml", "utf8");
const readme = fs.readFileSync("README.md", "utf8");

assert.ok(manifest.version.startsWith("0.3."));
assert.ok(bootstrap.includes("editSelectedTranslation"));
assert.ok(bootstrap.includes("编辑标题译文…"));
assert.ok(bootstrap.includes("Services.prompt.prompt"));
assert.ok(bootstrap.includes("configuredTerminologyEntries"));
assert.ok(bootstrap.includes("matchingTerminologyEntries"));
assert.ok(bootstrap.includes("applyTerminology"));
assert.ok(prefs.includes('terminologyEnabled", false'));
assert.ok(prefs.includes('terminologyEntries", ""'));
assert.ok(preferences.includes("启用自定义术语表"));
assert.ok(preferences.includes("源术语 = 标准译法") || preferences.includes("源术语 =&gt; 标准译法"));
assert.ok(readme.includes("手动修改译题"));
assert.ok(readme.includes("术语表与译后校正"));
assert.ok(fs.existsSync("docs/TERMINOLOGY.md"));
console.log("All 0.3.5 editing and terminology tests passed.");
