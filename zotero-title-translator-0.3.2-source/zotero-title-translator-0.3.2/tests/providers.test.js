const assert = require("assert");
const core = require("../core.js");

assert.strictEqual(core.normalizeProvider("MYMEMORY"), "mymemory");
assert.strictEqual(core.normalizeProvider("unknown"), "openai");

assert.strictEqual(core.utf8ByteLength("Hello"), 5);
assert.strictEqual(core.utf8ByteLength("中文"), 6);

const url = new URL(core.buildMyMemoryURL({
    title: "Airway organoids",
    sourceLanguageCode: "en",
    email: "test@example.com"
}));
assert.strictEqual(url.hostname, "api.mymemory.translated.net");
assert.strictEqual(url.searchParams.get("langpair"), "en|zh-CN");
assert.strictEqual(url.searchParams.get("de"), "test@example.com");

assert.throws(
    () => core.buildMyMemoryURL({
        title: "a".repeat(501),
        sourceLanguageCode: "en"
    }),
    /500 UTF-8/
);

assert.strictEqual(
    core.extractMyMemoryTranslation({
        responseStatus: 200,
        quotaFinished: false,
        responseData: { translatedText: "气道类器官" }
    }),
    "气道类器官"
);
assert.throws(
    () => core.extractMyMemoryTranslation({
        quotaFinished: true,
        responseDetails: "Quota exceeded"
    }),
    /Quota exceeded/
);

assert.strictEqual(
    core.buildLibreTranslateEndpoint("http://localhost:5000/"),
    "http://localhost:5000/translate"
);
assert.deepStrictEqual(
    core.buildLibreTranslatePayload({
        title: "Airway organoids",
        apiKey: ""
    }),
    {
        q: "Airway organoids",
        source: "auto",
        target: "zh",
        format: "text"
    }
);
assert.strictEqual(
    core.extractLibreTranslateTranslation({
        translatedText: "气道类器官"
    }),
    "气道类器官"
);

assert.strictEqual(
    core.buildOllamaEndpoint("http://localhost:11434"),
    "http://localhost:11434/api/chat"
);
const payload = core.buildOllamaPayload({
    model: "translategemma:4b",
    title: "Airway organoids",
    sourceLanguageName: "English",
    sourceLanguageCode: "en"
});
assert.strictEqual(payload.stream, false);
assert.ok(payload.messages[0].content.includes("zh-Hans"));
assert.ok(payload.messages[0].content.includes("\n\n\nAirway organoids"));

assert.strictEqual(
    core.extractOllamaTranslation({
        message: { content: "“气道类器官”" }
    }),
    "气道类器官"
);

console.log("All provider tests passed.");
