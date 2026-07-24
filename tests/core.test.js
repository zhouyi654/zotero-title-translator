const assert = require("assert");
const core = require("../core.js");

assert.strictEqual(
    core.readTranslation("DOI: 10.1/a\nZoteroTitleTranslation: 中文标题"),
    "中文标题"
);

assert.strictEqual(
    core.writeTranslation("DOI: 10.1/a", "“中文标题”"),
    "DOI: 10.1/a\n\nZoteroTitleTranslation: 中文标题"
);

assert.strictEqual(
    core.getChineseDisplayTitle("气道类器官与免疫共培养", ""),
    "气道类器官与免疫共培养"
);

assert.strictEqual(
    core.getChineseDisplayTitle(
        "Airway organoids",
        "ZoteroTitleTranslation: 气道类器官"
    ),
    "气道类器官"
);

assert.strictEqual(
    core.buildQwenEndpoint(
        "https://dashscope.aliyuncs.com/compatible-mode"
    ),
    "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
);

assert.strictEqual(
    core.buildChatEndpoint("https://api.siliconflow.cn/v1"),
    "https://api.siliconflow.cn/v1/chat/completions"
);

assert.strictEqual(
    core.buildDeepLEndpoint("free"),
    "https://api-free.deepl.com/v2/translate"
);

assert.strictEqual(
    core.buildDeepLEndpoint("pro"),
    "https://api.deepl.com/v2/translate"
);

assert.strictEqual(
    core.buildMicrosoftEndpoint(
        "https://api.cognitive.microsofttranslator.com"
    ),
    "https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=zh-Hans&textType=plain"
);

const google = core.buildGooglePayload("Airway organoids");
assert.deepStrictEqual(
    google,
    { q: "Airway organoids", target: "zh-CN", format: "text" }
);

assert.strictEqual(
    core.extractGoogleTranslation({
        data: {
            translations: [
                { translatedText: "气道类器官 &amp; 免疫共培养" }
            ]
        }
    }),
    "气道类器官 & 免疫共培养"
);

assert.strictEqual(
    core.extractDeepLTranslation({
        translations: [{ text: "气道类器官" }]
    }),
    "气道类器官"
);

assert.strictEqual(
    core.extractMicrosoftTranslation([
        { translations: [{ text: "气道类器官" }] }
    ]),
    "气道类器官"
);

assert.strictEqual(
    core.extractGeminiTranslation({
        candidates: [
            {
                content: {
                    parts: [{ text: "“气道类器官”" }]
                }
            }
        ]
    }),
    "气道类器官"
);

const qwen = core.buildQwenPayload(
    "qwen-mt-plus",
    "Airway organoids"
);
assert.strictEqual(qwen.translation_options.source_lang, "auto");
assert.strictEqual(qwen.translation_options.target_lang, "Chinese");
assert.ok(qwen.translation_options.domains.includes("biomedical"));

console.log("All 0.3.0 core tests passed.");


const terminology = core.parseTerminology(`
# epidemiology
cholera => 霍乱
case-control study => 病例对照研究 | 病例控制研究 | 个案对照研究
`);
assert.strictEqual(terminology.length, 2);
assert.strictEqual(terminology[1].target, "病例对照研究");
assert.deepStrictEqual(
    terminology[1].aliases,
    ["病例控制研究", "个案对照研究"]
);
assert.strictEqual(
    core.matchingTerminologyEntries(
        "A case-control study of cholera",
        terminology
    ).length,
    2
);
assert.strictEqual(
    core.applyTerminology(
        "A case-control study of cholera",
        "胆汁病病例控制研究",
        terminology
    ),
    "胆汁病病例对照研究"
);
const glossaryPayload = core.buildGenericChatPayload(
    "model",
    "A case-control study",
    {},
    core.matchingTerminologyEntries(
        "A case-control study",
        terminology
    )
);
assert.ok(
    glossaryPayload.messages[0].content.includes(
        "case-control study => 病例对照研究"
    )
);
