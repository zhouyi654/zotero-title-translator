# Changelog

## 0.3.4

- 新增“导入文献后自动翻译标题”开关，默认关闭。
- 使用 Zotero Notifier 监听新增条目事件。
- 新增 1–30 秒的导入后等待时间，默认 3 秒。
- 短时间内新增的条目会合并成一个自动翻译批次。
- 自动翻译跳过中文、已有译题、空标题、附件、笔记和不可编辑条目。
- 自动翻译不显示确认框，仍遵守服务商并发、限流和重试规则。
- 插件关闭时注销 Notifier observer，并清除待处理队列。
- 增加自动翻译观察器、设置和生命周期测试。

## 0.3.3

- 修复右键分类时错误翻译整个文献库的问题。
- 分类右键现在只读取所选分类的直接子条目。
- 子分类不会被自动递归处理。
- 文献库根节点仍可翻译整个文献库。
- 右键菜单和工具菜单根据当前范围动态显示“分类”或“文献库”。
- 确认窗口明确显示实际处理范围和条目数量。
- 增加分类范围静态测试。

## 0.3.2

- Prepared the project for public GitHub release.
- Added a stable plugin ID and GitHub release update URL.
- Replaced placeholder author and `example.com` metadata.
- Added Qwen-MT pacing, HTTP 429 exponential retry and detailed HTTP errors.
- Added CI and tag-based release workflows.
- Added `PRIVACY.md`, `SECURITY.md`, `.gitignore` and release documentation.
- Rewrote the README for end users and contributors.
- Replaced the developer-only credential warning with user-facing security text.

## 0.3.1

- 移除翻译完成后的模态 `Services.prompt.alert`。
- 完成通知改为无声的 `Zotero.ProgressWindow`。
- 新增“翻译完成后显示提示”开关。
- 新增 2–30 秒的通知自动关闭时间。
- 关闭完成通知后，任务仍正常执行，仅不显示完成窗口。
- 配置错误和整库翻译前确认框继续保留。
- 完整批量结果写入 Zotero Debug/Error Log，不再显示超长完成弹窗。

## 0.3.0

- 修复文献库右键菜单未出现：
  - `register()` 改为 `registerMenu()`
  - `unregister()` 改为 `unregisterMenu()`
  - 放宽左侧树节点识别，不再只依赖 `row.isLibrary()`
- 新增工具菜单的整库翻译入口。
- 新增 Google Cloud Translation。
- 新增 DeepL API Free / Pro。
- 新增 Microsoft Translator。
- 新增 SiliconFlow 预设。
- 新增火山方舟预设。
- 新增 DeepSeek 预设。
- 新增 Gemini API。
- 独立拆分 Qwen-MT、OpenAI 和自定义兼容服务的配置。
- 增加 0.2 旧配置自动迁移。

## 0.2.0

- 新增服务选择器。
- 新增 MyMemory 免费在线翻译。
- 新增 LibreTranslate 自托管适配器。
- 新增 Ollama 本地适配器。
- 默认推荐 `translategemma:4b`。
- MyMemory 固定单并发并主动降速。
- Ollama 固定单并发，避免本地推理资源争用。
- 整库确认窗口显示当前服务和相应隐私、费用或配额提示。
- 升级用户若已配置原 API，自动保留 OpenAI-compatible 模式。

