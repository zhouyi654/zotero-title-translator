/* Preference-pane actions for terminology import/export. */
(function (root) {
    "use strict";

    const PREF_PREFIX =
        "extensions.zotero.titleTranslator.";
    const TERMINOLOGY_PREF =
        PREF_PREFIX + "terminologyEntries";
    const ENABLED_PREF =
        PREF_PREFIX + "terminologyEnabled";

    let initialized = false;
    let observer = null;

    function element(id) {
        return document.getElementById(id);
    }

    function fileName(path) {
        return String(path ?? "")
            .split(/[\\/]/)
            .pop() || String(path ?? "");
    }

    function extension(path) {
        const match = String(path ?? "")
            .toLocaleLowerCase()
            .match(/\.([a-z0-9]+)$/);
        return match ? match[1] : "";
    }

    function updateBoundField(id, value) {
        const field = element(id);
        if (!field) {
            return;
        }
        field.value = value;
        field.dispatchEvent(new Event(
            "input",
            { bubbles: true }
        ));
        field.dispatchEvent(new Event(
            "change",
            { bubbles: true }
        ));
    }

    function saveTerminologyText(value) {
        Zotero.Prefs.set(
            TERMINOLOGY_PREF,
            String(value ?? ""),
            true
        );
        updateBoundField(
            "ztt-terminology-entries",
            String(value ?? "")
        );
    }

    function enableTerminology() {
        Zotero.Prefs.set(ENABLED_PREF, true, true);
        const checkbox = element(
            "ztt-terminology-enabled"
        );
        if (checkbox) {
            checkbox.checked = true;
            checkbox.dispatchEvent(new Event(
                "change",
                { bubbles: true }
            ));
        }
    }

    function setStatus(message, isError = false) {
        const status = element(
            "ztt-terminology-import-status"
        );
        if (!status) {
            return;
        }
        status.textContent = String(message ?? "");
        status.dataset.error = isError ? "true" : "false";
    }

    function alertUser(title, message) {
        Services.prompt.alert(
            window,
            title,
            String(message ?? "")
        );
    }

    async function selectImportFiles() {
        const { FilePicker } =
            ChromeUtils.importESModule(
                "chrome://zotero/content/modules/"
                + "filePicker.mjs"
            );
        const picker = new FilePicker();
        picker.init(
            window,
            "导入术语集合",
            picker.modeOpenMultiple
        );
        picker.appendFilter(
            "术语文件（TXT、CSV、TSV、JSON）",
            "*.txt; *.terms; *.glossary; "
            + "*.csv; *.tsv; *.json"
        );
        picker.appendFilters(picker.filterAll);

        const result = await picker.show();
        if (result !== picker.returnOK) {
            return [];
        }
        return picker.files || [];
    }

    function chooseImportMode(
        fileCount,
        importedCount,
        duplicateCount,
        failedFiles
    ) {
        const ps = Services.prompt;
        const flags =
            ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING
            + ps.BUTTON_POS_1 * ps.BUTTON_TITLE_IS_STRING
            + ps.BUTTON_POS_2 * ps.BUTTON_TITLE_CANCEL;

        const failedText = failedFiles.length
            ? (
                "\n\n以下文件未导入：\n"
                + failedFiles.map(
                    value => `- ${value}`
                ).join("\n")
            )
            : "";

        return ps.confirmEx(
            window,
            "导入术语集合",
            `已读取 ${fileCount} 个文件，识别到 `
            + `${importedCount} 条有效术语。\n`
            + `其中 ${duplicateCount} 条与当前术语表`
            + `使用相同源术语。\n\n`
            + "“合并导入”会保留现有术语；"
            + "同源术语以导入文件中的规则为准。\n"
            + "“替换全部”会清空当前术语表后导入。"
            + failedText,
            flags,
            "合并导入",
            "替换全部",
            null,
            null,
            {}
        );
    }

    async function importTerminologyFiles() {
        setStatus("正在选择术语文件…");

        try {
            const paths = await selectImportFiles();
            if (!paths.length) {
                setStatus("");
                return;
            }

            const core = root.ZoteroTitleTranslatorCore;
            if (!core) {
                throw new Error("术语解析组件未加载。");
            }

            let importedEntries = [];
            const failedFiles = [];
            let validFileCount = 0;

            for (const path of paths) {
                try {
                    const content =
                        await Zotero.File.getContentsAsync(
                            path
                        );
                    const entries =
                        core.parseTerminologyDocument(
                            content,
                            path
                        );
                    if (!entries.length) {
                        throw new Error("没有识别到有效术语");
                    }
                    importedEntries =
                        core.mergeTerminologyEntries(
                            importedEntries,
                            entries
                        );
                    validFileCount++;
                }
                catch (error) {
                    failedFiles.push(
                        `${fileName(path)}：`
                        + `${error?.message || error}`
                    );
                }
            }

            if (!importedEntries.length) {
                throw new Error(
                    "所选文件中没有可导入的有效术语。\n"
                    + failedFiles.join("\n")
                );
            }

            const currentText = String(
                Zotero.Prefs.get(
                    TERMINOLOGY_PREF,
                    true
                ) ?? ""
            );
            const currentEntries =
                core.parseTerminology(currentText);
            const currentKeys = new Set(
                currentEntries.map(
                    entry => entry.source
                        .toLocaleLowerCase()
                )
            );
            const duplicateCount =
                importedEntries.filter(
                    entry => currentKeys.has(
                        entry.source.toLocaleLowerCase()
                    )
                ).length;

            const choice = chooseImportMode(
                validFileCount,
                importedEntries.length,
                duplicateCount,
                failedFiles
            );
            if (choice === 2) {
                setStatus("已取消导入。");
                return;
            }

            const finalEntries = choice === 1
                ? importedEntries
                : core.mergeTerminologyEntries(
                    currentEntries,
                    importedEntries
                );
            const finalText =
                core.formatTerminology(finalEntries);

            saveTerminologyText(finalText);
            enableTerminology();

            const action = choice === 1
                ? "替换"
                : "合并";
            const message =
                `已${action}导入 `
                + `${importedEntries.length} 条术语；`
                + `当前术语表共 ${finalEntries.length} 条。`;
            setStatus(message);
            alertUser("术语集合导入完成", message);
        }
        catch (error) {
            const message =
                error?.message || String(error);
            setStatus(message, true);
            alertUser("术语集合导入失败", message);
        }
    }

    async function selectExportPath(
        title,
        defaultString,
        defaultExtension
    ) {
        const { FilePicker } =
            ChromeUtils.importESModule(
                "chrome://zotero/content/modules/"
                + "filePicker.mjs"
            );
        const picker = new FilePicker();
        picker.init(window, title, picker.modeSave);
        picker.defaultString = defaultString;
        picker.defaultExtension = defaultExtension;
        picker.appendFilter(
            "文本术语表",
            "*.txt; *.terms; *.glossary"
        );
        picker.appendFilter("CSV", "*.csv");
        picker.appendFilter("TSV", "*.tsv");
        picker.appendFilter("JSON", "*.json");
        picker.appendFilters(picker.filterAll);

        const result = await picker.show();
        if (
            result !== picker.returnOK
            && result !== picker.returnReplace
        ) {
            return "";
        }
        return picker.file || "";
    }

    async function exportTerminologyFile() {
        try {
            const core = root.ZoteroTitleTranslatorCore;
            const entries = core.parseTerminology(
                Zotero.Prefs.get(
                    TERMINOLOGY_PREF,
                    true
                ) ?? ""
            );
            if (!entries.length) {
                throw new Error("当前术语表为空。");
            }

            let path = await selectExportPath(
                "导出当前术语表",
                "zotero-title-terminology.txt",
                "txt"
            );
            if (!path) {
                return;
            }

            let format = extension(path);
            if (![
                "txt",
                "terms",
                "glossary",
                "csv",
                "tsv",
                "json"
            ].includes(format)) {
                path += ".txt";
                format = "txt";
            }

            const content =
                core.exportTerminologyDocument(
                    entries,
                    format
                );
            await Zotero.File.putContentsAsync(
                path,
                content
            );

            const message =
                `已导出 ${entries.length} 条术语到 `
                + `${fileName(path)}。`;
            setStatus(message);
            alertUser("术语表导出完成", message);
        }
        catch (error) {
            const message =
                error?.message || String(error);
            setStatus(message, true);
            alertUser("术语表导出失败", message);
        }
    }

    async function saveCSVTemplate() {
        try {
            let path = await selectExportPath(
                "保存术语 CSV 模板",
                "terminology-template.csv",
                "csv"
            );
            if (!path) {
                return;
            }
            if (extension(path) !== "csv") {
                path += ".csv";
            }

            const template = [
                "source,target,aliases",
                '"case-control study",病例对照研究,'
                + '"病例控制研究 | 个案对照研究"',
                "cholera,霍乱,",
                '"airway organoid",气道类器官,'
            ].join("\n") + "\n";

            await Zotero.File.putContentsAsync(
                path,
                template
            );
            const message =
                `CSV 模板已保存到 ${fileName(path)}。`;
            setStatus(message);
            alertUser("模板已保存", message);
        }
        catch (error) {
            const message =
                error?.message || String(error);
            setStatus(message, true);
            alertUser("保存模板失败", message);
        }
    }


    function bridgeAPI() {
        const api = Zotero.ZoteroTitleTranslator;
        if (!api) {
            throw new Error(
                "标题翻译插件桥接接口尚未加载。"
            );
        }
        return api;
    }

    function setBridgeStatus(message, isError = false) {
        const status = element("ztt-pdf2zh-bridge-status");
        if (!status) {
            return;
        }
        status.textContent = String(message ?? "");
        status.dataset.error = isError ? "true" : "false";
    }

    async function selectPdf2zhServerFolder() {
        try {
            const { FilePicker } =
                ChromeUtils.importESModule(
                    "chrome://zotero/content/modules/"
                    + "filePicker.mjs"
                );
            const picker = new FilePicker();
            picker.init(
                window,
                "选择 PDF2zh Server 文件夹",
                picker.modeGetFolder
            );
            const result = await picker.show();
            if (result !== picker.returnOK) {
                return;
            }
            const path = picker.file || "";
            if (!path) {
                return;
            }
            Zotero.Prefs.set(
                PREF_PREFIX + "pdf2zhServerPath",
                path,
                true
            );
            updateBoundField(
                "ztt-pdf2zh-server-path",
                path
            );
            await refreshPdf2zhBridgeStatus();
        }
        catch (error) {
            const message = error?.message || String(error);
            setBridgeStatus(message, true);
            alertUser("选择 PDF2zh 文件夹失败", message);
        }
    }

    async function refreshPdf2zhBridgeStatus() {
        try {
            const api = bridgeAPI();
            api.installPdf2zhBridgeHook();
            const status = await api.getPdf2zhBridgeStatus();
            const lines = [
                `桥接开关：${status.enabled ? "已开启" : "已关闭"}`,
                `PDF2zh 插件：${status.pdf2zhDetected ? "已检测到" : "未检测到"}`,
                `翻译入口：${status.hookInstalled ? "已接管同步前置步骤" : "尚未安装桥接"}`,
                `当前引擎：${status.engine}`,
                `可用术语：${status.terminologyCount} 条`
            ];
            if (status.configPath) {
                lines.push(`配置文件：${status.configPath}`);
                lines.push(
                    `server.py：${status.serverScriptFound ? "已找到" : "未确认"}`
                );
                lines.push(
                    `术语 CSV：${status.glossaryFileExists ? "已生成" : "未生成"}`
                );
                lines.push(
                    `配置引用术语：${status.verification?.glossaryConfigured ? "是" : "否"}`
                );
                lines.push(
                    `忽略旧缓存：${status.verification?.ignoreCache ? "已启用" : "未启用"}`
                );
                lines.push(
                    `自动术语提取：${status.verification?.noAutoExtractGlossary ? "已关闭" : "仍启用"}`
                );
                if (status.lastSyncedAt) {
                    lines.push(
                        `最近同步：${status.lastSyncedAt}`
                    );
                }
            }
            if (status.error) {
                lines.push(`配置检查：${status.error}`);
            }
            setBridgeStatus(
                lines.join("\n"),
                Boolean(status.error)
            );
            return status;
        }
        catch (error) {
            const message = error?.message || String(error);
            setBridgeStatus(message, true);
            return null;
        }
    }

    async function syncPdf2zhGlossary() {
        try {
            setBridgeStatus("正在同步 PDF2zh 术语…");
            const result = await bridgeAPI()
                .syncPdf2zhGlossary({ interactive: true });
            const message =
                `已同步 ${result.termCount} 条术语。\n`
                + `术语文件：${result.glossaryPath}\n`
                + `配置文件：${result.configPath}\n`
                + `配置引用术语：${result.verification?.glossaryConfigured ? "是" : "否"}\n`
                + `忽略旧缓存：${result.verification?.ignoreCache ? "已启用" : "未启用"}`;
            setBridgeStatus(message);
            alertUser("PDF2zh 术语同步完成", message);
        }
        catch (error) {
            const message = error?.message || String(error);
            setBridgeStatus(message, true);
            alertUser("PDF2zh 术语同步失败", message);
        }
    }

    async function restorePdf2zhConfig() {
        const accepted = Services.prompt.confirm(
            window,
            "恢复 PDF2zh 配置",
            "将移除本插件生成的术语路径和状态文件，"
            + "并恢复首次桥接前记录的相关配置。继续吗？"
        );
        if (!accepted) {
            return;
        }

        try {
            const result = await bridgeAPI()
                .restorePdf2zhBridge();
            const message =
                `已恢复配置：${result.configPath}`;
            setBridgeStatus(message);
            alertUser("PDF2zh 配置已恢复", message);
        }
        catch (error) {
            const message = error?.message || String(error);
            setBridgeStatus(message, true);
            alertUser("恢复 PDF2zh 配置失败", message);
        }
    }

    function bindButton(id, listener) {
        const button = element(id);
        if (!button || button.dataset.zttBound === "true") {
            return false;
        }
        button.dataset.zttBound = "true";
        button.addEventListener("click", listener);
        return true;
    }

    function init() {
        const found = [
            bindButton(
                "ztt-import-terminology",
                () => importTerminologyFiles()
            ),
            bindButton(
                "ztt-export-terminology",
                () => exportTerminologyFile()
            ),
            bindButton(
                "ztt-save-terminology-template",
                () => saveCSVTemplate()
            ),
            bindButton(
                "ztt-select-pdf2zh-server",
                () => selectPdf2zhServerFolder()
            ),
            bindButton(
                "ztt-detect-pdf2zh-bridge",
                () => refreshPdf2zhBridgeStatus()
            ),
            bindButton(
                "ztt-sync-pdf2zh-glossary",
                () => syncPdf2zhGlossary()
            ),
            bindButton(
                "ztt-restore-pdf2zh-config",
                () => restorePdf2zhConfig()
            )
        ].some(Boolean);

        if (found || element("ztt-import-terminology")) {
            initialized = true;
            observer?.disconnect();
            observer = null;
            if (element("ztt-pdf2zh-bridge-status")) {
                refreshPdf2zhBridgeStatus();
            }
        }
    }

    root.ZoteroTitleTranslatorPreferences = {
        init,
        importTerminologyFiles,
        exportTerminologyFile,
        saveCSVTemplate,
        selectPdf2zhServerFolder,
        refreshPdf2zhBridgeStatus,
        syncPdf2zhGlossary,
        restorePdf2zhConfig
    };

    if (document.documentElement) {
        observer = new MutationObserver(init);
        observer.observe(
            document.documentElement,
            {
                childList: true,
                subtree: true
            }
        );
    }

    setTimeout(init, 0);
})(window);
