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

assert.ok(manifest.version.startsWith("0.3."));

assert.strictEqual(
    core.readTranslation(
        "ZoteroTitleTranslation: 旧版译题"
    ),
    "旧版译题"
);
assert.strictEqual(
    core.readTranslation(
        "ZoteroTitleTranslation: 旧版译题\n"
        + "titleTranslation: 侧边栏译题"
    ),
    "侧边栏译题"
);
assert.strictEqual(
    core.writeTranslation(
        "DOI: 10.1/a\n"
        + "ZoteroTitleTranslation: 旧版译题",
        "新的中文译题"
    ),
    "DOI: 10.1/a\n\ntitleTranslation: 新的中文译题"
);
assert.strictEqual(
    core.clearTranslation(
        "titleTranslation: 新译题\n"
        + "ZoteroTitleTranslation: 旧译题\n"
        + "DOI: 10.1/a"
    ),
    "DOI: 10.1/a"
);

const abstractExtra = core.writeAbstractTranslation(
    "DOI: 10.1/a",
    "本研究评估了疟疾不平等。"
);
assert.strictEqual(
    abstractExtra,
    "DOI: 10.1/a\n\nabstractTranslation: 本研究评估了疟疾不平等。"
);
assert.strictEqual(
    core.readAbstractTranslation(abstractExtra),
    "本研究评估了疟疾不平等。"
);
assert.strictEqual(
    core.clearAbstractTranslation(abstractExtra),
    "DOI: 10.1/a"
);

const chatPayload = core.buildGenericChatPayload(
    "test-model",
    "Background. Methods. Results.",
    {},
    [],
    "abstract"
);
assert.strictEqual(chatPayload.max_tokens, 4096);
assert.ok(
    chatPayload.messages[0].content.includes(
        "complete translated abstract"
    )
);

const qwenPayload = core.buildQwenPayload(
    "qwen-mt-plus",
    "Background. Methods. Results.",
    {},
    [],
    "abstract"
);
assert.ok(
    qwenPayload.translation_options.domains.includes(
        "publication abstracts"
    )
);

assert.ok(bootstrap.includes("classifyAbstractItems"));
assert.ok(bootstrap.includes("translateSelectedAbstract"));
assert.ok(
    bootstrap.includes("executeAbstractTranslationBatch")
);
assert.strictEqual(core.ABSTRACT_EXTRA_KEY, "abstractTranslation");
assert.ok(
    bootstrap.includes("migrateLegacyTitleTranslationFields")
);
assert.ok(prefs.includes("extraFieldMigrationVersion"));
assert.ok(prefs.includes("autoTranslateAbstractOnAdd"));
assert.ok(
    preferences.includes("导入后同时自动翻译摘要")
);
assert.ok(preferences.includes("abstractTranslation"));

console.log(
    "All 0.3.9 sidebar-sync and abstract-translation tests passed."
);
