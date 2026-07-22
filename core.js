/* Pure functions shared by Zotero and Node.js tests. */
(function (root, factory) {
    const api = factory();
    if (typeof module === "object" && module.exports) {
        module.exports = api;
    }
    else {
        root.ZoteroTitleTranslatorCore = api;
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    "use strict";

    const EXTRA_KEY = "ZoteroTitleTranslation";

    const PROVIDERS = Object.freeze({
        MYMEMORY: "mymemory",
        GOOGLE: "google",
        DEEPL: "deepl",
        MICROSOFT: "microsoft",
        LIBRETRANSLATE: "libretranslate",
        OLLAMA: "ollama",
        QWEN: "qwen",
        SILICONFLOW: "siliconflow",
        VOLCENGINE: "volcengine",
        DEEPSEEK: "deepseek",
        GEMINI: "gemini",
        OPENAI: "openai",
        CUSTOM: "custom"
    });

    function normalizeProvider(provider) {
        const value = String(provider ?? "").trim().toLowerCase();
        return Object.values(PROVIDERS).includes(value)
            ? value
            : PROVIDERS.MYMEMORY;
    }

    function escapeRegExp(value) {
        return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    function translationLineRegExp() {
        return new RegExp(
            "^\\s*" + escapeRegExp(EXTRA_KEY) + "\\s*:\\s*(.*?)\\s*$",
            "i"
        );
    }

    function normalizeOneLine(value) {
        return String(value ?? "")
            .replace(/\r?\n+/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    function decodeHTMLEntities(value) {
        const named = {
            amp: "&",
            lt: "<",
            gt: ">",
            quot: '"',
            apos: "'",
            nbsp: " "
        };

        return String(value ?? "").replace(
            /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
            (match, entity) => {
                const lower = entity.toLowerCase();
                if (lower.startsWith("#x")) {
                    const codePoint = Number.parseInt(lower.slice(2), 16);
                    return Number.isFinite(codePoint)
                        ? String.fromCodePoint(codePoint)
                        : match;
                }
                if (lower.startsWith("#")) {
                    const codePoint = Number.parseInt(lower.slice(1), 10);
                    return Number.isFinite(codePoint)
                        ? String.fromCodePoint(codePoint)
                        : match;
                }
                return Object.prototype.hasOwnProperty.call(named, lower)
                    ? named[lower]
                    : match;
            }
        );
    }

    function cleanTranslation(value) {
        let output = normalizeOneLine(decodeHTMLEntities(value))
            .replace(/^(?:翻译|译文|中文标题|translation)\s*[:：]\s*/i, "")
            .trim();

        const quotePairs = [
            ['"', '"'],
            ["'", "'"],
            ["“", "”"],
            ["‘", "’"],
            ["「", "」"],
            ["『", "』"]
        ];
        for (const [left, right] of quotePairs) {
            if (
                output.length >= 2
                && output.startsWith(left)
                && output.endsWith(right)
            ) {
                output = output.slice(left.length, -right.length).trim();
                break;
            }
        }

        if (!output) {
            throw new Error("翻译服务未返回可用译文。");
        }
        return output;
    }

    function readTranslation(extra) {
        const pattern = translationLineRegExp();
        for (const line of String(extra ?? "").split(/\r?\n/)) {
            const match = line.match(pattern);
            if (match) {
                return normalizeOneLine(match[1]);
            }
        }
        return "";
    }

    function clearTranslation(extra) {
        const pattern = translationLineRegExp();
        const output = String(extra ?? "")
            .split(/\r?\n/)
            .filter(line => !pattern.test(line));

        while (output.length && output[output.length - 1].trim() === "") {
            output.pop();
        }
        return output.join("\n");
    }

    function writeTranslation(extra, translation) {
        const normalized = cleanTranslation(translation);
        const pattern = translationLineRegExp();
        const originalLines = String(extra ?? "").split(/\r?\n/);
        const output = [];
        let replaced = false;

        for (const line of originalLines) {
            if (pattern.test(line)) {
                if (!replaced) {
                    output.push(`${EXTRA_KEY}: ${normalized}`);
                    replaced = true;
                }
                continue;
            }
            output.push(line);
        }

        while (output.length && output[output.length - 1].trim() === "") {
            output.pop();
        }

        if (!replaced) {
            if (output.length && output.some(line => line.trim() !== "")) {
                output.push("");
            }
            output.push(`${EXTRA_KEY}: ${normalized}`);
        }
        return output.join("\n");
    }

    function isMostlyChinese(text) {
        const value = String(text ?? "");
        const hanCount = (
            value.match(/[\u3400-\u9FFF\uF900-\uFAFF]/g) || []
        ).length;
        const meaningfulCount = (
            value.match(/[A-Za-z0-9\u3400-\u9FFF\uF900-\uFAFF]/g) || []
        ).length;

        return (
            hanCount >= 4
            && meaningfulCount > 0
            && hanCount / meaningfulCount >= 0.35
        );
    }

    function getChineseDisplayTitle(title, extra) {
        const savedTranslation = readTranslation(extra);
        if (savedTranslation) {
            return savedTranslation;
        }

        const normalizedTitle = normalizeOneLine(title);
        return isMostlyChinese(normalizedTitle) ? normalizedTitle : "";
    }

    function utf8ByteLength(value) {
        let length = 0;
        for (const char of String(value ?? "")) {
            const codePoint = char.codePointAt(0);
            if (codePoint <= 0x7F) length += 1;
            else if (codePoint <= 0x7FF) length += 2;
            else if (codePoint <= 0xFFFF) length += 3;
            else length += 4;
        }
        return length;
    }

    function requireValue(value, message) {
        const clean = String(value ?? "").trim();
        if (!clean) {
            throw new Error(message);
        }
        return clean;
    }

    function normalizeBaseURL(value, message = "尚未设置服务地址。") {
        return requireValue(value, message).replace(/\/+$/, "");
    }

    function appendEndpoint(baseURL, suffix, acceptedPattern) {
        const base = normalizeBaseURL(baseURL);
        if (acceptedPattern && acceptedPattern.test(base)) {
            return base;
        }
        return `${base}${suffix}`;
    }

    function buildChatEndpoint(baseURL) {
        const base = normalizeBaseURL(baseURL, "尚未设置 API Base URL。");
        if (/\/chat\/completions$/i.test(base)) {
            return base;
        }
        return `${base}/chat/completions`;
    }

    function buildQwenEndpoint(baseURL) {
        const base = normalizeBaseURL(baseURL, "尚未设置 Qwen Base URL。");
        if (/\/chat\/completions$/i.test(base)) {
            return base;
        }
        if (/\/compatible-mode$/i.test(base)) {
            return `${base}/v1/chat/completions`;
        }
        return `${base}/chat/completions`;
    }

    function buildGeminiEndpoint(baseURL, model) {
        const base = normalizeBaseURL(baseURL, "尚未设置 Gemini Base URL。");
        const cleanModel = requireValue(model, "尚未设置 Gemini 模型。");
        if (/:generateContent$/i.test(base)) {
            return base;
        }
        return `${base}/models/${encodeURIComponent(cleanModel)}:generateContent`;
    }

    function academicTranslationInstruction() {
        return (
            "Translate the academic publication title into Simplified Chinese. "
            + "Preserve chemical formulas, gene and protein symbols, Latin binomials, "
            + "drug names, abbreviations, units, trial names, uncertainty expressions, "
            + "and meaningful punctuation. Do not add, omit, summarize, or explain. "
            + "Return only the translated title without labels or quotation marks."
        );
    }

    function buildGenericChatPayload(model, title, extra = {}) {
        const cleanModel = requireValue(model, "尚未设置模型名称。");
        const cleanTitle = normalizeOneLine(title);
        if (!cleanTitle) {
            throw new Error("标题为空。");
        }

        return Object.assign(
            {
                model: cleanModel,
                messages: [
                    {
                        role: "system",
                        content: academicTranslationInstruction()
                    },
                    {
                        role: "user",
                        content: cleanTitle
                    }
                ],
                stream: false,
                temperature: 0,
                max_tokens: 256
            },
            extra
        );
    }

    function buildQwenPayload(model, title) {
        const cleanModel = requireValue(model, "尚未设置 Qwen-MT 模型。");
        const cleanTitle = normalizeOneLine(title);
        if (!cleanTitle) {
            throw new Error("标题为空。");
        }

        if (/^qwen-mt(?:-|$)/i.test(cleanModel)) {
            return {
                model: cleanModel,
                messages: [
                    {
                        role: "user",
                        content: cleanTitle
                    }
                ],
                translation_options: {
                    source_lang: "auto",
                    target_lang: "Chinese",
                    domains:
                        "Academic and biomedical literature titles. Preserve gene and "
                        + "protein symbols, chemical formulas, drug names, abbreviations, "
                        + "units, trial names, and uncertainty expressions. Return only "
                        + "the complete translated title."
                }
            };
        }

        return buildGenericChatPayload(cleanModel, cleanTitle);
    }

    function buildMyMemoryURL({
        title,
        sourceLanguageCode = "en",
        targetLanguageCode = "zh-CN",
        email = ""
    }) {
        const cleanTitle = normalizeOneLine(title);
        const source = requireValue(
            sourceLanguageCode,
            "MyMemory 需要源语言代码。"
        );
        const target = requireValue(
            targetLanguageCode,
            "MyMemory 需要目标语言代码。"
        );

        if (!cleanTitle) {
            throw new Error("标题为空。");
        }
        if (utf8ByteLength(cleanTitle) > 500) {
            throw new Error(
                "MyMemory 单次文本上限为 500 UTF-8 字节；该标题过长。"
            );
        }

        const params = new URLSearchParams({
            q: cleanTitle,
            langpair: `${source}|${target}`,
            mt: "1"
        });
        const cleanEmail = String(email ?? "").trim();
        if (cleanEmail) {
            params.set("de", cleanEmail);
        }

        return `https://api.mymemory.translated.net/get?${params.toString()}`;
    }

    function buildGooglePayload(title) {
        const cleanTitle = normalizeOneLine(title);
        if (!cleanTitle) {
            throw new Error("标题为空。");
        }
        return {
            q: cleanTitle,
            target: "zh-CN",
            format: "text"
        };
    }

    function buildDeepLEndpoint(plan = "free") {
        const host = String(plan).toLowerCase() === "pro"
            ? "https://api.deepl.com"
            : "https://api-free.deepl.com";
        return `${host}/v2/translate`;
    }

    function buildDeepLPayload(title) {
        const cleanTitle = normalizeOneLine(title);
        if (!cleanTitle) {
            throw new Error("标题为空。");
        }
        return {
            text: [cleanTitle],
            target_lang: "ZH-HANS",
            split_sentences: "0",
            preserve_formatting: true
        };
    }

    function buildMicrosoftEndpoint(baseURL) {
        const base = normalizeBaseURL(
            baseURL,
            "尚未设置 Microsoft Translator Endpoint。"
        );
        if (/\/translate(?:\?|$)/i.test(base)) {
            return base;
        }
        return `${base}/translate?api-version=3.0&to=zh-Hans&textType=plain`;
    }

    function buildMicrosoftPayload(title) {
        const cleanTitle = normalizeOneLine(title);
        if (!cleanTitle) {
            throw new Error("标题为空。");
        }
        return [{ Text: cleanTitle }];
    }

    function buildLibreTranslateEndpoint(baseURL) {
        return appendEndpoint(
            baseURL,
            "/translate",
            /\/translate$/i
        );
    }

    function buildLibreTranslatePayload(title, apiKey = "") {
        const cleanTitle = normalizeOneLine(title);
        if (!cleanTitle) {
            throw new Error("标题为空。");
        }

        const payload = {
            q: cleanTitle,
            source: "auto",
            target: "zh",
            format: "text"
        };
        const cleanKey = String(apiKey ?? "").trim();
        if (cleanKey) {
            payload.api_key = cleanKey;
        }
        return payload;
    }

    function buildOllamaEndpoint(baseURL) {
        const base = normalizeBaseURL(baseURL, "尚未设置 Ollama 地址。");
        if (/\/api\/chat$/i.test(base)) {
            return base;
        }
        if (/\/api$/i.test(base)) {
            return `${base}/chat`;
        }
        return `${base}/api/chat`;
    }

    function buildOllamaPayload({
        model,
        title,
        sourceLanguageName = "English",
        sourceLanguageCode = "en"
    }) {
        const cleanModel = requireValue(model, "尚未设置 Ollama 模型。");
        const cleanTitle = normalizeOneLine(title);
        if (!cleanTitle) {
            throw new Error("标题为空。");
        }

        let messages;
        if (/^translategemma(?::|$)/i.test(cleanModel)) {
            const sourceName =
                String(sourceLanguageName ?? "").trim() || "English";
            const sourceCode =
                String(sourceLanguageCode ?? "").trim() || "en";
            messages = [
                {
                    role: "user",
                    content:
                        `You are a professional ${sourceName} (${sourceCode}) `
                        + "to Chinese (Simplified) (zh-Hans) translator. "
                        + academicTranslationInstruction()
                        + `\n\n\n${cleanTitle}`
                }
            ];
        }
        else {
            messages = [
                {
                    role: "system",
                    content: academicTranslationInstruction()
                },
                {
                    role: "user",
                    content: cleanTitle
                }
            ];
        }

        return {
            model: cleanModel,
            messages,
            stream: false,
            options: {
                temperature: 0
            }
        };
    }

    function buildGeminiPayload(title) {
        const cleanTitle = normalizeOneLine(title);
        if (!cleanTitle) {
            throw new Error("标题为空。");
        }

        return {
            system_instruction: {
                parts: [{ text: academicTranslationInstruction() }]
            },
            contents: [
                {
                    role: "user",
                    parts: [{ text: cleanTitle }]
                }
            ],
            generationConfig: {
                temperature: 0,
                maxOutputTokens: 256
            }
        };
    }

    function extractGenericChatTranslation(responseData) {
        if (responseData?.error) {
            const message =
                responseData.error?.message
                || responseData.error?.code
                || responseData.error;
            throw new Error(normalizeOneLine(message));
        }

        const content =
            responseData?.choices?.[0]?.message?.content
            ?? responseData?.output?.text
            ?? responseData?.output_text
            ?? "";

        const value = Array.isArray(content)
            ? content
                .map(part => part?.text ?? part?.content ?? "")
                .join("")
            : content;

        return cleanTranslation(value);
    }

    function extractMyMemoryTranslation(responseData) {
        const status = Number(responseData?.responseStatus ?? 200);
        const details = normalizeOneLine(
            responseData?.responseDetails
            ?? responseData?.exception_code
            ?? ""
        );

        if (responseData?.quotaFinished) {
            throw new Error(
                details
                || "MyMemory 免费配额已用尽，请稍后再试或切换其他服务。"
            );
        }
        if (status >= 400) {
            throw new Error(details || `MyMemory 请求失败（${status}）。`);
        }
        return cleanTranslation(
            responseData?.responseData?.translatedText ?? ""
        );
    }

    function extractGoogleTranslation(responseData) {
        if (responseData?.error) {
            throw new Error(
                normalizeOneLine(
                    responseData.error?.message
                    || responseData.error?.status
                    || responseData.error
                )
            );
        }
        return cleanTranslation(
            responseData?.data?.translations?.[0]?.translatedText ?? ""
        );
    }

    function extractDeepLTranslation(responseData) {
        if (responseData?.message) {
            throw new Error(normalizeOneLine(responseData.message));
        }
        return cleanTranslation(
            responseData?.translations?.[0]?.text ?? ""
        );
    }

    function extractMicrosoftTranslation(responseData) {
        if (responseData?.error) {
            throw new Error(
                normalizeOneLine(
                    responseData.error?.message
                    || responseData.error?.code
                    || responseData.error
                )
            );
        }
        return cleanTranslation(
            responseData?.[0]?.translations?.[0]?.text ?? ""
        );
    }

    function extractLibreTranslateTranslation(responseData) {
        if (responseData?.error) {
            throw new Error(normalizeOneLine(responseData.error));
        }
        const content = responseData?.translatedText;
        return cleanTranslation(
            Array.isArray(content) ? content.join(" ") : content
        );
    }

    function extractOllamaTranslation(responseData) {
        if (responseData?.error) {
            throw new Error(normalizeOneLine(responseData.error));
        }
        return cleanTranslation(
            responseData?.message?.content
            ?? responseData?.response
            ?? ""
        );
    }

    function extractGeminiTranslation(responseData) {
        if (responseData?.error) {
            throw new Error(
                normalizeOneLine(
                    responseData.error?.message
                    || responseData.error?.status
                    || responseData.error
                )
            );
        }
        const parts =
            responseData?.candidates?.[0]?.content?.parts ?? [];
        return cleanTranslation(
            parts.map(part => part?.text ?? "").join("")
        );
    }

    return {
        EXTRA_KEY,
        PROVIDERS,
        normalizeProvider,
        normalizeOneLine,
        decodeHTMLEntities,
        cleanTranslation,
        readTranslation,
        writeTranslation,
        clearTranslation,
        isMostlyChinese,
        getChineseDisplayTitle,
        utf8ByteLength,
        buildChatEndpoint,
        buildQwenEndpoint,
        buildGeminiEndpoint,
        academicTranslationInstruction,
        buildGenericChatPayload,
        buildQwenPayload,
        buildMyMemoryURL,
        buildGooglePayload,
        buildDeepLEndpoint,
        buildDeepLPayload,
        buildMicrosoftEndpoint,
        buildMicrosoftPayload,
        buildLibreTranslateEndpoint,
        buildLibreTranslatePayload,
        buildOllamaEndpoint,
        buildOllamaPayload,
        buildGeminiPayload,
        extractGenericChatTranslation,
        extractMyMemoryTranslation,
        extractGoogleTranslation,
        extractDeepLTranslation,
        extractMicrosoftTranslation,
        extractLibreTranslateTranslation,
        extractOllamaTranslation,
        extractGeminiTranslation
    };
});
