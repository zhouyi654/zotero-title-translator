var ZoteroTitleTranslator = null;
var ZoteroTitleTranslatorCore = null;
var ZTTGlobal = this;

const ZTT_PLUGIN_ID = "zotero-title-translator@zhouyi654.github.io";
const ZTT_PREF_PREFIX = "extensions.zotero.titleTranslator.";
const ZTT_COLUMN_DATA_KEY = "titleTranslation";
const ZTT_MIGRATION_VERSION = 3;

async function startup({ id, version, rootURI }, reason) {
    await Zotero.initializationPromise;

    Services.scriptloader.loadSubScript(rootURI + "core.js", ZTTGlobal);
    ZoteroTitleTranslatorCore = ZTTGlobal.ZoteroTitleTranslatorCore;

    ZoteroTitleTranslator = createTitleTranslator(rootURI);
    await ZoteroTitleTranslator.startup();

    for (const window of Zotero.getMainWindows()) {
        await ZoteroTitleTranslator.onMainWindowLoad(window);
    }
}

async function shutdown({ id, version, rootURI }, reason) {
    if (reason === APP_SHUTDOWN) {
        return;
    }
    if (ZoteroTitleTranslator) {
        await ZoteroTitleTranslator.shutdown();
    }
    ZoteroTitleTranslator = null;
    ZoteroTitleTranslatorCore = null;
}

function install() {}
function uninstall() {}

async function onMainWindowLoad({ window }) {
    if (ZoteroTitleTranslator) {
        await ZoteroTitleTranslator.onMainWindowLoad(window);
    }
}

function onMainWindowUnload({ window }) {
    if (ZoteroTitleTranslator) {
        ZoteroTitleTranslator.onMainWindowUnload(window);
    }
}

function createTitleTranslator(rootURI) {
    const windowState = new Map();
    const registeredMenuIDs = [];

    const providerNextRequestAt = new Map();
    let providerRateGate = Promise.resolve();

    let registeredColumnKey = null;
    let preferencePaneID = null;
    let busy = false;

    const menuIconURI = rootURI + "icons/menu.svg";

    function pref(name, fallback) {
        const value = Zotero.Prefs.get(ZTT_PREF_PREFIX + name, true);
        return value === undefined || value === null ? fallback : value;
    }

    function setPref(name, value) {
        Zotero.Prefs.set(ZTT_PREF_PREFIX + name, value, true);
    }

    function hasUserPref(name) {
        return Services.prefs.prefHasUserValue(ZTT_PREF_PREFIX + name);
    }

    function log(message) {
        Zotero.debug(`[Zotero Title Translator] ${message}`);
    }

    function logError(error) {
        Zotero.logError(error);
    }

    function alert(window, title, message) {
        Services.prompt.alert(window || null, title, message);
    }

    function completionNotificationEnabled() {
        return Boolean(
            pref("showCompletionNotification", true)
        );
    }

    function completionNotificationDurationMs() {
        const seconds = Number(
            pref("completionNotificationSeconds", 6)
        );
        const safeSeconds = Number.isFinite(seconds)
            ? Math.min(30, Math.max(2, seconds))
            : 6;
        return safeSeconds * 1000;
    }

    function showSilentNotification(
        window,
        headline,
        descriptions = []
    ) {
        if (!completionNotificationEnabled()) {
            return;
        }

        try {
            const progressWindow = new Zotero.ProgressWindow({
                window: window || Zotero.getMainWindow(),
                closeOnClick: true
            });

            progressWindow.show();
            progressWindow.changeHeadline(headline);

            const lines = Array.isArray(descriptions)
                ? descriptions
                : [descriptions];

            for (const line of lines) {
                const value = String(line ?? "").trim();
                if (value) {
                    progressWindow.addDescription(value);
                }
            }

            progressWindow.startCloseTimer(
                completionNotificationDurationMs()
            );
        }
        catch (error) {
            // 不回退到 Services.prompt.alert，确保完成通知不会触发系统提示音。
            logError(error);
        }
    }

    function confirm(window, title, message, acceptLabel = "继续") {
        const ps = Services.prompt;
        const flags =
            ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING
            + ps.BUTTON_POS_1 * ps.BUTTON_TITLE_CANCEL;

        return ps.confirmEx(
            window || null,
            title,
            message,
            flags,
            acceptLabel,
            null,
            null,
            null,
            {}
        ) === 0;
    }

    function currentProvider() {
        return ZoteroTitleTranslatorCore.normalizeProvider(
            pref("provider", "mymemory")
        );
    }

    function providerLabel(provider = currentProvider()) {
        const labels = {
            mymemory: "MyMemory 免费在线",
            google: "Google Cloud Translation",
            deepl: "DeepL API",
            microsoft: "Microsoft Translator",
            libretranslate: "LibreTranslate",
            ollama: "Ollama 本地模型",
            qwen: "阿里云百炼 Qwen-MT",
            siliconflow: "SiliconFlow（硅基流动）",
            volcengine: "火山方舟（豆包）",
            deepseek: "DeepSeek API",
            gemini: "Google Gemini API",
            openai: "OpenAI API",
            custom: "自定义 OpenAI-compatible API"
        };
        return labels[provider] || provider;
    }

    function providerBulkWarning(provider = currentProvider()) {
        const warnings = {
            mymemory:
                "MyMemory 是第三方公共服务，存在每日配额与流量限制，"
                + "标题会发送到该服务；适合小批量，不适合超大型文献库。",
            google:
                "Google Cloud Translation 需要启用云项目和结算；"
                + "免费额度与超额价格以当前账户和官方计费规则为准。",
            deepl:
                "DeepL API Free 和 Pro 使用不同端点；"
                + "翻译量受套餐配额或计费规则约束。",
            microsoft:
                "Microsoft Translator 可使用免费层或付费层；"
                + "区域资源需要填写与密钥匹配的 Region。",
            libretranslate:
                "本机 LibreTranslate 通常不产生 API 费用；"
                + "远程或托管实例可能要求密钥、限流或收费。",
            ollama:
                "Ollama 在本机运行，不上传标题且不产生 API 费用，"
                + "但会占用 CPU、内存或显卡。",
            qwen:
                "Qwen-MT 按阿里云百炼账户的赠送额度、免费额度或实际用量计费。",
            siliconflow:
                "SiliconFlow 的免费模型、赠送额度和付费规则可能随账户及模型变化。",
            volcengine:
                "火山方舟按账户赠送额度、模型与调用量计费；"
                + "需要 API Key 和有效模型或推理接入点 ID。",
            deepseek:
                "DeepSeek API 按模型与 token 用量计费，赠送余额以账户为准。",
            gemini:
                "Gemini API 是否可免费调用及其限额取决于当前套餐、地区和模型。",
            openai:
                "OpenAI API 按所选模型和 token 用量计费。",
            custom:
                "费用、隐私与限流规则由自定义服务提供方决定。"
        };
        return warnings[provider] || "请核对当前服务的费用与隐私规则。";
    }

    function effectiveConcurrency(provider = currentProvider()) {
        if (
            provider === "mymemory"
            || provider === "ollama"
            || provider === "qwen"
        ) {
            return 1;
        }
        return Math.min(
            6,
            Math.max(1, Number(pref("concurrency", 2)) || 2)
        );
    }

    function migratePreferences() {
        const migrated = Number(pref("migrationVersion", 0)) || 0;
        if (migrated >= ZTT_MIGRATION_VERSION) {
            return;
        }

        const oldProvider = String(pref("provider", "mymemory"));
        if (oldProvider === "openai") {
            const oldBase = String(pref("apiBaseURL", "")).trim();
            const oldKey = String(pref("apiKey", "")).trim();
            const oldModel = String(pref("model", "")).trim();
            const lowerBase = oldBase.toLowerCase();

            let newProvider = "custom";
            if (lowerBase.includes("dashscope.aliyuncs.com")) {
                newProvider = "qwen";
                if (oldKey) setPref("qwenApiKey", oldKey);
                if (oldModel) setPref("qwenModel", oldModel);
                setPref(
                    "qwenBaseURL",
                    oldBase.replace(/\/v1\/?$/i, "")
                );
            }
            else if (lowerBase.includes("siliconflow")) {
                newProvider = "siliconflow";
                if (oldKey) setPref("siliconflowApiKey", oldKey);
                if (oldModel) setPref("siliconflowModel", oldModel);
                if (oldBase) setPref("siliconflowBaseURL", oldBase);
            }
            else if (
                lowerBase.includes("volces.com")
                || lowerBase.includes("volcengine")
            ) {
                newProvider = "volcengine";
                if (oldKey) setPref("volcengineApiKey", oldKey);
                if (oldModel) setPref("volcengineModel", oldModel);
                if (oldBase) setPref("volcengineBaseURL", oldBase);
            }
            else if (lowerBase.includes("deepseek")) {
                newProvider = "deepseek";
                if (oldKey) setPref("deepseekApiKey", oldKey);
                if (oldModel) setPref("deepseekModel", oldModel);
                if (oldBase) setPref("deepseekBaseURL", oldBase);
            }
            else if (lowerBase.includes("api.openai.com")) {
                newProvider = "openai";
                if (oldKey) setPref("openaiApiKey", oldKey);
                if (oldModel) setPref("openaiModel", oldModel);
                if (oldBase) setPref("openaiBaseURL", oldBase);
            }
            else {
                newProvider = "custom";
                if (oldKey) setPref("customApiKey", oldKey);
                if (oldModel) setPref("customModel", oldModel);
                if (oldBase) setPref("customBaseURL", oldBase);
            }
            setPref("provider", newProvider);
        }

        setPref("migrationVersion", ZTT_MIGRATION_VERSION);
    }

    function isEditableRegularItem(item) {
        if (!item || !item.isRegularItem() || item.deleted) {
            return false;
        }
        if (typeof item.isEditable === "function" && !item.isEditable()) {
            return false;
        }
        return true;
    }

    function selectedRegularItems(window) {
        const pane = window?.ZoteroPane || Zotero.getActiveZoteroPane();
        if (!pane) {
            return [];
        }
        return pane.getSelectedItems().filter(isEditableRegularItem);
    }

    function getRowLibraryID(row) {
        const candidates = [
            row?.ref?.libraryID,
            row?.libraryID,
            row?.ref?.id
        ];
        for (const value of candidates) {
            const numeric = Number(value);
            if (Number.isInteger(numeric) && numeric > 0) {
                if (Zotero.Libraries.get(numeric)) {
                    return numeric;
                }
            }
        }
        return null;
    }

    function selectedLibraryContext(window) {
        const pane = window?.ZoteroPane || Zotero.getActiveZoteroPane();
        if (!pane) {
            return null;
        }

        let rows = [];
        if (typeof pane.getCollectionTreeRows === "function") {
            rows = pane.getCollectionTreeRows() || [];
        }

        if (rows.length === 1) {
            const libraryID = getRowLibraryID(rows[0]);
            if (libraryID) {
                return {
                    pane,
                    row: rows[0],
                    libraryID,
                    library: Zotero.Libraries.get(libraryID)
                };
            }
        }

        if (typeof pane.getSelectedLibraryID === "function") {
            const libraryID = Number(pane.getSelectedLibraryID());
            if (Number.isInteger(libraryID) && libraryID > 0) {
                return {
                    pane,
                    row: rows[0] || null,
                    libraryID,
                    library: Zotero.Libraries.get(libraryID)
                };
            }
        }

        return null;
    }

    function libraryIsEditable(context) {
        if (!context?.library) {
            return false;
        }
        return (
            !context.library.archived
            && context.library.editable !== false
            && context.row?.editable !== false
        );
    }

    function updateItemMenuState(window) {
        const state = windowState.get(window);
        if (!state) return;

        const hasItems = selectedRegularItems(window).length > 0;
        for (const node of state.itemCommandNodes) {
            node.disabled = busy || !hasItems;
        }
        state.translateNode.setAttribute(
            "label",
            busy ? "正在翻译标题…" : "翻译标题（跳过已有译题）"
        );
    }

    function updateFallbackLibraryMenus(window) {
        const state = windowState.get(window);
        if (!state) return;

        const context = selectedLibraryContext(window);
        const enabled = Boolean(context && libraryIsEditable(context));

        if (state.fallbackLibraryNode) {
            state.fallbackLibraryNode.hidden = !context;
            state.fallbackLibraryNode.disabled = busy || !enabled;
            state.fallbackLibraryNode.setAttribute(
                "label",
                busy
                    ? "正在翻译文献库标题…"
                    : "翻译所属文献库全部未翻译标题"
            );
        }

        if (state.fallbackToolsNode) {
            state.fallbackToolsNode.disabled = busy || !enabled;
            state.fallbackToolsNode.setAttribute(
                "label",
                busy
                    ? "正在翻译文献库标题…"
                    : "翻译当前文献库全部未翻译标题"
            );
        }
    }

    function updateAllWindowMenus() {
        for (const window of Zotero.getMainWindows()) {
            updateItemMenuState(window);
            updateFallbackLibraryMenus(window);
        }
    }

    function providerMinIntervalMs(provider) {
        // Qwen-MT common default is 60 RPM. Use 50 RPM to leave headroom.
        if (provider === "qwen") {
            return 1200;
        }
        return 0;
    }

    async function waitForProviderRateSlot(provider) {
        const interval = providerMinIntervalMs(provider);
        if (!interval) {
            return;
        }

        let releaseGate;
        const previousGate = providerRateGate;
        providerRateGate = new Promise(resolve => {
            releaseGate = resolve;
        });

        await previousGate;
        try {
            const now = Date.now();
            const nextAt = providerNextRequestAt.get(provider) || 0;
            const waitMs = Math.max(0, nextAt - now);
            if (waitMs) {
                await Zotero.Promise.delay(waitMs);
            }
            providerNextRequestAt.set(provider, Date.now() + interval);
        }
        finally {
            releaseGate();
        }
    }

    function httpStatusFromError(error) {
        const candidates = [
            error?.status,
            error?.statusCode,
            error?.xmlhttp?.status,
            error?.xmlHttpRequest?.status,
            error?.response?.status
        ];
        for (const candidate of candidates) {
            const value = Number(candidate);
            if (Number.isInteger(value) && value > 0) {
                return value;
            }
        }

        const match = String(error?.message || error || "")
            .match(/status(?: code)?\s+(\d{3})/i);
        return match ? Number(match[1]) : 0;
    }

    function responseTextFromError(error) {
        const candidates = [
            error?.responseText,
            error?.xmlhttp?.responseText,
            error?.xmlHttpRequest?.responseText,
            error?.response?.data,
            error?.response
        ];

        for (const candidate of candidates) {
            if (typeof candidate === "string" && candidate.trim()) {
                return candidate.trim();
            }
            if (candidate && typeof candidate === "object") {
                try {
                    return JSON.stringify(candidate);
                }
                catch (ignored) {}
            }
        }
        return "";
    }

    function enhanceHTTPError(error) {
        const status = httpStatusFromError(error);
        const responseText = responseTextFromError(error);

        let serviceMessage = "";
        if (responseText) {
            try {
                const data = JSON.parse(responseText);
                serviceMessage =
                    data?.error?.message
                    || data?.message
                    || data?.error?.code
                    || data?.code
                    || "";
            }
            catch (ignored) {
                serviceMessage = responseText.slice(0, 500);
            }
        }

        const originalMessage = String(
            error?.message || error || "HTTP 请求失败"
        ).trim();
        const parts = [];
        if (status) {
            parts.push(`HTTP ${status}`);
        }
        if (serviceMessage) {
            parts.push(String(serviceMessage).trim());
        }
        else if (originalMessage) {
            parts.push(originalMessage);
        }

        const enhanced = new Error(parts.join("：") || "HTTP 请求失败");
        enhanced.status = status;
        enhanced.originalError = error;
        return enhanced;
    }

    function isRetryableRateLimit(error) {
        return httpStatusFromError(error) === 429
            || error?.status === 429;
    }

    function retryDelayMs(attempt) {
        // 5, 10, 20, 40 seconds, capped at 60 seconds.
        return Math.min(60000, 5000 * (2 ** attempt));
    }

    async function withProviderRetry(provider, operation) {
        const maxRetries = provider === "qwen" ? 4 : 2;

        for (let attempt = 0; ; attempt++) {
            await waitForProviderRateSlot(provider);

            try {
                return await operation();
            }
            catch (rawError) {
                const error = rawError?.status
                    ? rawError
                    : enhanceHTTPError(rawError);

                if (
                    !isRetryableRateLimit(error)
                    || attempt >= maxRetries
                ) {
                    throw error;
                }

                const waitMs = retryDelayMs(attempt);
                log(
                    `${providerLabel(provider)} 触发 HTTP 429，`
                    + `${Math.round(waitMs / 1000)} 秒后重试 `
                    + `(${attempt + 1}/${maxRetries})`
                );
                await Zotero.Promise.delay(waitMs);
            }
        }
    }

    function requireConfigured(window, fields, message) {
        for (const field of fields) {
            if (!String(pref(field, "")).trim()) {
                alert(window, "标题翻译", message);
                return false;
            }
        }
        return true;
    }

    function validateTranslationConfig(window) {
        const provider = currentProvider();

        switch (provider) {
            case "mymemory":
                return requireConfigured(
                    window,
                    ["sourceLanguageCode"],
                    "MyMemory 需要源语言代码，例如英文使用 en。"
                );
            case "google":
                return requireConfigured(
                    window,
                    ["googleApiKey"],
                    "请填写 Google Cloud Translation API Key。"
                );
            case "deepl":
                return requireConfigured(
                    window,
                    ["deeplApiKey"],
                    "请填写 DeepL API Key。"
                );
            case "microsoft":
                return requireConfigured(
                    window,
                    ["microsoftApiKey", "microsoftEndpoint"],
                    "请填写 Microsoft Translator Key 和 Endpoint。"
                );
            case "libretranslate":
                return requireConfigured(
                    window,
                    ["libreTranslateURL"],
                    "请填写 LibreTranslate 服务地址。"
                );
            case "ollama":
                return requireConfigured(
                    window,
                    ["ollamaURL", "ollamaModel"],
                    "请填写 Ollama 地址和模型名称。"
                );
            case "qwen":
                return requireConfigured(
                    window,
                    ["qwenApiKey", "qwenBaseURL", "qwenModel"],
                    "请填写 Qwen-MT API Key、Base URL 和模型。"
                );
            case "siliconflow":
                return requireConfigured(
                    window,
                    [
                        "siliconflowApiKey",
                        "siliconflowBaseURL",
                        "siliconflowModel"
                    ],
                    "请填写 SiliconFlow API Key、Base URL 和模型。"
                );
            case "volcengine":
                return requireConfigured(
                    window,
                    [
                        "volcengineApiKey",
                        "volcengineBaseURL",
                        "volcengineModel"
                    ],
                    "请填写火山方舟 API Key、Base URL 和模型或接入点 ID。"
                );
            case "deepseek":
                return requireConfigured(
                    window,
                    ["deepseekApiKey", "deepseekBaseURL", "deepseekModel"],
                    "请填写 DeepSeek API Key、Base URL 和模型。"
                );
            case "gemini":
                return requireConfigured(
                    window,
                    ["geminiApiKey", "geminiBaseURL", "geminiModel"],
                    "请填写 Gemini API Key、Base URL 和模型。"
                );
            case "openai":
                return requireConfigured(
                    window,
                    ["openaiApiKey", "openaiBaseURL", "openaiModel"],
                    "请填写 OpenAI API Key、Base URL 和模型。"
                );
            case "custom":
                return requireConfigured(
                    window,
                    ["customBaseURL", "customModel"],
                    "请填写自定义 Base URL 和模型；需要鉴权时再填写 API Key。"
                );
            default:
                return false;
        }
    }

    function parseJSONResponse(xhr) {
        if (xhr.response && typeof xhr.response === "object") {
            return xhr.response;
        }
        try {
            return JSON.parse(xhr.responseText || "{}");
        }
        catch (error) {
            throw new Error("翻译服务返回了无法解析的 JSON。");
        }
    }

    async function postJSON(url, payload, headers, timeoutMs) {
        try {
            const xhr = await Zotero.HTTP.request("POST", url, {
                body: JSON.stringify(payload),
                headers: Object.assign(
                    {
                        "Content-Type":
                            "application/json; charset=utf-8"
                    },
                    headers || {}
                ),
                responseType: "json",
                timeout: timeoutMs
            });
            return parseJSONResponse(xhr);
        }
        catch (error) {
            throw enhanceHTTPError(error);
        }
    }

    async function requestBearerChat({
        baseURL,
        apiKey,
        model,
        title,
        timeoutMs,
        endpointBuilder = ZoteroTitleTranslatorCore.buildChatEndpoint,
        payloadBuilder = ZoteroTitleTranslatorCore.buildGenericChatPayload,
        extra = {},
        additionalHeaders = {}
    }) {
        const endpoint = endpointBuilder(baseURL);
        const payload = payloadBuilder(model, title, extra);
        const headers = Object.assign(
            {},
            additionalHeaders || {}
        );
        const cleanKey = String(apiKey ?? "").trim();
        if (cleanKey) {
            headers.Authorization = `Bearer ${cleanKey}`;
        }

        const data = await postJSON(
            endpoint,
            payload,
            headers,
            timeoutMs
        );
        return ZoteroTitleTranslatorCore
            .extractGenericChatTranslation(data);
    }

    async function requestTranslationOnce(title, provider) {
        const timeoutMs = Math.max(
            5000,
            Number(pref("timeoutMs", 60000)) || 60000
        );

        switch (provider) {
            case "mymemory": {
                const url = ZoteroTitleTranslatorCore.buildMyMemoryURL({
                    title,
                    sourceLanguageCode: pref(
                        "sourceLanguageCode",
                        "en"
                    ),
                    targetLanguageCode: "zh-CN",
                    email: pref("myMemoryEmail", "")
                });
                try {
                    const xhr = await Zotero.HTTP.request("GET", url, {
                        responseType: "json",
                        timeout: timeoutMs
                    });
                    return ZoteroTitleTranslatorCore
                        .extractMyMemoryTranslation(
                            parseJSONResponse(xhr)
                        );
                }
                finally {
                    await Zotero.Promise.delay(750);
                }
            }

            case "google": {
                const data = await postJSON(
                    "https://translation.googleapis.com/language/translate/v2",
                    ZoteroTitleTranslatorCore.buildGooglePayload(title),
                    {
                        "X-goog-api-key": String(
                            pref("googleApiKey", "")
                        ).trim()
                    },
                    timeoutMs
                );
                return ZoteroTitleTranslatorCore
                    .extractGoogleTranslation(data);
            }

            case "deepl": {
                const data = await postJSON(
                    ZoteroTitleTranslatorCore.buildDeepLEndpoint(
                        pref("deeplPlan", "free")
                    ),
                    ZoteroTitleTranslatorCore.buildDeepLPayload(title),
                    {
                        Authorization:
                            `DeepL-Auth-Key ${String(
                                pref("deeplApiKey", "")
                            ).trim()}`
                    },
                    timeoutMs
                );
                return ZoteroTitleTranslatorCore
                    .extractDeepLTranslation(data);
            }

            case "microsoft": {
                const headers = {
                    "Ocp-Apim-Subscription-Key": String(
                        pref("microsoftApiKey", "")
                    ).trim()
                };
                const region = String(
                    pref("microsoftRegion", "")
                ).trim();
                if (region) {
                    headers["Ocp-Apim-Subscription-Region"] = region;
                }

                const data = await postJSON(
                    ZoteroTitleTranslatorCore
                        .buildMicrosoftEndpoint(
                            pref(
                                "microsoftEndpoint",
                                "https://api.cognitive.microsofttranslator.com"
                            )
                        ),
                    ZoteroTitleTranslatorCore
                        .buildMicrosoftPayload(title),
                    headers,
                    timeoutMs
                );
                return ZoteroTitleTranslatorCore
                    .extractMicrosoftTranslation(data);
            }

            case "libretranslate": {
                const data = await postJSON(
                    ZoteroTitleTranslatorCore
                        .buildLibreTranslateEndpoint(
                            pref("libreTranslateURL", "")
                        ),
                    ZoteroTitleTranslatorCore
                        .buildLibreTranslatePayload(
                            title,
                            pref("libreTranslateAPIKey", "")
                        ),
                    {},
                    timeoutMs
                );
                return ZoteroTitleTranslatorCore
                    .extractLibreTranslateTranslation(data);
            }

            case "ollama": {
                const data = await postJSON(
                    ZoteroTitleTranslatorCore.buildOllamaEndpoint(
                        pref("ollamaURL", "")
                    ),
                    ZoteroTitleTranslatorCore.buildOllamaPayload({
                        model: pref(
                            "ollamaModel",
                            "translategemma:4b"
                        ),
                        title,
                        sourceLanguageName: pref(
                            "sourceLanguageName",
                            "English"
                        ),
                        sourceLanguageCode: pref(
                            "sourceLanguageCode",
                            "en"
                        )
                    }),
                    {},
                    timeoutMs
                );
                return ZoteroTitleTranslatorCore
                    .extractOllamaTranslation(data);
            }

            case "qwen":
                return requestBearerChat({
                    baseURL: pref("qwenBaseURL", ""),
                    apiKey: pref("qwenApiKey", ""),
                    model: pref("qwenModel", "qwen-mt-plus"),
                    title,
                    timeoutMs,
                    endpointBuilder:
                        ZoteroTitleTranslatorCore.buildQwenEndpoint,
                    payloadBuilder:
                        ZoteroTitleTranslatorCore.buildQwenPayload,
                    additionalHeaders: {
                        "X-DashScope-Wait-Timeout": "30"
                    }
                });

            case "siliconflow":
                return requestBearerChat({
                    baseURL: pref("siliconflowBaseURL", ""),
                    apiKey: pref("siliconflowApiKey", ""),
                    model: pref("siliconflowModel", ""),
                    title,
                    timeoutMs,
                    extra: {
                        enable_thinking: false
                    }
                });

            case "volcengine":
                return requestBearerChat({
                    baseURL: pref("volcengineBaseURL", ""),
                    apiKey: pref("volcengineApiKey", ""),
                    model: pref("volcengineModel", ""),
                    title,
                    timeoutMs,
                    extra: {
                        thinking: { type: "disabled" }
                    }
                });

            case "deepseek":
                return requestBearerChat({
                    baseURL: pref("deepseekBaseURL", ""),
                    apiKey: pref("deepseekApiKey", ""),
                    model: pref("deepseekModel", ""),
                    title,
                    timeoutMs,
                    extra: {
                        thinking: { type: "disabled" }
                    }
                });

            case "gemini": {
                const endpoint =
                    ZoteroTitleTranslatorCore.buildGeminiEndpoint(
                        pref("geminiBaseURL", ""),
                        pref("geminiModel", "")
                    );
                const data = await postJSON(
                    endpoint,
                    ZoteroTitleTranslatorCore
                        .buildGeminiPayload(title),
                    {
                        "x-goog-api-key": String(
                            pref("geminiApiKey", "")
                        ).trim()
                    },
                    timeoutMs
                );
                return ZoteroTitleTranslatorCore
                    .extractGeminiTranslation(data);
            }

            case "openai":
                return requestBearerChat({
                    baseURL: pref("openaiBaseURL", ""),
                    apiKey: pref("openaiApiKey", ""),
                    model: pref("openaiModel", ""),
                    title,
                    timeoutMs
                });

            case "custom":
                return requestBearerChat({
                    baseURL: pref("customBaseURL", ""),
                    apiKey: pref("customApiKey", ""),
                    model: pref("customModel", ""),
                    title,
                    timeoutMs
                });

            default:
                throw new Error("未知翻译服务。");
        }
    }

    async function requestTranslation(title) {
        const provider = currentProvider();
        return withProviderRetry(
            provider,
            () => requestTranslationOnce(title, provider)
        );
    }

    async function mapLimit(values, limit, worker) {
        let nextIndex = 0;
        const results = new Array(values.length);
        const workerCount = Math.min(
            Math.max(1, limit),
            values.length || 1
        );

        async function runWorker() {
            while (true) {
                const index = nextIndex++;
                if (index >= values.length) return;

                try {
                    results[index] = {
                        status: "fulfilled",
                        value: await worker(values[index], index)
                    };
                }
                catch (error) {
                    results[index] = {
                        status: "rejected",
                        reason: error
                    };
                }
            }
        }

        await Promise.all(
            Array.from({ length: workerCount }, runWorker)
        );
        return results;
    }

    function classifyItems(items, force) {
        const skipChinese = Boolean(pref("skipChinese", true));

        let skippedExisting = 0;
        let skippedChinese = 0;
        let skippedEmpty = 0;
        let skippedNotEditable = 0;
        const workItems = [];

        for (const item of items) {
            if (!isEditableRegularItem(item)) {
                skippedNotEditable++;
                continue;
            }

            const title = ZoteroTitleTranslatorCore.normalizeOneLine(
                item.getField("title")
            );
            const existing =
                ZoteroTitleTranslatorCore.readTranslation(
                    item.getField("extra")
                );

            if (!title) {
                skippedEmpty++;
                continue;
            }
            if (!force && existing) {
                skippedExisting++;
                continue;
            }
            if (
                !force
                && skipChinese
                && ZoteroTitleTranslatorCore.isMostlyChinese(title)
            ) {
                skippedChinese++;
                continue;
            }

            workItems.push({ item, title });
        }

        return {
            workItems,
            skippedExisting,
            skippedChinese,
            skippedEmpty,
            skippedNotEditable
        };
    }

    async function executeTranslationBatch(
        window,
        classified,
        scopeLabel
    ) {
        const {
            workItems,
            skippedExisting,
            skippedChinese,
            skippedEmpty,
            skippedNotEditable
        } = classified;

        if (!workItems.length) {
            showSilentNotification(
                window,
                "没有需要翻译的标题",
                [
                    `处理范围：${scopeLabel}`,
                    `已有译题：${skippedExisting}`,
                    `中文原标题：${skippedChinese}`,
                    `空标题：${skippedEmpty}`,
                    `不可编辑或非普通条目：${skippedNotEditable}`
                ]
            );
            return;
        }

        const provider = currentProvider();
        const concurrency = effectiveConcurrency(provider);
        let translated = 0;
        const failures = [];

        busy = true;
        updateAllWindowMenus();

        try {
            const results = await mapLimit(
                workItems,
                concurrency,
                async ({ item, title }) => {
                    const translation = await requestTranslation(title);
                    const oldExtra = item.getField("extra") || "";
                    item.setField(
                        "extra",
                        ZoteroTitleTranslatorCore.writeTranslation(
                            oldExtra,
                            translation
                        )
                    );
                    await item.saveTx();
                    translated++;
                    return translation;
                }
            );

            results.forEach((result, index) => {
                if (result.status !== "rejected") return;

                const title = workItems[index].title;
                const reason =
                    result.reason?.message
                    || result.reason?.toString?.()
                    || "未知错误";
                failures.push(`• ${title}\n  ${reason}`);
                logError(result.reason);
            });

            Zotero.ItemTreeManager.refreshColumns();

            const lines = [
                `处理范围：${scopeLabel}`,
                `翻译服务：${providerLabel(provider)}`,
                `成功翻译：${translated}`,
                `跳过已有译题：${skippedExisting}`,
                `直接显示中文原标题：${skippedChinese}`,
                `跳过空标题：${skippedEmpty}`,
                `跳过不可编辑或非普通条目：${skippedNotEditable}`,
                `失败：${failures.length}`
            ];

            if (failures.length) {
                lines.push(
                    "",
                    "失败详情（最多显示 8 条）：",
                    ...failures.slice(0, 8)
                );
            }

            // 完整结果保留在 Zotero Debug/Error Log 中，避免超长模态弹窗。
            log(lines.join("\n"));

            const notificationLines = [
                `处理范围：${scopeLabel}`,
                `翻译服务：${providerLabel(provider)}`,
                `成功：${translated}；失败：${failures.length}`,
                `跳过已有译题：${skippedExisting}`,
                `中文原标题：${skippedChinese}`,
                `空标题：${skippedEmpty}`
            ];

            if (failures.length) {
                notificationLines.push(
                    "失败详情已写入 Zotero 错误日志；"
                    + "再次运行会自动跳过已经成功的条目。"
                );
            }

            showSilentNotification(
                window,
                failures.length
                    ? "标题翻译完成（部分失败）"
                    : "标题翻译完成",
                notificationLines
            );
        }
        finally {
            busy = false;
            updateAllWindowMenus();
        }
    }

    async function translateSelected(window, force) {
        if (busy) return;

        const items = selectedRegularItems(window);
        if (!items.length) {
            alert(
                window,
                "标题翻译",
                "请先选择至少一个可编辑的普通文献条目。"
            );
            return;
        }
        if (!validateTranslationConfig(window)) return;

        await executeTranslationBatch(
            window,
            classifyItems(items, force),
            `所选 ${items.length} 个条目`
        );
    }

    async function translateLibrary(window, libraryID) {
        if (busy) return;

        const library = Zotero.Libraries.get(Number(libraryID));
        if (!library) {
            alert(window, "标题翻译", "无法读取所选文献库。");
            return;
        }
        if (library.archived || library.editable === false) {
            alert(
                window,
                "标题翻译",
                `文献库“${library.name}”不可编辑。`
            );
            return;
        }
        if (!validateTranslationConfig(window)) return;

        const allTopLevelItems = await Zotero.Items.getAll(
            library.libraryID,
            true,
            false
        );
        const regularItems = allTopLevelItems.filter(
            item => item && item.isRegularItem() && !item.deleted
        );
        const classified = classifyItems(regularItems, false);

        if (!classified.workItems.length) {
            await executeTranslationBatch(
                window,
                classified,
                `文献库“${library.name}”`
            );
            return;
        }

        const confirmed = confirm(
            window,
            "翻译整个文献库",
            `文献库“${library.name}”共有 `
            + `${regularItems.length} 个普通文献条目。\n\n`
            + `本次需要调用翻译服务：`
            + `${classified.workItems.length} 个\n`
            + `已有译题，将跳过：`
            + `${classified.skippedExisting} 个\n`
            + `中文原标题，直接显示：`
            + `${classified.skippedChinese} 个\n`
            + `空标题：${classified.skippedEmpty} 个\n`
            + `当前服务：${providerLabel()}\n\n`
            + `${providerBulkWarning()}\n\n`
            + "开始后当前版本不能中途取消。",
            "开始翻译"
        );

        if (!confirmed) return;

        await executeTranslationBatch(
            window,
            classified,
            `文献库“${library.name}”`
        );
    }

    async function translateCurrentLibrary(window) {
        const context = selectedLibraryContext(window);
        if (!context) {
            alert(
                window,
                "标题翻译",
                "无法确定当前文献库。请先在左侧选择一个文献库或分类。"
            );
            return;
        }
        await translateLibrary(window, context.libraryID);
    }

    async function clearSelected(window) {
        if (busy) return;

        const items = selectedRegularItems(window);
        if (!items.length) {
            alert(
                window,
                "标题翻译",
                "请先选择至少一个可编辑的普通文献条目。"
            );
            return;
        }

        let cleared = 0;
        for (const item of items) {
            const oldExtra = item.getField("extra") || "";
            if (!ZoteroTitleTranslatorCore.readTranslation(oldExtra)) {
                continue;
            }
            item.setField(
                "extra",
                ZoteroTitleTranslatorCore.clearTranslation(oldExtra)
            );
            await item.saveTx();
            cleared++;
        }

        Zotero.ItemTreeManager.refreshColumns();
        showSilentNotification(
            window,
            "标题译文已清除",
            [`已清除 ${cleared} 个条目的标题译文。`]
        );
    }

    function registerOfficialMenus() {
        if (!Zotero.MenuManager?.registerMenu) {
            log("Zotero.MenuManager.registerMenu 不可用，启用 DOM 回退。");
            return false;
        }

        const libraryMenuID = Zotero.MenuManager.registerMenu({
            menuID: "translate-library-titles",
            pluginID: ZTT_PLUGIN_ID,
            target: "main/library/collection",
            menus: [
                {
                    menuType: "menuitem",
                    icon: menuIconURI,
                    onShowing(event, context) {
                        const rows =
                            context.collectionTreeRows
                            || (
                                context.collectionTreeRow
                                    ? [context.collectionTreeRow]
                                    : []
                            );
                        const libraryID =
                            rows.length === 1
                                ? getRowLibraryID(rows[0])
                                : null;

                        context.setVisible(Boolean(libraryID));
                        if (!libraryID) return;

                        const library = Zotero.Libraries.get(libraryID);
                        const editable =
                            library
                            && !library.archived
                            && library.editable !== false
                            && rows[0]?.editable !== false;

                        context.setEnabled(!busy && editable);
                        context.menuElem?.setAttribute(
                            "label",
                            busy
                                ? "正在翻译文献库标题…"
                                : "翻译所属文献库全部未翻译标题"
                        );
                    },
                    onCommand(event, context) {
                        const rows =
                            context.collectionTreeRows
                            || (
                                context.collectionTreeRow
                                    ? [context.collectionTreeRow]
                                    : []
                            );
                        const libraryID =
                            rows.length === 1
                                ? getRowLibraryID(rows[0])
                                : null;
                        const window =
                            context.menuElem?.ownerGlobal
                            || event.currentTarget?.ownerGlobal
                            || Zotero.getMainWindow();

                        if (!libraryID) {
                            alert(
                                window,
                                "标题翻译",
                                "无法确定所选文献库。"
                            );
                            return;
                        }
                        translateLibrary(window, libraryID).catch(logError);
                    }
                }
            ]
        });

        const toolsMenuID = Zotero.MenuManager.registerMenu({
            menuID: "translate-current-library-titles",
            pluginID: ZTT_PLUGIN_ID,
            target: "main/menubar/tools",
            menus: [
                {
                    menuType: "menuitem",
                    icon: menuIconURI,
                    enableForTabTypes: ["library"],
                    onShowing(event, context) {
                        const window =
                            context.menuElem?.ownerGlobal
                            || event.currentTarget?.ownerGlobal
                            || Zotero.getMainWindow();
                        const libraryContext =
                            selectedLibraryContext(window);

                        context.setEnabled(
                            !busy
                            && Boolean(libraryContext)
                            && libraryIsEditable(libraryContext)
                        );
                        context.menuElem?.setAttribute(
                            "label",
                            busy
                                ? "正在翻译文献库标题…"
                                : "翻译当前文献库全部未翻译标题"
                        );
                    },
                    onCommand(event, context) {
                        const window =
                            context.menuElem?.ownerGlobal
                            || event.currentTarget?.ownerGlobal
                            || Zotero.getMainWindow();
                        translateCurrentLibrary(window).catch(logError);
                    }
                }
            ]
        });

        if (libraryMenuID) registeredMenuIDs.push(libraryMenuID);
        if (toolsMenuID) registeredMenuIDs.push(toolsMenuID);

        return Boolean(libraryMenuID);
    }

    function createMenuItem(
        document,
        id,
        label,
        command,
        iconURI = null
    ) {
        const item = document.createXULElement("menuitem");
        item.id = id;
        item.setAttribute("label", label);

        if (iconURI) {
            item.classList.add("menuitem-iconic");
            item.setAttribute("image", iconURI);
        }
        item.addEventListener("command", command);
        return item;
    }

    function installDOMFallbackMenus(window, document) {
        const collectionPopup =
            document.getElementById("zotero-collectionmenu");
        const toolsPopup =
            document.getElementById("menu_ToolsPopup");

        let fallbackLibraryNode = null;
        let fallbackToolsNode = null;

        if (collectionPopup) {
            fallbackLibraryNode = createMenuItem(
                document,
                "ztt-translate-library-titles-fallback",
                "翻译所属文献库全部未翻译标题",
                () => translateCurrentLibrary(window).catch(logError),
                menuIconURI
            );
            collectionPopup.appendChild(fallbackLibraryNode);
        }

        if (toolsPopup) {
            fallbackToolsNode = createMenuItem(
                document,
                "ztt-translate-current-library-fallback",
                "翻译当前文献库全部未翻译标题",
                () => translateCurrentLibrary(window).catch(logError),
                menuIconURI
            );
            fallbackToolsNode.classList.add("menu-type-library");
            toolsPopup.appendChild(fallbackToolsNode);
        }

        return {
            collectionPopup,
            toolsPopup,
            fallbackLibraryNode,
            fallbackToolsNode
        };
    }

    async function onMainWindowLoad(window) {
        if (!window || windowState.has(window)) return;

        const document = window.document;
        const itemPopup = document.getElementById("zotero-itemmenu");
        if (!itemPopup) {
            log("未找到 zotero-itemmenu。");
            return;
        }

        const separator = document.createXULElement("menuseparator");
        separator.id = "ztt-context-separator";

        const translateNode = createMenuItem(
            document,
            "ztt-translate-title",
            "翻译标题（跳过已有译题）",
            () => translateSelected(window, false).catch(logError),
            menuIconURI
        );
        const forceNode = createMenuItem(
            document,
            "ztt-force-translate-title",
            "重新翻译标题（覆盖已有译题）",
            () => translateSelected(window, true).catch(logError),
            menuIconURI
        );
        const clearNode = createMenuItem(
            document,
            "ztt-clear-title-translation",
            "清除标题译文",
            () => clearSelected(window).catch(logError)
        );

        itemPopup.append(
            separator,
            translateNode,
            forceNode,
            clearNode
        );

        const onItemPopupShowing = () =>
            updateItemMenuState(window);
        itemPopup.addEventListener(
            "popupshowing",
            onItemPopupShowing
        );

        let fallback = {
            collectionPopup: null,
            toolsPopup: null,
            fallbackLibraryNode: null,
            fallbackToolsNode: null
        };
        if (!registeredMenuIDs.length) {
            fallback = installDOMFallbackMenus(window, document);
        }

        const onCollectionPopupShowing = () =>
            updateFallbackLibraryMenus(window);
        const onToolsPopupShowing = () =>
            updateFallbackLibraryMenus(window);

        fallback.collectionPopup?.addEventListener(
            "popupshowing",
            onCollectionPopupShowing
        );
        fallback.toolsPopup?.addEventListener(
            "popupshowing",
            onToolsPopupShowing
        );

        windowState.set(window, {
            itemPopup,
            separator,
            translateNode,
            forceNode,
            clearNode,
            itemCommandNodes: [
                translateNode,
                forceNode,
                clearNode
            ],
            onItemPopupShowing,
            onCollectionPopupShowing,
            onToolsPopupShowing,
            ...fallback
        });

        updateItemMenuState(window);
        updateFallbackLibraryMenus(window);
    }

    function onMainWindowUnload(window) {
        const state = windowState.get(window);
        if (!state) return;

        state.itemPopup.removeEventListener(
            "popupshowing",
            state.onItemPopupShowing
        );
        state.collectionPopup?.removeEventListener(
            "popupshowing",
            state.onCollectionPopupShowing
        );
        state.toolsPopup?.removeEventListener(
            "popupshowing",
            state.onToolsPopupShowing
        );

        for (const node of [
            state.separator,
            state.translateNode,
            state.forceNode,
            state.clearNode,
            state.fallbackLibraryNode,
            state.fallbackToolsNode
        ]) {
            node?.remove();
        }
        windowState.delete(window);
    }

    async function startup() {
        migratePreferences();

        registeredColumnKey = await Promise.resolve(
            Zotero.ItemTreeManager.registerColumn({
                dataKey: ZTT_COLUMN_DATA_KEY,
                label: "标题（中文）",
                pluginID: ZTT_PLUGIN_ID,
                enabledTreeIDs: ["main"],
                flex: 2,
                minWidth: 160,
                showInColumnPicker: true,
                zoteroPersist: [
                    "width",
                    "hidden",
                    "sortDirection"
                ],
                dataProvider(item) {
                    if (!item || !item.isRegularItem()) {
                        return "";
                    }
                    return ZoteroTitleTranslatorCore
                        .getChineseDisplayTitle(
                            item.getField("title"),
                            item.getField("extra")
                        );
                }
            })
        );

        preferencePaneID = Zotero.PreferencePanes.register({
            pluginID: ZTT_PLUGIN_ID,
            src: rootURI + "content/preferences.xhtml",
            rawLabel: "标题翻译"
        });

        registerOfficialMenus();

        log(
            `插件已启动；column=${registeredColumnKey}; `
            + `preferencePane=${preferencePaneID}; `
            + `menus=${registeredMenuIDs.join(",")}`
        );
    }

    async function shutdown() {
        for (const window of Array.from(windowState.keys())) {
            onMainWindowUnload(window);
        }

        if (Zotero.MenuManager?.unregisterMenu) {
            for (const menuID of registeredMenuIDs.splice(0)) {
                Zotero.MenuManager.unregisterMenu(menuID);
            }
        }

        if (registeredColumnKey) {
            Zotero.ItemTreeManager.unregisterColumn(
                registeredColumnKey
            );
            registeredColumnKey = null;
            Zotero.ItemTreeManager.refreshColumns();
        }

        preferencePaneID = null;
        log("插件已停止。");
    }

    return {
        startup,
        shutdown,
        onMainWindowLoad,
        onMainWindowUnload,
        translateSelected,
        translateLibrary,
        translateCurrentLibrary,
        clearSelected
    };
}
