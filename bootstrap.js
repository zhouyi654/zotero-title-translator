var ZoteroTitleTranslator = null;
var ZoteroTitleTranslatorCore = null;
var ZTTGlobal = this;

const ZTT_PLUGIN_ID = "zotero-title-translator@zhouyi654.github.io";
const ZTT_PREF_PREFIX = "extensions.zotero.titleTranslator.";
const ZTT_COLUMN_DATA_KEY = "titleTranslation";
const ZTT_MIGRATION_VERSION = 5;

async function startup({ id, version, rootURI }, reason) {
    await Zotero.initializationPromise;

    Services.scriptloader.loadSubScript(rootURI + "core.js", ZTTGlobal);
    ZoteroTitleTranslatorCore = ZTTGlobal.ZoteroTitleTranslatorCore;

    ZoteroTitleTranslator = createTitleTranslator(rootURI);
    Zotero.ZoteroTitleTranslator = ZoteroTitleTranslator;
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
    if (Zotero.ZoteroTitleTranslator === ZoteroTitleTranslator) {
        delete Zotero.ZoteroTitleTranslator;
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
    let notifierObserverID = null;
    let busy = false;
    let pluginActive = true;
    let autoTranslateRunning = false;
    let autoTranslateScheduleGeneration = 0;
    let lastAutoTranslateConfigError = "";
    const autoTranslatePendingIDs = new Set();
    let pdf2zhHookOwner = null;
    let pdf2zhOriginalOnDialogEvents = null;
    let pdf2zhWrappedOnDialogEvents = null;
    let pdf2zhHookRetryGeneration = 0;
    let lastPdf2zhBridgeWarning = "";
    let lastPdf2zhBridgeSuccessSignature = "";

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


    function promptText(
        window,
        title,
        message,
        initialValue = ""
    ) {
        const value = { value: String(initialValue ?? "") };
        const accepted = Services.prompt.prompt(
            window || null,
            title,
            message,
            value,
            null,
            {}
        );
        return {
            accepted,
            value: String(value.value ?? "")
        };
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


    function configuredTerminologyEntries() {
        if (!Boolean(pref("terminologyEnabled", false))) {
            return [];
        }
        return ZoteroTitleTranslatorCore.parseTerminology(
            pref("terminologyEntries", "")
        );
    }


    function pdf2zhBridgeEnabled() {
        return Boolean(pref("pdf2zhBridgeEnabled", false));
    }

    function pdf2zhServerPath() {
        return String(pref("pdf2zhServerPath", "")).trim();
    }

    function pdf2zhEngine() {
        return String(
            Zotero.Prefs.get(
                "extensions.zotero.pdf2zh.engine",
                true
            )
            ?? ""
        ).trim();
    }

    function pathParent(value) {
        const path = String(value ?? "").replace(/[\\/]+$/, "");
        const match = path.match(/^(.*)[\\/][^\\/]+$/);
        return match ? match[1] : "";
    }

    async function existingPath(candidates) {
        for (const candidate of candidates) {
            if (candidate && await IOUtils.exists(candidate)) {
                return candidate;
            }
        }
        return "";
    }

    async function resolvePdf2zhBridgePaths(
        selectedPath = pdf2zhServerPath()
    ) {
        const base = String(selectedPath ?? "")
            .trim()
            .replace(/[\\/]+$/, "");
        if (!base) {
            throw new Error(
                "请先选择 PDF2zh Server 文件夹。"
            );
        }

        const configPath = await existingPath([
            PathUtils.join(base, "config", "config.toml"),
            PathUtils.join(
                base,
                "server",
                "config",
                "config.toml"
            ),
            PathUtils.join(base, "config.toml")
        ]);
        if (!configPath) {
            throw new Error(
                "所选文件夹中未找到 config/config.toml。"
                + "请选择包含 server.py 的 PDF2zh Server 文件夹，"
                + "或选择项目根目录。"
            );
        }

        const configDirectory = pathParent(configPath);
        const serverDirectory = pathParent(configDirectory);
        const serverScript = PathUtils.join(
            serverDirectory,
            "server.py"
        );
        const repositoryServerScript = PathUtils.join(
            base,
            "server",
            "server.py"
        );

        return {
            selectedPath: base,
            configPath,
            configDirectory,
            serverDirectory,
            serverScriptFound:
                await IOUtils.exists(serverScript)
                || await IOUtils.exists(repositoryServerScript),
            glossaryPath: PathUtils.join(
                configDirectory,
                "zotero-title-translator-glossary.csv"
            ),
            statePath: PathUtils.join(
                configDirectory,
                "zotero-title-translator-bridge-state.json"
            ),
            backupPath:
                configPath + ".ztt-backup"
        };
    }

    async function readJSONFile(path) {
        if (!await IOUtils.exists(path)) {
            return null;
        }
        try {
            return JSON.parse(
                await Zotero.File.getContentsAsync(path)
            );
        }
        catch (error) {
            throw new Error(
                `无法读取桥接状态文件：${error?.message || error}`
            );
        }
    }

    async function writeTextFile(path, content) {
        await Zotero.File.putContentsAsync(
            path,
            String(content ?? "")
        );
    }

    function pdf2zhBridgeMode() {
        return pref("pdf2zhGlossaryMode", "append")
            === "replace"
            ? "replace"
            : "append";
    }

    function pdf2zhForceIgnoreCache() {
        return Boolean(
            pref("pdf2zhForceIgnoreCache", true)
        );
    }

    function pdf2zhShowSyncNotification() {
        return Boolean(
            pref("pdf2zhShowSyncNotification", true)
        );
    }

    async function syncPdf2zhGlossary(options = {}) {
        const interactive = options.interactive === true;
        if (!pdf2zhBridgeEnabled() && !interactive) {
            return {
                skipped: true,
                reason: "disabled"
            };
        }

        const engine = pdf2zhEngine();
        if (engine && engine !== "pdf2zh_next") {
            throw new Error(
                "PDF2zh 当前翻译引擎不是 pdf2zh_next。"
                + "旧版 pdf2zh 引擎不支持该术语桥接。"
            );
        }

        const entries = configuredTerminologyEntries();
        if (!entries.length) {
            throw new Error(
                "当前术语表未启用或没有有效术语。"
            );
        }

        const paths = await resolvePdf2zhBridgePaths();
        const configText = await Zotero.File.getContentsAsync(
            paths.configPath
        );
        let state = await readJSONFile(paths.statePath);
        const disableAutoGlossary = Boolean(
            pref(
                "pdf2zhDisableAutoGlossary",
                false
            )
        );
        let workingConfigText = configText;

        if (
            !disableAutoGlossary
            && state?.changedNoAutoGlossary
        ) {
            workingConfigText = ZoteroTitleTranslatorCore
                .restorePdf2zhToml(
                    workingConfigText,
                    {
                        glossaryPath: "",
                        originalAssignments:
                            state.originalAssignments,
                        changedNoAutoGlossary: true
                    }
                );
            state.changedNoAutoGlossary = false;
        }

        const forceIgnoreCache =
            pdf2zhForceIgnoreCache();
        if (
            !forceIgnoreCache
            && state?.changedIgnoreCache
        ) {
            workingConfigText = ZoteroTitleTranslatorCore
                .restorePdf2zhToml(
                    workingConfigText,
                    {
                        glossaryPath: "",
                        originalAssignments:
                            state.originalAssignments,
                        changedIgnoreCache: true
                    }
                );
            state.changedIgnoreCache = false;
        }

        const updated = ZoteroTitleTranslatorCore
            .configurePdf2zhToml(
                workingConfigText,
                {
                    glossaryPath: paths.glossaryPath,
                    mode: pdf2zhBridgeMode(),
                    disableAutoGlossary,
                    forceIgnoreCache
                }
            );

        if (!await IOUtils.exists(paths.backupPath)) {
            await writeTextFile(
                paths.backupPath,
                configText
            );
        }

        const targetLanguage = String(
            Zotero.Prefs.get(
                "extensions.zotero.pdf2zh.targetLang",
                true
            )
            ?? "zh-CN"
        ).trim() || "zh-CN";
        const glossaryCSV = ZoteroTitleTranslatorCore
            .buildPdf2zhGlossaryCSV(
                entries,
                targetLanguage
            );

        await writeTextFile(
            paths.glossaryPath,
            glossaryCSV
        );
        await writeTextFile(
            paths.configPath,
            updated.text
        );

        const verifiedConfig =
            await Zotero.File.getContentsAsync(
                paths.configPath
            );
        const verification =
            ZoteroTitleTranslatorCore.inspectPdf2zhToml(
                verifiedConfig,
                paths.glossaryPath
            );
        const glossaryFileExists =
            await IOUtils.exists(paths.glossaryPath);

        if (!glossaryFileExists) {
            throw new Error(
                "术语 CSV 写入后未找到，桥接未生效。"
            );
        }
        if (!verification.glossaryConfigured) {
            throw new Error(
                "config.toml 写入后未引用生成的术语 CSV。"
            );
        }
        if (
            forceIgnoreCache
            && !verification.ignoreCache
        ) {
            throw new Error(
                "config.toml 未成功启用 ignore_cache。"
            );
        }

        const now = new Date().toISOString();
        if (!state) {
            state = {
                schemaVersion: 2,
                pluginVersion: "0.3.8",
                configPath: paths.configPath,
                glossaryPath: paths.glossaryPath,
                originalAssignments:
                    updated.originalAssignments,
                changedNoAutoGlossary:
                    updated.changedNoAutoGlossary,
                changedIgnoreCache:
                    updated.changedIgnoreCache,
                createdAt: now
            };
        }
        else {
            state.schemaVersion = 2;
            state.pluginVersion = "0.3.8";
            state.originalAssignments =
                state.originalAssignments || {};
            for (const key of [
                "glossaries",
                "no_auto_extract_glossary",
                "ignore_cache"
            ]) {
                if (
                    !(key in state.originalAssignments)
                ) {
                    state.originalAssignments[key] =
                        updated.originalAssignments[key];
                }
            }
            if (updated.changedNoAutoGlossary) {
                state.changedNoAutoGlossary = true;
            }
            if (updated.changedIgnoreCache) {
                state.changedIgnoreCache = true;
            }
        }
        state.lastSyncedAt = now;
        state.termCount = entries.length;
        state.targetLanguage = targetLanguage;
        state.forceIgnoreCache = forceIgnoreCache;
        state.verification = verification;
        await writeTextFile(
            paths.statePath,
            JSON.stringify(state, null, 2) + "\n"
        );

        const result = {
            skipped: false,
            termCount: entries.length,
            targetLanguage,
            engine: engine || "pdf2zh_next",
            hookInstalled:
                pdf2zhWrappedOnDialogEvents !== null,
            serverScriptFound: paths.serverScriptFound,
            glossaryFileExists,
            verification,
            forceIgnoreCache,
            lastSyncedAt: now,
            ...paths
        };

        log(
            `PDF2zh 术语已同步：terms=${entries.length}; `
            + `config=${paths.configPath}; `
            + `glossary=${paths.glossaryPath}`
        );
        return result;
    }

    async function restorePdf2zhBridge() {
        const paths = await resolvePdf2zhBridgePaths();
        const state = await readJSONFile(paths.statePath);
        if (!state) {
            throw new Error(
                "未找到桥接状态文件，无法确定需要恢复的配置。"
            );
        }

        const configText = await Zotero.File.getContentsAsync(
            paths.configPath
        );
        const restored = ZoteroTitleTranslatorCore
            .restorePdf2zhToml(configText, state);
        await writeTextFile(paths.configPath, restored);

        for (const path of [
            paths.glossaryPath,
            paths.statePath
        ]) {
            if (await IOUtils.exists(path)) {
                await IOUtils.remove(path);
            }
        }

        log(`已恢复 PDF2zh 术语配置：${paths.configPath}`);
        return {
            restored: true,
            ...paths
        };
    }

    async function getPdf2zhBridgeStatus() {
        let paths = null;
        let error = "";
        try {
            paths = await resolvePdf2zhBridgePaths();
        }
        catch (caught) {
            error = caught?.message || String(caught);
        }

        const pdf2zhDetected = Boolean(
            Zotero.pdf2zh?.hooks
        );
        const terminologyCount =
            configuredTerminologyEntries().length;

        let verification = null;
        let glossaryFileExists = false;
        let state = null;
        if (paths) {
            try {
                const configText =
                    await Zotero.File.getContentsAsync(
                        paths.configPath
                    );
                verification =
                    ZoteroTitleTranslatorCore.inspectPdf2zhToml(
                        configText,
                        paths.glossaryPath
                    );
                glossaryFileExists =
                    await IOUtils.exists(
                        paths.glossaryPath
                    );
                state = await readJSONFile(
                    paths.statePath
                );
            }
            catch (caught) {
                error = error
                    || caught?.message
                    || String(caught);
            }
        }

        return {
            enabled: pdf2zhBridgeEnabled(),
            pdf2zhDetected,
            hookInstalled:
                pdf2zhWrappedOnDialogEvents !== null,
            engine: pdf2zhEngine() || "未知",
            terminologyCount,
            forceIgnoreCache:
                pdf2zhForceIgnoreCache(),
            glossaryFileExists,
            verification,
            lastSyncedAt:
                state?.lastSyncedAt || "",
            lastSyncedTermCount:
                state?.termCount ?? null,
            error,
            ...(paths || {})
        };
    }

    function warnPdf2zhBridge(error) {
        const message = error?.message || String(error);
        logError(error);
        if (message === lastPdf2zhBridgeWarning) {
            return;
        }
        lastPdf2zhBridgeWarning = message;
        showSilentNotification(
            Zotero.getMainWindow(),
            "PDF2zh 术语桥接未同步",
            [
                message,
                "PDF2zh 将继续按原配置执行翻译。"
            ]
        );
    }

    function installPdf2zhBridgeHook() {
        const hooks = Zotero.pdf2zh?.hooks;
        const current = hooks?.onDialogEvents;
        if (!hooks || typeof current !== "function") {
            return false;
        }
        if (current === pdf2zhWrappedOnDialogEvents) {
            return true;
        }
        if (current.__zttPdf2zhBridge === true) {
            pdf2zhHookOwner = hooks;
            pdf2zhWrappedOnDialogEvents = current;
            return true;
        }

        const original = current;
        const wrapped = function (type, ...args) {
            if (
                type !== "translatePDF"
                || !pdf2zhBridgeEnabled()
            ) {
                return original.apply(this, [type, ...args]);
            }

            return Promise.resolve()
                .then(() => syncPdf2zhGlossary())
                .then(result => {
                    if (
                        result
                        && !result.skipped
                        && pdf2zhShowSyncNotification()
                    ) {
                        const signature = [
                            result.lastSyncedAt,
                            result.termCount,
                            result.forceIgnoreCache
                        ].join(":");
                        if (
                            signature
                            !== lastPdf2zhBridgeSuccessSignature
                        ) {
                            lastPdf2zhBridgeSuccessSignature =
                                signature;
                            showSilentNotification(
                                Zotero.getMainWindow(),
                                "PDF2zh 术语桥接已生效",
                                [
                                    `已同步 ${result.termCount} 条术语。`,
                                    result.forceIgnoreCache
                                        ? "本次已强制忽略旧翻译缓存。"
                                        : "本次允许使用旧翻译缓存。"
                                ]
                            );
                        }
                    }
                    return result;
                })
                .catch(warnPdf2zhBridge)
                .then(() => original.apply(this, [type, ...args]));
        };
        wrapped.__zttPdf2zhBridge = true;
        wrapped.__zttOriginal = original;

        try {
            hooks.onDialogEvents = wrapped;
        }
        catch (error) {
            logError(error);
            return false;
        }

        pdf2zhHookOwner = hooks;
        pdf2zhOriginalOnDialogEvents = original;
        pdf2zhWrappedOnDialogEvents = wrapped;
        log("已安装 PDF2zh 翻译入口术语桥接。\n");
        return true;
    }

    function uninstallPdf2zhBridgeHook() {
        if (
            pdf2zhHookOwner
            && pdf2zhWrappedOnDialogEvents
            && pdf2zhHookOwner.onDialogEvents
                === pdf2zhWrappedOnDialogEvents
        ) {
            pdf2zhHookOwner.onDialogEvents =
                pdf2zhOriginalOnDialogEvents;
        }
        pdf2zhHookOwner = null;
        pdf2zhOriginalOnDialogEvents = null;
        pdf2zhWrappedOnDialogEvents = null;
    }

    async function schedulePdf2zhBridgeHook() {
        const generation = ++pdf2zhHookRetryGeneration;
        for (const delay of [0, 1000, 3000, 10000, 30000]) {
            if (delay) {
                await Zotero.Promise.delay(delay);
            }
            if (
                !pluginActive
                || generation !== pdf2zhHookRetryGeneration
            ) {
                return false;
            }
            if (installPdf2zhBridgeHook()) {
                return true;
            }
        }
        return false;
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

        if (migrated < 4) {
            const terminologyText = String(
                pref("terminologyEntries", "")
            );
            if (terminologyText.trim()) {
                setPref(
                    "terminologyEntries",
                    ZoteroTitleTranslatorCore
                        .normalizeTerminologyText(
                            terminologyText
                        )
                );
            }
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
            if (
                Number.isInteger(numeric)
                && numeric > 0
                && Zotero.Libraries.get(numeric)
            ) {
                return numeric;
            }
        }
        return null;
    }

    function getCollectionFromRow(row) {
        if (!row) {
            return null;
        }

        const ref = row.ref;
        if (
            ref
            && typeof ref.getChildItems === "function"
            && Number(ref.id) > 0
        ) {
            return ref;
        }

        const isCollection =
            typeof row.isCollection === "function"
            && row.isCollection();

        if (!isCollection) {
            return null;
        }

        const collectionID = Number(
            ref?.id
            ?? ref?.collectionID
            ?? row.collectionID
        );

        return Number.isInteger(collectionID) && collectionID > 0
            ? Zotero.Collections.get(collectionID)
            : null;
    }

    function scopeFromRows(window, rows = []) {
        const pane = window?.ZoteroPane || Zotero.getActiveZoteroPane();
        if (!pane || rows.length !== 1) {
            return null;
        }

        const row = rows[0];
        const collection = getCollectionFromRow(row);
        if (collection) {
            const library = Zotero.Libraries.get(collection.libraryID);
            return {
                type: "collection",
                pane,
                row,
                library,
                libraryID: collection.libraryID,
                collection,
                collectionID: collection.id,
                name: collection.name
            };
        }

        const libraryID = getRowLibraryID(row);
        const library = libraryID
            ? Zotero.Libraries.get(libraryID)
            : null;

        if (!library) {
            return null;
        }

        return {
            type: "library",
            pane,
            row,
            library,
            libraryID,
            collection: null,
            collectionID: null,
            name: library.name
        };
    }

    function selectedScopeContext(window) {
        const pane = window?.ZoteroPane || Zotero.getActiveZoteroPane();
        if (!pane) {
            return null;
        }

        let rows = [];
        if (typeof pane.getCollectionTreeRows === "function") {
            rows = pane.getCollectionTreeRows() || [];
        }

        const rowScope = scopeFromRows(window, rows);
        if (rowScope) {
            return rowScope;
        }

        if (typeof pane.getSelectedCollection === "function") {
            const collection = pane.getSelectedCollection();
            if (collection) {
                const library = Zotero.Libraries.get(
                    collection.libraryID
                );
                return {
                    type: "collection",
                    pane,
                    row: rows[0] || null,
                    library,
                    libraryID: collection.libraryID,
                    collection,
                    collectionID: collection.id,
                    name: collection.name
                };
            }
        }

        if (typeof pane.getSelectedLibraryID === "function") {
            const libraryID = Number(pane.getSelectedLibraryID());
            const library = Number.isInteger(libraryID)
                ? Zotero.Libraries.get(libraryID)
                : null;

            if (library) {
                return {
                    type: "library",
                    pane,
                    row: rows[0] || null,
                    library,
                    libraryID,
                    collection: null,
                    collectionID: null,
                    name: library.name
                };
            }
        }

        return null;
    }

    function scopeIsEditable(context) {
        if (!context?.library) {
            return false;
        }
        return (
            !context.library.archived
            && context.library.editable !== false
            && context.row?.editable !== false
        );
    }

    function scopeMenuLabel(context, busyLabel = false) {
        if (busyLabel) {
            return context?.type === "collection"
                ? "正在翻译所选分类标题…"
                : "正在翻译文献库标题…";
        }

        return context?.type === "collection"
            ? "翻译此分类中的未翻译标题"
            : "翻译整个文献库中的未翻译标题";
    }

    function scopeDescription(context) {
        return context?.type === "collection"
            ? `分类“${context.name}”`
            : `文献库“${context.name}”`;
    }

    function updateItemMenuState(window) {
        const state = windowState.get(window);
        if (!state) return;

        const selectedItems = selectedRegularItems(window);
        const hasItems = selectedItems.length > 0;
        const hasSingleItem = selectedItems.length === 1;

        state.translateNode.disabled = busy || !hasItems;
        state.forceNode.disabled = busy || !hasItems;
        state.clearNode.disabled = busy || !hasItems;
        state.editNode.disabled = busy || !hasSingleItem;

        state.translateNode.setAttribute(
            "label",
            busy ? "正在翻译标题…" : "翻译标题（跳过已有译题）"
        );
    }

    function updateFallbackLibraryMenus(window) {
        const state = windowState.get(window);
        if (!state) return;

        const context = selectedScopeContext(window);
        const enabled = Boolean(context && scopeIsEditable(context));

        if (state.fallbackLibraryNode) {
            state.fallbackLibraryNode.hidden = !context;
            state.fallbackLibraryNode.disabled = busy || !enabled;
            state.fallbackLibraryNode.setAttribute(
                "label",
                scopeMenuLabel(context, busy)
            );
        }

        if (state.fallbackToolsNode) {
            state.fallbackToolsNode.disabled = busy || !enabled;
            state.fallbackToolsNode.setAttribute(
                "label",
                context?.type === "collection"
                    ? (
                        busy
                            ? "正在翻译当前分类标题…"
                            : "翻译当前分类中的未翻译标题"
                    )
                    : (
                        busy
                            ? "正在翻译当前文献库标题…"
                            : "翻译当前文献库中的未翻译标题"
                    )
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

    function firstMissingPreference(fields) {
        for (const field of fields) {
            if (!String(pref(field, "")).trim()) {
                return field;
            }
        }
        return "";
    }

    function translationConfigurationError(
        provider = currentProvider()
    ) {
        const configurations = {
            mymemory: {
                fields: ["sourceLanguageCode"],
                message:
                    "MyMemory 需要源语言代码，例如英文使用 en。"
            },
            google: {
                fields: ["googleApiKey"],
                message:
                    "请填写 Google Cloud Translation API Key。"
            },
            deepl: {
                fields: ["deeplApiKey"],
                message: "请填写 DeepL API Key。"
            },
            microsoft: {
                fields: [
                    "microsoftApiKey",
                    "microsoftEndpoint"
                ],
                message:
                    "请填写 Microsoft Translator Key 和 Endpoint。"
            },
            libretranslate: {
                fields: ["libreTranslateURL"],
                message:
                    "请填写 LibreTranslate 服务地址。"
            },
            ollama: {
                fields: ["ollamaURL", "ollamaModel"],
                message:
                    "请填写 Ollama 地址和模型名称。"
            },
            qwen: {
                fields: [
                    "qwenApiKey",
                    "qwenBaseURL",
                    "qwenModel"
                ],
                message:
                    "请填写 Qwen-MT API Key、Base URL 和模型。"
            },
            siliconflow: {
                fields: [
                    "siliconflowApiKey",
                    "siliconflowBaseURL",
                    "siliconflowModel"
                ],
                message:
                    "请填写 SiliconFlow API Key、Base URL 和模型。"
            },
            volcengine: {
                fields: [
                    "volcengineApiKey",
                    "volcengineBaseURL",
                    "volcengineModel"
                ],
                message:
                    "请填写火山方舟 API Key、Base URL 和模型或接入点 ID。"
            },
            deepseek: {
                fields: [
                    "deepseekApiKey",
                    "deepseekBaseURL",
                    "deepseekModel"
                ],
                message:
                    "请填写 DeepSeek API Key、Base URL 和模型。"
            },
            gemini: {
                fields: [
                    "geminiApiKey",
                    "geminiBaseURL",
                    "geminiModel"
                ],
                message:
                    "请填写 Gemini API Key、Base URL 和模型。"
            },
            openai: {
                fields: [
                    "openaiApiKey",
                    "openaiBaseURL",
                    "openaiModel"
                ],
                message:
                    "请填写 OpenAI API Key、Base URL 和模型。"
            },
            custom: {
                fields: ["customBaseURL", "customModel"],
                message:
                    "请填写自定义 Base URL 和模型；"
                    + "需要鉴权时再填写 API Key。"
            }
        };

        const configuration = configurations[provider];
        if (!configuration) {
            return "未知翻译服务。";
        }

        return firstMissingPreference(configuration.fields)
            ? configuration.message
            : "";
    }

    function validateTranslationConfig(window) {
        const message = translationConfigurationError();
        if (!message) {
            return true;
        }

        alert(window, "标题翻译", message);
        return false;
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
        additionalHeaders = {},
        terminologyEntries = []
    }) {
        const endpoint = endpointBuilder(baseURL);
        const payload = payloadBuilder(
            model,
            title,
            extra,
            terminologyEntries
        );
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

    async function requestTranslationOnce(
        title,
        provider,
        terminologyEntries = []
    ) {
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
                        ),
                        terminologyEntries
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
                    },
                    terminologyEntries
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
                    },
                    terminologyEntries
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
                    },
                    terminologyEntries
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
                    },
                    terminologyEntries
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
                        .buildGeminiPayload(
                            title,
                            terminologyEntries
                        ),
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
                    timeoutMs,
                    terminologyEntries
                });

            case "custom":
                return requestBearerChat({
                    baseURL: pref("customBaseURL", ""),
                    apiKey: pref("customApiKey", ""),
                    model: pref("customModel", ""),
                    title,
                    timeoutMs,
                    terminologyEntries
                });

            default:
                throw new Error("未知翻译服务。");
        }
    }

    async function requestTranslation(title) {
        const provider = currentProvider();
        const terminologyEntries =
            ZoteroTitleTranslatorCore.matchingTerminologyEntries(
                title,
                configuredTerminologyEntries()
            );
        const translation = await withProviderRetry(
            provider,
            () => requestTranslationOnce(
                title,
                provider,
                terminologyEntries
            )
        );
        return ZoteroTitleTranslatorCore.applyTerminology(
            title,
            translation,
            terminologyEntries
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

    function autoTranslateEnabled() {
        return Boolean(pref("autoTranslateOnAdd", false));
    }

    function autoTranslateDelayMs() {
        const seconds = Number(
            pref("autoTranslateDelaySeconds", 3)
        );
        const safeSeconds = Number.isFinite(seconds)
            ? Math.min(30, Math.max(1, seconds))
            : 3;
        return safeSeconds * 1000;
    }

    function queueAutomaticTranslation(ids) {
        if (!pluginActive || !autoTranslateEnabled()) {
            return;
        }

        for (const id of ids || []) {
            const numericID = Number(id);
            if (Number.isInteger(numericID) && numericID > 0) {
                autoTranslatePendingIDs.add(numericID);
            }
        }

        if (!autoTranslatePendingIDs.size) {
            return;
        }

        const generation = ++autoTranslateScheduleGeneration;
        Zotero.Promise.delay(autoTranslateDelayMs())
            .then(() => {
                if (
                    !pluginActive
                    || generation !== autoTranslateScheduleGeneration
                ) {
                    return;
                }
                return processAutomaticTranslationQueue();
            })
            .catch(logError);
    }

    function schedulePendingAutomaticTranslation() {
        if (
            pluginActive
            && autoTranslateEnabled()
            && autoTranslatePendingIDs.size
        ) {
            queueAutomaticTranslation([]);
        }
    }

    async function processAutomaticTranslationQueue() {
        if (!pluginActive || !autoTranslateEnabled()) {
            autoTranslatePendingIDs.clear();
            return;
        }

        if (autoTranslateRunning || busy) {
            schedulePendingAutomaticTranslation();
            return;
        }

        const ids = Array.from(autoTranslatePendingIDs);
        autoTranslatePendingIDs.clear();
        if (!ids.length) {
            return;
        }

        autoTranslateRunning = true;

        try {
            const configurationError =
                translationConfigurationError();

            if (configurationError) {
                log(
                    "自动翻译已跳过："
                    + configurationError
                );

                if (
                    configurationError
                    !== lastAutoTranslateConfigError
                ) {
                    lastAutoTranslateConfigError =
                        configurationError;
                    showSilentNotification(
                        Zotero.getMainWindow(),
                        "自动翻译未执行",
                        [
                            configurationError,
                            "请在“设置 → 标题翻译”中完成配置。"
                        ]
                    );
                }
                return;
            }

            lastAutoTranslateConfigError = "";

            const loaded = await Zotero.Items.getAsync(ids);
            const items = (
                Array.isArray(loaded) ? loaded : [loaded]
            ).filter(isEditableRegularItem);

            if (!items.length) {
                return;
            }

            const classified = classifyItems(items, false);

            // 中文、空标题或已有译题不需要产生提示。
            if (!classified.workItems.length) {
                return;
            }

            await executeTranslationBatch(
                Zotero.getMainWindow(),
                classified,
                `自动翻译 ${classified.workItems.length} 个新导入条目`
            );
        }
        catch (error) {
            logError(error);
        }
        finally {
            autoTranslateRunning = false;
            schedulePendingAutomaticTranslation();
        }
    }

    const automaticTranslationObserver = {
        notify(event, type, ids, extraData) {
            if (
                event !== "add"
                || type !== "item"
                || !autoTranslateEnabled()
            ) {
                return;
            }

            queueAutomaticTranslation(ids);
        }
    };

    function registerAutomaticTranslationObserver() {
        if (notifierObserverID) {
            return;
        }

        notifierObserverID = Zotero.Notifier.registerObserver(
            automaticTranslationObserver,
            ["item"],
            "zotero-title-translator-auto-translation"
        );

        log(
            `已注册自动翻译观察器：${notifierObserverID}`
        );
    }

    function unregisterAutomaticTranslationObserver() {
        if (!notifierObserverID) {
            return;
        }

        Zotero.Notifier.unregisterObserver(
            notifierObserverID
        );
        notifierObserverID = null;
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

    async function getScopeRegularItems(context) {
        if (context.type === "collection") {
            const childItems = await Promise.resolve(
                context.collection.getChildItems()
            );
            return childItems.filter(
                item => item && item.isRegularItem() && !item.deleted
            );
        }

        const allTopLevelItems = await Zotero.Items.getAll(
            context.libraryID,
            true,
            false
        );
        return allTopLevelItems.filter(
            item => item && item.isRegularItem() && !item.deleted
        );
    }

    async function translateScope(window, context) {
        if (busy) return;

        if (!context?.library) {
            alert(window, "标题翻译", "无法读取所选分类或文献库。");
            return;
        }
        if (!scopeIsEditable(context)) {
            alert(
                window,
                "标题翻译",
                `${scopeDescription(context)}不可编辑。`
            );
            return;
        }
        if (!validateTranslationConfig(window)) return;

        const regularItems = await getScopeRegularItems(context);
        const classified = classifyItems(regularItems, false);
        const description = scopeDescription(context);

        if (!classified.workItems.length) {
            await executeTranslationBatch(
                window,
                classified,
                description
            );
            return;
        }

        const collectionNotice = context.type === "collection"
            ? (
                "仅处理该分类直接包含的条目；"
                + "不会处理其子分类中的条目。\n"
            )
            : "";

        const confirmed = confirm(
            window,
            context.type === "collection"
                ? "翻译所选分类"
                : "翻译整个文献库",
            `${description}共有 `
            + `${regularItems.length} 个普通文献条目。\n`
            + collectionNotice
            + "\n"
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
            description
        );
    }

    async function translateCurrentScope(window) {
        const context = selectedScopeContext(window);
        if (!context) {
            alert(
                window,
                "标题翻译",
                "无法确定当前分类或文献库。"
                + "请先在左侧选择一个实际分类或文献库根节点。"
            );
            return;
        }
        await translateScope(window, context);
    }

    async function editSelectedTranslation(window) {
        if (busy) return;

        const items = selectedRegularItems(window);
        if (items.length !== 1) {
            alert(
                window,
                "编辑标题译文",
                "请只选择一个可编辑的普通文献条目。"
            );
            return;
        }

        const item = items[0];
        const originalTitle =
            ZoteroTitleTranslatorCore.normalizeOneLine(
                item.getField("title")
            );
        const oldExtra = item.getField("extra") || "";
        const currentTranslation =
            ZoteroTitleTranslatorCore.readTranslation(oldExtra);
        const result = promptText(
            window,
            "编辑标题译文",
            "原始标题：\n"
            + `${originalTitle || "（空标题）"}\n\n`
            + "请输入中文译题。留空并确认将清除现有译题。",
            currentTranslation
        );

        if (!result.accepted) {
            return;
        }

        const edited =
            ZoteroTitleTranslatorCore.normalizeOneLine(result.value);
        if (!edited) {
            if (!currentTranslation) {
                return;
            }
            if (!confirm(
                window,
                "清除标题译文",
                "输入内容为空。是否清除该条目的现有标题译文？",
                "清除"
            )) {
                return;
            }
            item.setField(
                "extra",
                ZoteroTitleTranslatorCore.clearTranslation(oldExtra)
            );
            await item.saveTx();
            Zotero.ItemTreeManager.refreshColumns();
            showSilentNotification(
                window,
                "标题译文已清除",
                [originalTitle || "所选条目"]
            );
            return;
        }

        item.setField(
            "extra",
            ZoteroTitleTranslatorCore.writeTranslation(
                oldExtra,
                edited
            )
        );
        await item.saveTx();
        Zotero.ItemTreeManager.refreshColumns();
        showSilentNotification(
            window,
            "标题译文已更新",
            [edited]
        );
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
                        const window =
                            context.menuElem?.ownerGlobal
                            || event.currentTarget?.ownerGlobal
                            || Zotero.getMainWindow();
                        const scope = scopeFromRows(window, rows);

                        context.setVisible(Boolean(scope));
                        if (!scope) return;

                        context.setEnabled(
                            !busy && scopeIsEditable(scope)
                        );
                        context.menuElem?.setAttribute(
                            "label",
                            scopeMenuLabel(scope, busy)
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
                        const window =
                            context.menuElem?.ownerGlobal
                            || event.currentTarget?.ownerGlobal
                            || Zotero.getMainWindow();
                        const scope = scopeFromRows(window, rows);

                        if (!scope) {
                            alert(
                                window,
                                "标题翻译",
                                "无法确定所选分类或文献库。"
                            );
                            return;
                        }
                        translateScope(window, scope).catch(logError);
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
                            selectedScopeContext(window);

                        context.setEnabled(
                            !busy
                            && Boolean(libraryContext)
                            && scopeIsEditable(libraryContext)
                        );
                        context.menuElem?.setAttribute(
                            "label",
                            libraryContext?.type === "collection"
                                ? (
                                    busy
                                        ? "正在翻译当前分类标题…"
                                        : "翻译当前分类中的未翻译标题"
                                )
                                : (
                                    busy
                                        ? "正在翻译当前文献库标题…"
                                        : "翻译当前文献库中的未翻译标题"
                                )
                        );
                    },
                    onCommand(event, context) {
                        const window =
                            context.menuElem?.ownerGlobal
                            || event.currentTarget?.ownerGlobal
                            || Zotero.getMainWindow();
                        translateCurrentScope(window).catch(logError);
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
                "翻译此分类或文献库中的未翻译标题",
                () => translateCurrentScope(window).catch(logError),
                menuIconURI
            );
            collectionPopup.appendChild(fallbackLibraryNode);
        }

        if (toolsPopup) {
            fallbackToolsNode = createMenuItem(
                document,
                "ztt-translate-current-library-fallback",
                "翻译当前分类或文献库中的未翻译标题",
                () => translateCurrentScope(window).catch(logError),
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
        installPdf2zhBridgeHook();

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
        const editNode = createMenuItem(
            document,
            "ztt-edit-title-translation",
            "编辑标题译文…",
            () => editSelectedTranslation(window).catch(logError)
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
            editNode,
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
            editNode,
            clearNode,
            itemCommandNodes: [
                translateNode,
                forceNode,
                editNode,
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
            state.editNode,
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
            scripts: [
                rootURI + "core.js",
                rootURI + "content/preferences.js"
            ],
            rawLabel: "标题翻译"
        });

        registerOfficialMenus();
        registerAutomaticTranslationObserver();
        schedulePdf2zhBridgeHook().catch(logError);

        log(
            `插件已启动；column=${registeredColumnKey}; `
            + `preferencePane=${preferencePaneID}; `
            + `menus=${registeredMenuIDs.join(",")}`
        );
    }

    async function shutdown() {
        pluginActive = false;
        autoTranslateScheduleGeneration++;
        autoTranslatePendingIDs.clear();
        unregisterAutomaticTranslationObserver();
        pdf2zhHookRetryGeneration++;
        uninstallPdf2zhBridgeHook();

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
        editSelectedTranslation,
        translateScope,
        translateCurrentScope,
        clearSelected,
        syncPdf2zhGlossary,
        restorePdf2zhBridge,
        getPdf2zhBridgeStatus,
        installPdf2zhBridgeHook
    };
}
