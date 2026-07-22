const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(
    fs.readFileSync(path.join(root, "manifest.json"), "utf8")
);
const bootstrap = fs.readFileSync(
    path.join(root, "bootstrap.js"),
    "utf8"
);
const preferences = fs.readFileSync(
    path.join(root, "content", "preferences.xhtml"),
    "utf8"
);

assert.ok(manifest.version.startsWith("0.3."));

// Zotero 9 菜单 API 修复
assert.ok(bootstrap.includes("Zotero.MenuManager.registerMenu"));
assert.ok(bootstrap.includes("Zotero.MenuManager.unregisterMenu"));
assert.ok(!bootstrap.includes("Zotero.MenuManager.register({"));
assert.ok(!bootstrap.includes("Zotero.MenuManager.unregister("));

// 双入口：右键 + 工具菜单
assert.ok(bootstrap.includes('target: "main/library/collection"'));
assert.ok(bootstrap.includes('target: "main/menubar/tools"'));
assert.ok(
    bootstrap.includes("翻译所属文献库全部未翻译标题")
);
assert.ok(
    bootstrap.includes("翻译当前文献库全部未翻译标题")
);

// 服务商
for (const provider of [
    "mymemory",
    "google",
    "deepl",
    "microsoft",
    "libretranslate",
    "ollama",
    "qwen",
    "siliconflow",
    "volcengine",
    "deepseek",
    "gemini",
    "openai",
    "custom"
]) {
    assert.ok(
        preferences.includes(`value="${provider}"`),
        `missing provider ${provider}`
    );
}

assert.ok(
    bootstrap.includes(
        "https://translation.googleapis.com/language/translate/v2"
    )
);
assert.ok(
    bootstrap.includes("DeepL-Auth-Key")
);
assert.ok(
    bootstrap.includes("Ocp-Apim-Subscription-Key")
);
assert.ok(
    bootstrap.includes("enable_thinking: false")
);
assert.ok(
    bootstrap.includes('thinking: { type: "disabled" }')
);

console.log("All 0.3.0 static tests passed.");
