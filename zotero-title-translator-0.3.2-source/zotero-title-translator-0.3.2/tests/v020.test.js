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

assert.strictEqual(manifest.version, "0.2.0");
assert.ok(prefs.includes('provider", "mymemory"'));
assert.ok(preferences.includes('value="mymemory"'));
assert.ok(preferences.includes('value="libretranslate"'));
assert.ok(preferences.includes('value="ollama"'));
assert.ok(preferences.includes('value="openai"'));

assert.ok(bootstrap.includes("requestMyMemoryTranslation"));
assert.ok(bootstrap.includes("requestLibreTranslateTranslation"));
assert.ok(bootstrap.includes("requestOllamaTranslation"));
assert.ok(bootstrap.includes("effectiveConcurrency"));
assert.ok(bootstrap.includes("migrateProviderPreference"));
assert.ok(bootstrap.includes("Zotero.Promise.delay(750)"));
assert.ok(bootstrap.includes("providerBulkWarning"));

console.log("All 0.2.0 static tests passed.");
