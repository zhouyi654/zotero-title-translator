// 当前服务。
// 新安装默认使用 MyMemory；升级用户会在 bootstrap.js 中迁移旧配置。
pref("extensions.zotero.titleTranslator.provider", "mymemory");
pref("extensions.zotero.titleTranslator.migrationVersion", 0);

// 通用语言设置
pref("extensions.zotero.titleTranslator.sourceLanguageName", "English");
pref("extensions.zotero.titleTranslator.sourceLanguageCode", "en");

// 免费在线 / 自托管 / 本地
pref("extensions.zotero.titleTranslator.myMemoryEmail", "");
pref("extensions.zotero.titleTranslator.libreTranslateURL", "http://localhost:5000");
pref("extensions.zotero.titleTranslator.libreTranslateAPIKey", "");
pref("extensions.zotero.titleTranslator.ollamaURL", "http://localhost:11434");
pref("extensions.zotero.titleTranslator.ollamaModel", "translategemma:4b");

// 传统机器翻译 API
pref("extensions.zotero.titleTranslator.googleApiKey", "");

pref("extensions.zotero.titleTranslator.deeplApiKey", "");
pref("extensions.zotero.titleTranslator.deeplPlan", "free");

pref("extensions.zotero.titleTranslator.microsoftApiKey", "");
pref("extensions.zotero.titleTranslator.microsoftRegion", "");
pref("extensions.zotero.titleTranslator.microsoftEndpoint", "https://api.cognitive.microsofttranslator.com");

// 大模型平台
pref("extensions.zotero.titleTranslator.qwenApiKey", "");
pref("extensions.zotero.titleTranslator.qwenModel", "qwen-mt-plus");
pref("extensions.zotero.titleTranslator.qwenBaseURL", "https://dashscope.aliyuncs.com/compatible-mode");

pref("extensions.zotero.titleTranslator.siliconflowApiKey", "");
pref("extensions.zotero.titleTranslator.siliconflowModel", "Qwen/Qwen3-8B");
pref("extensions.zotero.titleTranslator.siliconflowBaseURL", "https://api.siliconflow.cn/v1");

pref("extensions.zotero.titleTranslator.volcengineApiKey", "");
pref("extensions.zotero.titleTranslator.volcengineModel", "");
pref("extensions.zotero.titleTranslator.volcengineBaseURL", "https://ark.cn-beijing.volces.com/api/v3");

pref("extensions.zotero.titleTranslator.deepseekApiKey", "");
pref("extensions.zotero.titleTranslator.deepseekModel", "deepseek-v4-flash");
pref("extensions.zotero.titleTranslator.deepseekBaseURL", "https://api.deepseek.com");

pref("extensions.zotero.titleTranslator.geminiApiKey", "");
pref("extensions.zotero.titleTranslator.geminiModel", "gemini-3.5-flash");
pref("extensions.zotero.titleTranslator.geminiBaseURL", "https://generativelanguage.googleapis.com/v1beta");

pref("extensions.zotero.titleTranslator.openaiApiKey", "");
pref("extensions.zotero.titleTranslator.openaiModel", "");
pref("extensions.zotero.titleTranslator.openaiBaseURL", "https://api.openai.com/v1");

pref("extensions.zotero.titleTranslator.customApiKey", "");
pref("extensions.zotero.titleTranslator.customModel", "");
pref("extensions.zotero.titleTranslator.customBaseURL", "");

// 0.2 及更早版本的兼容字段，仅用于迁移
pref("extensions.zotero.titleTranslator.apiBaseURL", "https://dashscope.aliyuncs.com/compatible-mode/v1");
pref("extensions.zotero.titleTranslator.apiKey", "");
pref("extensions.zotero.titleTranslator.model", "qwen-mt-plus");
pref("extensions.zotero.titleTranslator.targetLanguage", "Chinese");

// 自动翻译新导入条目。默认关闭，避免未经确认产生远程调用或费用。
pref("extensions.zotero.titleTranslator.autoTranslateOnAdd", false);
pref("extensions.zotero.titleTranslator.autoTranslateDelaySeconds", 3);

// 完成通知：使用无声的 Zotero.ProgressWindow，不使用系统 alert。
pref("extensions.zotero.titleTranslator.showCompletionNotification", true);
pref("extensions.zotero.titleTranslator.completionNotificationSeconds", 6);

// 批量处理
pref("extensions.zotero.titleTranslator.concurrency", 2);
pref("extensions.zotero.titleTranslator.timeoutMs", 60000);
pref("extensions.zotero.titleTranslator.skipChinese", true);
