const assert = require("assert");
const fs = require("fs");

const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
const bootstrap = fs.readFileSync("bootstrap.js", "utf8");
const prefs = fs.readFileSync("content/preferences.xhtml", "utf8");

assert.strictEqual(manifest.version, "0.3.2");
assert.strictEqual(
    manifest.applications.zotero.id,
    "zotero-title-translator@zhouyi654.github.io"
);
assert.strictEqual(
    manifest.homepage_url,
    "https://github.com/zhouyi654/zotero-title-translator"
);
assert.ok(
    manifest.applications.zotero.update_url.includes(
        "/releases/latest/download/updates.json"
    )
);

assert.ok(bootstrap.includes("providerMinIntervalMs"));
assert.ok(bootstrap.includes("withProviderRetry"));
assert.ok(bootstrap.includes("X-DashScope-Wait-Timeout"));
assert.ok(bootstrap.includes("HTTP 429"));
assert.ok(
    bootstrap.includes(
        'provider === "qwen"'
    )
);
assert.ok(
    !prefs.includes("正式公开发布前应改用 Mozilla Login Manager")
);
assert.ok(prefs.includes("不会发送给本项目作者"));

console.log("All 0.3.2 release-readiness tests passed.");
