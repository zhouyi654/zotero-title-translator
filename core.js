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

    const LEGACY_TITLE_EXTRA_KEY = "ZoteroTitleTranslation";
    const TITLE_EXTRA_KEY = "titleTranslation";
    const ABSTRACT_EXTRA_KEY = "abstractTranslation";
    const EXTRA_KEY = TITLE_EXTRA_KEY;

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

    function extraFieldLineRegExp(key) {
        return new RegExp(
            "^\\s*" + escapeRegExp(key) + "\\s*:\\s*(.*?)\\s*$",
            "i"
        );
    }

    function translationLineRegExp() {
        return extraFieldLineRegExp(TITLE_EXTRA_KEY);
    }

    function normalizeOneLine(value) {
        return String(value ?? "")
            .replace(/\r?\n+/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }


    function terminologyDelimiter(line) {
        const arrowIndex = line.indexOf("=>");
        if (arrowIndex > 0) {
            return {
                index: arrowIndex,
                length: 2
            };
        }

        const equalIndex = line.indexOf("=");
        if (equalIndex > 0) {
            return {
                index: equalIndex,
                length: 1
            };
        }

        return null;
    }

    function normalizeTerminologyAliases(value) {
        const rawValues = Array.isArray(value)
            ? value
            : String(value ?? "").split(/[|;；]/);

        return Array.from(new Set(
            rawValues
                .map(normalizeOneLine)
                .filter(Boolean)
        ));
    }

    function normalizeTerminologyEntry(
        sourceValue,
        targetValue,
        aliasesValue = []
    ) {
        const source = normalizeOneLine(sourceValue);
        const target = normalizeOneLine(targetValue);
        if (!source || !target) {
            return null;
        }

        const aliases = normalizeTerminologyAliases(
            aliasesValue
        ).filter(alias => alias !== target);

        return {
            source,
            target,
            aliases
        };
    }

    function mergeTerminologyEntries(
        existingEntries,
        importedEntries
    ) {
        const bySource = new Map();

        for (const entry of [
            ...(existingEntries || []),
            ...(importedEntries || [])
        ]) {
            const normalized = normalizeTerminologyEntry(
                entry?.source,
                entry?.target,
                entry?.aliases
            );
            if (!normalized) {
                continue;
            }
            bySource.set(
                normalized.source.toLocaleLowerCase(),
                normalized
            );
        }

        return Array.from(bySource.values());
    }

    function parseTerminology(value) {
        const entries = [];

        for (const rawLine of String(value ?? "").split(/\r?\n/)) {
            const line = rawLine.trim();
            if (!line || line.startsWith("#")) {
                continue;
            }

            const delimiter = terminologyDelimiter(line);
            if (!delimiter) {
                continue;
            }

            const source = line.slice(0, delimiter.index);
            const rightParts = line
                .slice(delimiter.index + delimiter.length)
                .split("|");
            const target = rightParts.shift() || "";
            const normalized = normalizeTerminologyEntry(
                source,
                target,
                rightParts
            );
            if (normalized) {
                entries.push(normalized);
            }
        }

        return mergeTerminologyEntries([], entries);
    }

    function formatTerminology(entries) {
        return mergeTerminologyEntries([], entries)
            .map(entry => {
                const aliases = entry.aliases.length
                    ? ` | ${entry.aliases.join(" | ")}`
                    : "";
                return `${entry.source} = ${entry.target}${aliases}`;
            })
            .join("\n");
    }

    function normalizeTerminologyText(value) {
        return String(value ?? "")
            .split(/\r?\n/)
            .map(rawLine => {
                const line = rawLine.trim();
                if (!line || line.startsWith("#")) {
                    return rawLine;
                }

                const entries = parseTerminology(line);
                if (!entries.length) {
                    return rawLine;
                }
                return formatTerminology(entries);
            })
            .join("\n");
    }

    function parseDelimitedRows(value, delimiter) {
        const rows = [];
        let row = [];
        let field = "";
        let inQuotes = false;
        const text = String(value ?? "").replace(/^\uFEFF/, "");

        for (let index = 0; index < text.length; index++) {
            const character = text[index];

            if (inQuotes) {
                if (
                    character === '"'
                    && text[index + 1] === '"'
                ) {
                    field += '"';
                    index++;
                }
                else if (character === '"') {
                    inQuotes = false;
                }
                else {
                    field += character;
                }
                continue;
            }

            if (character === '"') {
                inQuotes = true;
            }
            else if (character === delimiter) {
                row.push(field);
                field = "";
            }
            else if (character === "\n") {
                row.push(field.replace(/\r$/, ""));
                rows.push(row);
                row = [];
                field = "";
            }
            else {
                field += character;
            }
        }

        row.push(field.replace(/\r$/, ""));
        if (
            row.some(value => String(value).length)
            || rows.length === 0
        ) {
            rows.push(row);
        }

        return rows;
    }

    function normalizedHeader(value) {
        return normalizeOneLine(value)
            .toLocaleLowerCase()
            .replace(/[\s_-]+/g, "");
    }

    function terminologyColumnIndexes(headerRow) {
        const sourceNames = new Set([
            "source",
            "sourceterm",
            "term",
            "english",
            "en",
            "原文",
            "源术语",
            "外文术语",
            "英文术语"
        ]);
        const targetNames = new Set([
            "target",
            "targetterm",
            "translation",
            "chinese",
            "zh",
            "译文",
            "标准译法",
            "中文译法",
            "目标术语"
        ]);
        const aliasNames = new Set([
            "alias",
            "aliases",
            "alternative",
            "alternatives",
            "variant",
            "variants",
            "wrongtranslation",
            "wrongtranslations",
            "错误译法",
            "旧译法",
            "别名",
            "替代译法"
        ]);

        let sourceIndex = -1;
        let targetIndex = -1;
        const aliasIndexes = [];

        headerRow.forEach((value, index) => {
            const normalized = normalizedHeader(value);
            if (sourceNames.has(normalized)) {
                sourceIndex = index;
            }
            else if (targetNames.has(normalized)) {
                targetIndex = index;
            }
            else if (aliasNames.has(normalized)) {
                aliasIndexes.push(index);
            }
        });

        return {
            isHeader: sourceIndex >= 0 && targetIndex >= 0,
            sourceIndex,
            targetIndex,
            aliasIndexes
        };
    }

    function parseDelimitedTerminology(value, delimiter) {
        const rows = parseDelimitedRows(value, delimiter)
            .filter(row => row.some(
                cell => normalizeOneLine(cell)
            ));

        if (!rows.length) {
            return [];
        }

        const indexes = terminologyColumnIndexes(rows[0]);
        const dataRows = indexes.isHeader
            ? rows.slice(1)
            : rows;
        const sourceIndex = indexes.isHeader
            ? indexes.sourceIndex
            : 0;
        const targetIndex = indexes.isHeader
            ? indexes.targetIndex
            : 1;

        const entries = [];
        for (const row of dataRows) {
            if (
                normalizeOneLine(row[0]).startsWith("#")
                || row.length < 2
            ) {
                continue;
            }

            let aliasCells;
            if (indexes.isHeader && indexes.aliasIndexes.length) {
                aliasCells = indexes.aliasIndexes.map(
                    index => row[index]
                );
            }
            else {
                aliasCells = row.filter(
                    (_value, index) => (
                        index !== sourceIndex
                        && index !== targetIndex
                    )
                );
            }

            const normalized = normalizeTerminologyEntry(
                row[sourceIndex],
                row[targetIndex],
                aliasCells.flatMap(
                    value => normalizeTerminologyAliases(value)
                )
            );
            if (normalized) {
                entries.push(normalized);
            }
        }

        return mergeTerminologyEntries([], entries);
    }

    function firstDefinedValue(object, names) {
        for (const name of names) {
            if (
                Object.prototype.hasOwnProperty.call(
                    object,
                    name
                )
                && object[name] !== undefined
                && object[name] !== null
            ) {
                return object[name];
            }
        }
        return undefined;
    }

    function terminologyEntryFromObject(value, sourceHint = "") {
        if (typeof value === "string") {
            return normalizeTerminologyEntry(
                sourceHint,
                value,
                []
            );
        }
        if (!value || typeof value !== "object") {
            return null;
        }

        const source = firstDefinedValue(value, [
            "source",
            "sourceTerm",
            "term",
            "english",
            "en",
            "源术语",
            "原文"
        ]) ?? sourceHint;

        const target = firstDefinedValue(value, [
            "target",
            "targetTerm",
            "translation",
            "chinese",
            "zh",
            "标准译法",
            "译文"
        ]);

        const aliases = firstDefinedValue(value, [
            "aliases",
            "alias",
            "alternatives",
            "variants",
            "wrongTranslations",
            "错误译法",
            "旧译法",
            "别名"
        ]) ?? [];

        return normalizeTerminologyEntry(
            source,
            target,
            aliases
        );
    }

    function parseJSONTerminology(value) {
        const data = JSON.parse(
            String(value ?? "").replace(/^\uFEFF/, "")
        );

        let rawEntries = data;
        if (
            data
            && !Array.isArray(data)
            && typeof data === "object"
            && Array.isArray(data.entries)
        ) {
            rawEntries = data.entries;
        }
        else if (
            data
            && !Array.isArray(data)
            && typeof data === "object"
            && Array.isArray(data.terms)
        ) {
            rawEntries = data.terms;
        }

        const entries = [];
        if (Array.isArray(rawEntries)) {
            for (const rawEntry of rawEntries) {
                const normalized = terminologyEntryFromObject(
                    rawEntry
                );
                if (normalized) {
                    entries.push(normalized);
                }
            }
        }
        else if (
            rawEntries
            && typeof rawEntries === "object"
        ) {
            for (const [source, rawEntry] of Object.entries(
                rawEntries
            )) {
                const normalized = terminologyEntryFromObject(
                    rawEntry,
                    source
                );
                if (normalized) {
                    entries.push(normalized);
                }
            }
        }

        return mergeTerminologyEntries([], entries);
    }

    function terminologyFileExtension(filename) {
        const match = String(filename ?? "")
            .toLocaleLowerCase()
            .match(/\.([a-z0-9]+)$/);
        return match ? match[1] : "";
    }

    function parseTerminologyDocument(value, filename = "") {
        const extension = terminologyFileExtension(filename);
        if (
            !extension
            || ["txt", "terms", "glossary"].includes(extension)
        ) {
            return parseTerminology(
                String(value ?? "").replace(/^\uFEFF/, "")
            );
        }
        if (extension === "csv") {
            return parseDelimitedTerminology(value, ",");
        }
        if (extension === "tsv") {
            return parseDelimitedTerminology(value, "\t");
        }
        if (extension === "json") {
            return parseJSONTerminology(value);
        }

        throw new Error(
            `不支持的术语文件格式：.${extension}`
        );
    }

    function quoteDelimitedValue(value, delimiter) {
        const text = String(value ?? "");
        if (
            text.includes('"')
            || text.includes("\n")
            || text.includes("\r")
            || text.includes(delimiter)
        ) {
            return `"${text.replace(/"/g, '""')}"`;
        }
        return text;
    }

    function exportTerminologyDocument(
        entries,
        format = "txt"
    ) {
        const normalizedEntries =
            mergeTerminologyEntries([], entries);
        const normalizedFormat = String(format || "txt")
            .toLocaleLowerCase()
            .replace(/^\./, "");

        if (
            ["txt", "terms", "glossary"].includes(
                normalizedFormat
            )
        ) {
            const text = formatTerminology(normalizedEntries);
            return text ? `${text}\n` : "";
        }

        if (["csv", "tsv"].includes(normalizedFormat)) {
            const delimiter =
                normalizedFormat === "csv" ? "," : "\t";
            const rows = [
                ["source", "target", "aliases"],
                ...normalizedEntries.map(entry => [
                    entry.source,
                    entry.target,
                    entry.aliases.join(" | ")
                ])
            ];
            return rows
                .map(row => row.map(
                    value => quoteDelimitedValue(
                        value,
                        delimiter
                    )
                ).join(delimiter))
                .join("\n") + "\n";
        }

        if (normalizedFormat === "json") {
            return JSON.stringify(
                normalizedEntries,
                null,
                2
            ) + "\n";
        }

        throw new Error(
            `不支持的术语导出格式：.${normalizedFormat}`
        );
    }


    function latinTermRegExp(term, flags = "i") {
        return new RegExp(
            `(^|[^A-Za-z0-9])(${escapeRegExp(term)})(?=$|[^A-Za-z0-9])`,
            flags
        );
    }

    function terminologySourceOccurs(title, source) {
        const cleanTitle = String(title ?? "");
        const cleanSource = normalizeOneLine(source);
        if (!cleanSource) {
            return false;
        }

        if (/^[A-Za-z0-9][A-Za-z0-9 ._+\-\/()]*$/.test(cleanSource)) {
            return latinTermRegExp(cleanSource).test(cleanTitle);
        }

        return cleanTitle
            .toLocaleLowerCase()
            .includes(cleanSource.toLocaleLowerCase());
    }

    function matchingTerminologyEntries(title, entries) {
        return (Array.isArray(entries) ? entries : [])
            .filter(entry => (
                entry
                && terminologySourceOccurs(title, entry.source)
            ));
    }

    function terminologyInstruction(entries) {
        const validEntries = Array.isArray(entries) ? entries : [];
        if (!validEntries.length) {
            return "";
        }

        const lines = validEntries.map(
            entry => `- ${entry.source} => ${entry.target}`
        );
        return (
            " Use the following mandatory terminology mappings whenever "
            + "the source term occurs. Use the target wording exactly and "
            + "do not substitute a synonym:\n"
            + lines.join("\n")
        );
    }

    function replaceTerminologyToken(text, token, replacement) {
        const cleanToken = normalizeOneLine(token);
        if (!cleanToken) {
            return text;
        }

        if (/^[A-Za-z0-9][A-Za-z0-9 ._+\-\/()]*$/.test(cleanToken)) {
            return String(text).replace(
                latinTermRegExp(cleanToken, "gi"),
                (match, prefix) => `${prefix}${replacement}`
            );
        }

        return String(text).replace(
            new RegExp(escapeRegExp(cleanToken), "gi"),
            replacement
        );
    }

    function applyTerminology(title, translation, entries) {
        let output = cleanTranslation(translation);
        const matching = matchingTerminologyEntries(title, entries);

        for (const entry of matching) {
            const replaceable = [
                ...(entry.aliases || []),
                entry.source
            ]
                .filter(Boolean)
                .sort((a, b) => b.length - a.length);

            for (const token of replaceable) {
                output = replaceTerminologyToken(
                    output,
                    token,
                    entry.target
                );
            }
        }

        return cleanTranslation(output);
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

    function readExtraField(extra, key) {
        const pattern = extraFieldLineRegExp(key);
        for (const line of String(extra ?? "").split(/\r?\n/)) {
            const match = line.match(pattern);
            if (match) {
                return normalizeOneLine(match[1]);
            }
        }
        return "";
    }

    function clearExtraFields(extra, keys) {
        const patterns = (keys || []).map(extraFieldLineRegExp);
        const output = String(extra ?? "")
            .split(/\r?\n/)
            .filter(line => !patterns.some(pattern => pattern.test(line)));

        while (output.length && output[output.length - 1].trim() === "") {
            output.pop();
        }
        return output.join("\n");
    }

    function writeExtraField(
        extra,
        key,
        value,
        cleaner = cleanTranslation,
        removeKeys = []
    ) {
        const normalized = cleaner(value);
        const keys = Array.from(new Set([key, ...removeKeys]));
        const output = clearExtraFields(extra, keys).split(/\r?\n/);

        while (output.length && output[output.length - 1].trim() === "") {
            output.pop();
        }
        if (output.length && output.some(line => line.trim() !== "")) {
            output.push("");
        }
        output.push(`${key}: ${normalized}`);
        return output.join("\n");
    }

    function readLegacyTranslation(extra) {
        return readExtraField(extra, LEGACY_TITLE_EXTRA_KEY);
    }

    function readTranslation(extra) {
        return (
            readExtraField(extra, TITLE_EXTRA_KEY)
            || readLegacyTranslation(extra)
        );
    }

    function clearTranslation(extra) {
        return clearExtraFields(
            extra,
            [TITLE_EXTRA_KEY, LEGACY_TITLE_EXTRA_KEY]
        );
    }

    function writeTranslation(extra, translation) {
        return writeExtraField(
            extra,
            TITLE_EXTRA_KEY,
            translation,
            cleanTranslation,
            [LEGACY_TITLE_EXTRA_KEY]
        );
    }

    function cleanAbstractTranslation(value) {
        const output = normalizeOneLine(decodeHTMLEntities(value))
            .replace(
                /^(?:摘要翻译|摘要译文|翻译|译文|abstract translation)\s*[:：]\s*/i,
                ""
            )
            .trim();
        if (!output) {
            throw new Error("翻译服务未返回可用的摘要译文。");
        }
        return output;
    }

    function readAbstractTranslation(extra) {
        return readExtraField(extra, ABSTRACT_EXTRA_KEY);
    }

    function writeAbstractTranslation(extra, translation) {
        return writeExtraField(
            extra,
            ABSTRACT_EXTRA_KEY,
            translation,
            cleanAbstractTranslation
        );
    }

    function clearAbstractTranslation(extra) {
        return clearExtraFields(extra, [ABSTRACT_EXTRA_KEY]);
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

    function academicTranslationInstruction(
        terminologyEntries = [],
        contentKind = "title"
    ) {
        const instruction = contentKind === "abstract"
            ? (
                "Translate the academic publication abstract into Simplified Chinese. "
                + "Preserve sentence order, technical meaning, chemical formulas, gene "
                + "and protein symbols, Latin binomials, drug names, abbreviations, "
                + "units, statistics, and uncertainty expressions. Do not summarize, "
                + "omit, expand, explain, or add headings. Return only the complete "
                + "translated abstract."
            )
            : (
                "Translate the academic publication title into Simplified Chinese. "
                + "Preserve chemical formulas, gene and protein symbols, Latin binomials, "
                + "drug names, abbreviations, units, trial names, uncertainty expressions, "
                + "and meaningful punctuation. Do not add, omit, summarize, or explain. "
                + "Return only the translated title without labels or quotation marks."
            );
        return instruction + terminologyInstruction(terminologyEntries);
    }

    function buildGenericChatPayload(
        model,
        title,
        extra = {},
        terminologyEntries = [],
        contentKind = "title"
    ) {
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
                        content: academicTranslationInstruction(terminologyEntries, contentKind)
                    },
                    {
                        role: "user",
                        content: cleanTitle
                    }
                ],
                stream: false,
                temperature: 0,
                max_tokens: contentKind === "abstract" ? 4096 : 256
            },
            extra
        );
    }

    function buildQwenPayload(
        model,
        title,
        extra = {},
        terminologyEntries = [],
        contentKind = "title"
    ) {
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
                        (contentKind === "abstract"
                            ? (
                                "Academic and biomedical publication abstracts. Preserve "
                                + "technical meaning, gene and protein symbols, chemical "
                                + "formulas, drug names, abbreviations, units, statistics, "
                                + "and uncertainty expressions. Return only the complete "
                                + "translated abstract without summary or explanation."
                            )
                            : (
                                "Academic and biomedical literature titles. Preserve gene and "
                                + "protein symbols, chemical formulas, drug names, abbreviations, "
                                + "units, trial names, and uncertainty expressions. Return only "
                                + "the complete translated title."
                            ))
                        + terminologyInstruction(terminologyEntries)
                }
            };
        }

        return buildGenericChatPayload(
            cleanModel,
            cleanTitle,
            extra,
            terminologyEntries,
            contentKind
        );
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

    function buildDeepLPayload(title, contentKind = "title") {
        const cleanTitle = normalizeOneLine(title);
        if (!cleanTitle) {
            throw new Error("标题为空。");
        }
        return {
            text: [cleanTitle],
            target_lang: "ZH-HANS",
            split_sentences: contentKind === "abstract" ? "1" : "0",
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
        sourceLanguageCode = "en",
        terminologyEntries = [],
        contentKind = "title"
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
                        + academicTranslationInstruction(terminologyEntries, contentKind)
                        + `\n\n\n${cleanTitle}`
                }
            ];
        }
        else {
            messages = [
                {
                    role: "system",
                    content: academicTranslationInstruction(terminologyEntries, contentKind)
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

    function buildGeminiPayload(
        title,
        terminologyEntries = [],
        contentKind = "title"
    ) {
        const cleanTitle = normalizeOneLine(title);
        if (!cleanTitle) {
            throw new Error("标题为空。");
        }

        return {
            system_instruction: {
                parts: [{ text: academicTranslationInstruction(terminologyEntries, contentKind) }]
            },
            contents: [
                {
                    role: "user",
                    parts: [{ text: cleanTitle }]
                }
            ],
            generationConfig: {
                temperature: 0,
                maxOutputTokens: contentKind === "abstract" ? 4096 : 256
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


    function csvField(value) {
        const text = String(value ?? "");
        return /[",\r\n]/.test(text)
            ? `"${text.replace(/"/g, '""')}"`
            : text;
    }

    function buildPdf2zhGlossaryCSV(
        entries,
        targetLanguage = "zh-CN"
    ) {
        const target = normalizeOneLine(targetLanguage) || "zh-CN";
        const normalized = mergeTerminologyEntries([], entries);
        const rows = ["source,target,tgt_lng"];

        for (const entry of normalized) {
            rows.push([
                csvField(entry.source),
                csvField(entry.target),
                csvField(target)
            ].join(","));
        }

        return rows.join("\n") + "\n";
    }

    function tomlAssignmentRegExp(key) {
        return new RegExp(
            "^\\s*" + escapeRegExp(key) + "\\s*=",
            "i"
        );
    }

    function tomlSectionBounds(lines, sectionName) {
        const target = String(sectionName ?? "")
            .trim()
            .toLocaleLowerCase();
        let start = -1;
        let end = lines.length;

        for (let index = 0; index < lines.length; index++) {
            const match = lines[index].match(
                /^\s*\[([^\]]+)\]\s*(?:#.*)?$/
            );
            if (!match) {
                continue;
            }

            const name = match[1]
                .trim()
                .toLocaleLowerCase();
            if (start === -1 && name === target) {
                start = index;
                continue;
            }
            if (start !== -1) {
                end = index;
                break;
            }
        }

        return { start, end };
    }

    function stripTomlComment(value) {
        const text = String(value ?? "");
        let quote = "";
        let escaped = false;

        for (let index = 0; index < text.length; index++) {
            const character = text[index];
            if (escaped) {
                escaped = false;
                continue;
            }
            if (quote === '"' && character === "\\") {
                escaped = true;
                continue;
            }
            if (quote) {
                if (character === quote) {
                    quote = "";
                }
                continue;
            }
            if (character === '"' || character === "'") {
                quote = character;
                continue;
            }
            if (character === "#") {
                return text.slice(0, index).trim();
            }
        }

        return text.trim();
    }

    function parseTomlScalar(value) {
        const text = stripTomlComment(value);
        if (!text) {
            return "";
        }
        if (text.startsWith('"') && text.endsWith('"')) {
            try {
                return JSON.parse(text);
            }
            catch (error) {
                return text.slice(1, -1);
            }
        }
        if (text.startsWith("'") && text.endsWith("'")) {
            return text.slice(1, -1);
        }
        if (/^(true|false)$/i.test(text)) {
            return text.toLocaleLowerCase() === "true";
        }
        return text;
    }

    function tomlString(value) {
        return JSON.stringify(String(value ?? ""));
    }

    function findTomlAssignment(lines, bounds, key) {
        if (bounds.start === -1) {
            return null;
        }
        const matcher = tomlAssignmentRegExp(key);
        for (
            let index = bounds.start + 1;
            index < bounds.end;
            index++
        ) {
            if (!matcher.test(lines[index])) {
                continue;
            }
            const equalIndex = lines[index].indexOf("=");
            return {
                index,
                line: lines[index],
                value: equalIndex >= 0
                    ? parseTomlScalar(
                        lines[index].slice(equalIndex + 1)
                    )
                    : ""
            };
        }
        return null;
    }

    function setTomlAssignment(
        lines,
        sectionName,
        key,
        assignmentLine
    ) {
        let bounds = tomlSectionBounds(lines, sectionName);
        if (bounds.start === -1) {
            if (lines.length && lines[lines.length - 1].trim()) {
                lines.push("");
            }
            lines.push(`[${sectionName}]`);
            bounds = {
                start: lines.length - 1,
                end: lines.length
            };
        }

        const existing = findTomlAssignment(lines, bounds, key);
        if (existing) {
            lines[existing.index] = assignmentLine;
            return;
        }
        lines.splice(bounds.end, 0, assignmentLine);
    }

    function removeTomlAssignment(lines, sectionName, key) {
        const bounds = tomlSectionBounds(lines, sectionName);
        const existing = findTomlAssignment(lines, bounds, key);
        if (existing) {
            lines.splice(existing.index, 1);
        }
    }

    function splitGlossaryPaths(value) {
        const text = normalizeOneLine(value);
        if (!text || /^null$/i.test(text)) {
            return [];
        }
        return text
            .split(",")
            .map(part => part.trim())
            .filter(Boolean);
    }

    function normalizedPathKey(value) {
        return String(value ?? "")
            .replace(/\\/g, "/")
            .replace(/\/+$/g, "")
            .toLocaleLowerCase();
    }

    function configurePdf2zhToml(
        tomlText,
        options = {}
    ) {
        const glossaryPath = normalizeOneLine(
            options.glossaryPath
        );
        if (!glossaryPath) {
            throw new Error("PDF2zh 术语文件路径为空。");
        }

        const newline = String(tomlText ?? "").includes("\r\n")
            ? "\r\n"
            : "\n";
        const hadTrailingNewline = /\r?\n$/.test(
            String(tomlText ?? "")
        );
        const lines = String(tomlText ?? "").split(/\r?\n/);
        if (hadTrailingNewline && lines[lines.length - 1] === "") {
            lines.pop();
        }

        let bounds = tomlSectionBounds(lines, "translation");
        const glossaryAssignment = findTomlAssignment(
            lines,
            bounds,
            "glossaries"
        );
        const autoAssignment = findTomlAssignment(
            lines,
            bounds,
            "no_auto_extract_glossary"
        );

        const cacheAssignment = findTomlAssignment(
            lines,
            bounds,
            "ignore_cache"
        );

        const originalAssignments = {
            glossaries: glossaryAssignment?.line ?? null,
            no_auto_extract_glossary:
                autoAssignment?.line ?? null,
            ignore_cache: cacheAssignment?.line ?? null
        };

        const mode = options.mode === "replace"
            ? "replace"
            : "append";
        const existingPaths = splitGlossaryPaths(
            glossaryAssignment?.value
        );
        const paths = mode === "replace"
            ? []
            : existingPaths.slice();
        const glossaryKey = normalizedPathKey(glossaryPath);
        if (!paths.some(
            path => normalizedPathKey(path) === glossaryKey
        )) {
            paths.push(glossaryPath);
        }

        setTomlAssignment(
            lines,
            "translation",
            "glossaries",
            `glossaries = ${tomlString(paths.join(","))}`
        );

        const disableAutoGlossary =
            options.disableAutoGlossary === true;
        if (disableAutoGlossary) {
            setTomlAssignment(
                lines,
                "translation",
                "no_auto_extract_glossary",
                "no_auto_extract_glossary = true"
            );
        }

        const forceIgnoreCache =
            options.forceIgnoreCache === true;
        if (forceIgnoreCache) {
            setTomlAssignment(
                lines,
                "translation",
                "ignore_cache",
                "ignore_cache = true"
            );
        }

        return {
            text: lines.join(newline)
                + (hadTrailingNewline ? newline : ""),
            originalAssignments,
            changedNoAutoGlossary: disableAutoGlossary,
            changedIgnoreCache: forceIgnoreCache,
            glossaryPaths: paths
        };
    }


    function inspectPdf2zhToml(
        tomlText,
        glossaryPath = ""
    ) {
        const lines = String(tomlText ?? "").split(/\r?\n/);
        const bounds = tomlSectionBounds(lines, "translation");
        const glossaryAssignment = findTomlAssignment(
            lines,
            bounds,
            "glossaries"
        );
        const autoAssignment = findTomlAssignment(
            lines,
            bounds,
            "no_auto_extract_glossary"
        );
        const cacheAssignment = findTomlAssignment(
            lines,
            bounds,
            "ignore_cache"
        );
        const glossaryPaths = splitGlossaryPaths(
            glossaryAssignment?.value
        );
        const managedKey = normalizedPathKey(glossaryPath);

        return {
            glossaryPaths,
            glossaryConfigured: managedKey
                ? glossaryPaths.some(
                    path => normalizedPathKey(path) === managedKey
                )
                : glossaryPaths.length > 0,
            noAutoExtractGlossary:
                autoAssignment?.value === true,
            ignoreCache:
                cacheAssignment?.value === true
        };
    }

    function restorePdf2zhToml(
        tomlText,
        bridgeState = {}
    ) {
        const newline = String(tomlText ?? "").includes("\r\n")
            ? "\r\n"
            : "\n";
        const hadTrailingNewline = /\r?\n$/.test(
            String(tomlText ?? "")
        );
        const lines = String(tomlText ?? "").split(/\r?\n/);
        if (hadTrailingNewline && lines[lines.length - 1] === "") {
            lines.pop();
        }

        let bounds = tomlSectionBounds(lines, "translation");
        const glossaryAssignment = findTomlAssignment(
            lines,
            bounds,
            "glossaries"
        );
        const managedPath = normalizeOneLine(
            bridgeState.glossaryPath
        );
        const managedKey = normalizedPathKey(managedPath);
        const remainingPaths = splitGlossaryPaths(
            glossaryAssignment?.value
        ).filter(
            path => normalizedPathKey(path) !== managedKey
        );

        if (remainingPaths.length) {
            setTomlAssignment(
                lines,
                "translation",
                "glossaries",
                `glossaries = ${tomlString(
                    remainingPaths.join(",")
                )}`
            );
        }
        else if (
            bridgeState.originalAssignments?.glossaries
        ) {
            setTomlAssignment(
                lines,
                "translation",
                "glossaries",
                bridgeState.originalAssignments.glossaries
            );
        }
        else {
            removeTomlAssignment(
                lines,
                "translation",
                "glossaries"
            );
        }

        if (bridgeState.changedNoAutoGlossary) {
            bounds = tomlSectionBounds(lines, "translation");
            const currentAuto = findTomlAssignment(
                lines,
                bounds,
                "no_auto_extract_glossary"
            );
            if (currentAuto?.value === true) {
                const original = bridgeState
                    .originalAssignments
                    ?.no_auto_extract_glossary;
                if (original) {
                    setTomlAssignment(
                        lines,
                        "translation",
                        "no_auto_extract_glossary",
                        original
                    );
                }
                else {
                    removeTomlAssignment(
                        lines,
                        "translation",
                        "no_auto_extract_glossary"
                    );
                }
            }
        }

        if (bridgeState.changedIgnoreCache) {
            bounds = tomlSectionBounds(lines, "translation");
            const currentCache = findTomlAssignment(
                lines,
                bounds,
                "ignore_cache"
            );
            if (currentCache?.value === true) {
                const original = bridgeState
                    .originalAssignments
                    ?.ignore_cache;
                if (original) {
                    setTomlAssignment(
                        lines,
                        "translation",
                        "ignore_cache",
                        original
                    );
                }
                else {
                    removeTomlAssignment(
                        lines,
                        "translation",
                        "ignore_cache"
                    );
                }
            }
        }

        return lines.join(newline)
            + (hadTrailingNewline ? newline : "");
    }

    return {
        EXTRA_KEY,
        LEGACY_TITLE_EXTRA_KEY,
        TITLE_EXTRA_KEY,
        ABSTRACT_EXTRA_KEY,
        PROVIDERS,
        normalizeProvider,
        normalizeOneLine,
        parseTerminology,
        formatTerminology,
        normalizeTerminologyText,
        mergeTerminologyEntries,
        parseTerminologyDocument,
        exportTerminologyDocument,
        buildPdf2zhGlossaryCSV,
        configurePdf2zhToml,
        inspectPdf2zhToml,
        restorePdf2zhToml,
        matchingTerminologyEntries,
        terminologyInstruction,
        applyTerminology,
        decodeHTMLEntities,
        cleanTranslation,
        cleanAbstractTranslation,
        readExtraField,
        readLegacyTranslation,
        readTranslation,
        writeTranslation,
        clearTranslation,
        readAbstractTranslation,
        writeAbstractTranslation,
        clearAbstractTranslation,
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
