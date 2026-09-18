const assert = require("assert");
const fs = require("fs");

const manifest = JSON.parse(
    fs.readFileSync("manifest.json", "utf8")
);
const bootstrap = fs.readFileSync("bootstrap.js", "utf8");

assert.strictEqual(
    manifest.applications.zotero.strict_min_version,
    "9.0"
);
assert.strictEqual(
    manifest.applications.zotero.strict_max_version,
    "10.0.*"
);

const rowsIndex = bootstrap.indexOf(
    'typeof pane.getCollectionTreeRows === "function"'
);
const pluralGuardIndex = bootstrap.indexOf(
    'typeof pane.getSelectedCollections === "function"'
);
const legacyCollectionIndex = bootstrap.indexOf(
    'typeof pane.getSelectedCollection === "function"'
);
const legacyLibraryIndex = bootstrap.indexOf(
    'typeof pane.getSelectedLibraryID === "function"'
);

assert.ok(rowsIndex >= 0);
assert.ok(pluralGuardIndex > rowsIndex);
assert.ok(legacyCollectionIndex > pluralGuardIndex);
assert.ok(legacyLibraryIndex > pluralGuardIndex);
assert.ok(
    bootstrap.includes(
        'typeof pane.getSelectedLibraryIDs === "function"'
    )
);
assert.ok(
    bootstrap.includes("context.collectionTreeRows")
);
assert.ok(
    bootstrap.includes('typeof row.isLibrary === "function"')
);
assert.ok(
    bootstrap.includes('typeof row.isGroup === "function"')
);

console.log(
    "All 0.3.12 Zotero 10 compatibility tests passed."
);
