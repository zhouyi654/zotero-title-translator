# Zotero 标题翻译

[English](README_EN.md) | 中文

[![CI](https://github.com/zhouyi654/zotero-title-translator/actions/workflows/ci.yml/badge.svg)](https://github.com/zhouyi654/zotero-title-translator/actions/workflows/ci.yml)
[![GitHub Release](https://img.shields.io/github/v/release/zhouyi654/zotero-title-translator)](https://github.com/zhouyi654/zotero-title-translator/releases)
[![许可证：MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

一个面向 **Zotero 9** 的开源标题与摘要翻译插件。插件不会覆盖文献的原始标题或摘要，而是在条目列表和信息侧边栏中显示独立的中文译文。

**兼容范围：Zotero 9.0.x。** 插件清单使用 `strict_max_version: 9.0.*`，只声明已经测试过的 minor 版本；后续 Zotero 9.x minor 版本应在实际测试后再更新兼容范围。

**安装入口：** [GitHub Releases](https://github.com/zhouyi654/zotero-title-translator/releases) → 下载最新的 `zotero-title-translator-<version>.xpi`。

- 中文文献：直接显示原始中文标题；
- 外文文献：翻译后显示中文译题；
- 标题译文同步到信息侧边栏的“标题翻译”字段；
- 支持翻译摘要并同步到“摘要翻译”字段；
- 原始 `title` 字段保持不变；
- 支持单篇、多篇、所选分类和整个文献库翻译；
- 支持导入文献后自动翻译，可由用户自行开启或关闭；
- 支持右键手动修改单条译题；
- 支持可开关的专业术语表和常见误译校正；
- 支持在线 API、本地模型和自托管翻译服务；
- 译题保存在 Zotero 条目的 `Extra` 字段中，可随条目同步。

> 当前版本：**0.3.11**。项目仍处于早期公开阶段。建议先用少量文献测试服务配置，再执行分类或整库翻译。

---

## 目录

- [主要功能](#主要功能)
- [安装方法](#安装方法)
- [首次配置](#首次配置)
- [显示“标题（中文）”列](#显示标题中文列)
- [翻译所选条目](#翻译所选条目)
- [按所选分类翻译](#按所选分类翻译)
- [翻译整个文献库](#翻译整个文献库)
- [导入后自动翻译](#导入后自动翻译)
- [手动修改译题](#手动修改译题)
- [侧边栏同步与摘要翻译](#侧边栏同步与摘要翻译)
- [术语表与译后校正](#术语表与译后校正)
- [支持的翻译服务](#支持的翻译服务)
- [翻译服务配置示例](#翻译服务配置示例)
- [批量翻译、限流与重试](#批量翻译限流与重试)
- [译题保存方式](#译题保存方式)
- [完成通知](#完成通知)
- [隐私与 API Key](#隐私与-api-key)
- [常见问题](#常见问题)
- [开发与构建](#开发与构建)
- [发布到 GitHub](#发布到-github)
- [贡献](#贡献)
- [许可证](#许可证)

---

## 主要功能

### 1. “标题（中文）”自定义列

该列按照以下优先级显示：

1. 条目已保存中文译题：显示已保存译题；
2. 没有保存译题，但原标题主要为中文：直接显示原标题；
3. 原标题为非中文且尚未翻译：该列暂时留空。

中文原标题不调用翻译接口，也不会在 `Extra` 中重复保存一份。

### 2. 翻译所选条目

选择一个或多个普通文献条目后，右键可执行：

- **翻译标题（跳过已有译题）**
- **重新翻译标题（覆盖已有译题）**
- **清除标题译文**

默认跳过：

- 已有译题；
- 中文原标题；
- 空标题；
- 附件；
- 笔记；
- 批注；
- 已删除条目；
- 不可编辑条目。

### 3. 按所选分类翻译

右键 Zotero 左侧的实际分类，例如“霍乱”“书籍”或“每日文献阅读”，选择：

```text
翻译此分类中的未翻译标题
```

只处理该分类**直接包含**的普通文献。

- 不自动递归翻译子分类；
- 不会误扫整个“我的文库”；
- 同一条文献若同时属于多个分类，只保存一份译题；
- 译题保存后，该条目在其他分类中也会显示相同中文标题。

### 4. 翻译整个文献库

右键“我的文库”或群组文库根节点，选择：

```text
翻译整个文献库中的未翻译标题
```

也可使用顶部工具菜单。插件会根据当前选中节点，动态显示“当前分类”或“当前文献库”的翻译入口。

### 5. 导入后自动翻译

设置页面提供：

```text
导入文献后自动翻译标题
```

该功能默认关闭。启用后，插件会监听 Zotero 新增条目事件，将短时间内导入的文献合并成一个队列，并在等待元数据写入完成后自动翻译。

常见触发场景：

- Zotero Connector 保存网页文献；
- 导入 RIS、BibTeX、CSL JSON；
- 通过 DOI、PMID、ISBN 添加条目；
- PDF 元数据识别后创建父级文献；
- 从其他设备同步到本机的新文献；
- 其他会创建普通文献条目的操作。

自动翻译仍会跳过中文、已有译题、空标题、附件、笔记、批注和不可编辑条目。

### 6. 多服务商支持

支持传统机器翻译、大模型平台、本地模型和自托管服务。用户只需配置实际使用的一个服务。

### 7. 批量保护

- 单条失败不会终止整个任务；
- 成功译题立即保存；
- 再次运行会跳过已成功条目；
- 可配置并发数和超时时间；
- Qwen-MT 内置请求节流和 HTTP 429 重试；
- MyMemory、Ollama、Qwen-MT 使用保守并发；
- 整库和分类翻译前显示实际请求数量。

### 8. 可关闭的无声完成通知

翻译结束后默认显示 Zotero 右下角的无声通知，不使用会触发系统提示音的大型模态弹窗。

可在设置中关闭完成提示，或调整自动关闭时间。

---

## 安装方法

### 从 GitHub Releases 安装

1. 打开项目的 [Releases 页面](https://github.com/zhouyi654/zotero-title-translator/releases)；
2. 下载最新的：

   ```text
   zotero-title-translator-版本号.xpi
   ```

3. 打开 Zotero；
4. 进入 **工具 → 插件**；
5. 点击右上角齿轮；
6. 选择 **Install Add-on From File… / 从文件安装插件**；
7. 选择下载的 `.xpi`；
8. 按提示重启 Zotero。

不要把“Source code (zip)”当作插件安装包。Zotero 应安装 `.xpi` 文件。

### 从源码构建

```bash
git clone https://github.com/zhouyi654/zotero-title-translator.git
cd zotero-title-translator
python build_xpi.py --check
```

生成文件：

```text
dist/zotero-title-translator-0.3.11.xpi
```

---

## 首次配置

1. 打开 Zotero 设置；
2. 进入 **标题翻译**；
3. 在“当前服务”中选择翻译服务；
4. 填写该服务所需的地址、API Key 和模型；
5. 先选择一篇外文文献测试；
6. 确认译题能写入“标题（中文）”列；
7. 再使用多篇、分类、整库或自动翻译。

建议：

- 首次将并发数设为 `1`；
- 使用低权限、可撤销、设置额度上限的 API Key；
- 不要一开始就翻译数千篇文献；
- 远程服务先确认价格、免费额度和限流规则。

---

## 显示“标题（中文）”列

安装后若看不到新列：

1. 在 Zotero 条目列表的表头上右键；
2. 勾选 **标题（中文）**；
3. 拖动调整列宽；
4. 点击列名可以排序。

---

## 翻译所选条目

### 普通翻译

1. 选中一个或多个文献条目；
2. 右键；
3. 选择 **翻译标题（跳过已有译题）**。

该操作不会覆盖已经保存的译题。

### 强制重新翻译

当现有译题不准确时：

1. 选中条目；
2. 右键；
3. 选择 **重新翻译标题（覆盖已有译题）**。

该操作只替换插件保存的译题，不修改原始 `title`。

### 清除译题

1. 选中条目；
2. 右键；
3. 选择 **清除标题译文**。

插件只删除：

```text
titleTranslation: ...
```

不会删除 `Extra` 中的 DOI、PMID、Citation Key 或其他字段。

---

## 按所选分类翻译

0.3.3 起，分类右键不再扫描整个文献库。

处理规则：

- 右键实际分类：只处理该分类直接包含的普通文献；
- 不自动递归翻译子分类；
- 子分类需要分别右键执行；
- 分类中的附件、笔记和批注不会进入翻译队列；
- 开始前确认框会显示分类名称和实际条目数量。

示例：

```text
分类“霍乱”共有 50 个普通文献条目
仅处理该分类直接包含的条目
不会处理其子分类中的条目
```

---

## 翻译整个文献库

右键：

- “我的文库”；
- 群组文库根节点。

选择：

```text
翻译整个文献库中的未翻译标题
```

开始前会显示：

- 普通文献总数；
- 实际需要调用服务的数量；
- 已有译题数量；
- 中文原标题数量；
- 空标题数量；
- 当前服务；
- 费用、免费额度、配额或隐私提示。

---

## 导入后自动翻译

详细说明见 [`docs/AUTO_TRANSLATION.md`](docs/AUTO_TRANSLATION.md)。

### 开启方法

1. 打开 **Zotero 设置 → 标题翻译**；
2. 找到“自动翻译新导入文献”；
3. 勾选 **导入文献后自动翻译标题**；
4. 设置“导入后等待时间”，默认 3 秒。

### 为什么需要等待时间

导入文献时，Zotero 可能先创建条目，再补充标题等元数据。等待时间用于减少“条目已创建但标题尚未写入”的情况。

连续导入多个条目时，插件会重新计算等待时间并合并处理，避免每篇文献分别启动一次任务。

### 自动翻译不会做什么

- 不会扫描开启前已经存在的条目；
- 不会自动递归遍历现有文献库；
- 不会弹出分类或整库确认框；
- 不会阻止 Zotero 完成导入；
- 不会翻译附件、笔记和批注；
- 不会覆盖已有译题。

### 费用注意

自动翻译不会逐批询问费用确认。使用远程 API 前，应确认服务配置、账户余额、免费额度和限流规则。

---


## 手动修改译题

当自动翻译结果不准确时，只选择一个普通文献条目并右键：

```text
编辑标题译文…
```

对话框会预填当前译题。修改后保存即可；输入留空并确认可清除译题。
该操作不会修改原始标题，也不会破坏 `Extra` 中的其他字段。

## 侧边栏同步与摘要翻译

### 标题翻译侧边栏同步

0.3.10 起，标题译文保存为：

```text
titleTranslation: 中文译题
```

该字段与 Translate for Zotero 在 Zotero 信息侧边栏中使用的“标题翻译”字段一致。
因此，无论译题是通过本插件生成，还是在侧边栏中手工修改，两处都会读取同一份数据。

升级时，插件会将旧字段：

```text
ZoteroTitleTranslation: 中文译题
```

迁移为新的 `titleTranslation` 字段。原始 `title` 字段不会改变。

### 摘要翻译

选择一个或多个普通文献条目后，右键可执行：

```text
翻译摘要（跳过已有译文）
重新翻译摘要（覆盖已有译文）
清除摘要译文
```

摘要译文保存为：

```text
abstractTranslation: 中文摘要译文
```

安装并启用 Translate for Zotero 的“摘要翻译”信息行后，译文会显示在 Zotero
信息侧边栏，并可在那里手工编辑。原始 `abstractNote` 字段保持不变。

摘要比标题长得多，远程 API 的 token 消耗、超时和费用也更高。建议先选择一篇文献测试。
MyMemory 等具有较低单次长度限制的服务不适合长摘要。

### 导入后自动翻译摘要

设置中新增“导入后同时自动翻译摘要”开关，默认关闭。它与标题自动翻译分开控制：

- 仅开启标题自动翻译：新导入文献只翻译标题；
- 仅开启摘要自动翻译：新导入文献只翻译已有的外文摘要；
- 两者都开启：依次翻译标题和摘要；
- 没有摘要、摘要已是中文或已有摘要译文时自动跳过。

## 术语表与译后校正

设置中新增“启用自定义术语表”开关，默认关闭。规则格式：

```text
cholera = 霍乱
case-control study = 病例对照研究 | 病例控制研究
```

`=>` 左侧是原标题中的源术语，右侧第一个值是标准译法；后续用 `|`
列出的内容是需要自动纠正的常见错误译法。只有原标题命中源术语时才应用规则。

大模型、Ollama 和 Qwen-MT 会收到命中的强制术语映射；所有服务在返回译文后
还会执行保守校正。完整说明见 [`docs/TERMINOLOGY.md`](docs/TERMINOLOGY.md)。

## 支持的翻译服务

### 无需商业 API 或可本地运行

- MyMemory；
- LibreTranslate；
- Ollama。

### 传统机器翻译 API

- Google Cloud Translation；
- DeepL API Free / Pro；
- Microsoft Translator。

### 大模型平台

- 阿里云百炼 Qwen-MT；
- SiliconFlow（硅基流动）；
- 火山方舟；
- DeepSeek；
- Google Gemini；
- OpenAI；
- 自定义 OpenAI-compatible API。

“免费”可能表示：

- 无需密钥的公共服务；
- 免费套餐；
- 每月免费额度；
- 注册赠送余额；
- 部分模型免费；
- 在本机运行，不产生云端调用费用。

不代表永久、无限、无需账户或无需结算。

详细比较见 [`docs/PROVIDERS.md`](docs/PROVIDERS.md)。

---

## 翻译服务配置示例

### MyMemory

- 无需 API Key；
- 适合少量英文标题；
- 默认源语言代码填 `en`；
- 公共服务存在长度、流量和每日配额限制；
- 不建议用于大型文献库。

### LibreTranslate

本地部署示例：

```bash
pip install libretranslate
libretranslate
```

插件配置：

```text
服务地址：http://localhost:5000
API Key：本机实例通常留空
```

### Ollama

推荐：

```bash
ollama run translategemma:4b
```

插件配置：

```text
Ollama 地址：http://localhost:11434
模型：translategemma:4b
```

### Qwen-MT

```text
Base URL：https://dashscope.aliyuncs.com/compatible-mode
模型：qwen-mt-plus
API Key：你的百炼 API Key
```

### SiliconFlow

```text
Base URL：https://api.siliconflow.cn/v1
模型：填写账户中可调用的模型 ID
API Key：你的 API Key
```

### 火山方舟

```text
Base URL：https://ark.cn-beijing.volces.com/api/v3
模型 / Endpoint ID：模型 ID 或 ep-... 推理接入点
API Key：你的 API Key
```

更多服务见 [`docs/PROVIDERS.md`](docs/PROVIDERS.md)。

---

## 批量翻译、限流与重试

### HTTP 429 是什么

通常表示：

- 每分钟请求次数超过上限；
- 突发请求过多；
- 每分钟 token 数超过限制；
- 账户共享配额用尽；
- 余额、赠送额度或资源配额不足。

### Qwen-MT 保护机制

插件对 Qwen-MT 默认使用：

- 单并发；
- 请求间隔约 1.2 秒；
- `X-DashScope-Wait-Timeout: 30`；
- HTTP 429 指数退避重试；
- 成功条目立即保存；
- 再次运行时跳过成功条目。

这些机制只能降低触发限流的概率，不能突破服务商的绝对配额。

---

## 译题保存方式

外文标题的译题保存在 Zotero 条目的 `Extra` 字段：

```text
titleTranslation: 中文译题
```

这样做的原因：

- 不覆盖原始标题；
- 不修改 Zotero 数据库结构；
- 不把完整译题污染为 Tag；
- 译题可随条目保存和同步；
- 卸载插件后译题仍然存在；
- 重新安装后可继续读取。

---

## 完成通知

在设置页面中可以配置：

- **翻译完成后显示提示**；
- **自动关闭时间（秒）**。

关闭后：

- 翻译仍正常执行；
- 译题仍会保存；
- 中文标题列仍会刷新；
- 任务完成时不显示通知。

配置错误和分类/整库翻译前确认框仍会保留。

---

## 隐私与 API Key

插件仅处理用户主动要求翻译的标题；当用户执行摘要翻译或开启摘要自动翻译时，也会处理对应摘要。待翻译的标题或摘要会发送给用户选择的翻译服务。

插件不会主动发送：

- PDF 文件；
- 作者信息；
- 笔记；
- 批注；
- 整个 Zotero 数据库；
- Zotero 账号密码。

本机 Ollama 和本机 LibreTranslate 可以让标题或摘要留在本机处理。使用远程服务时，待翻译的标题或摘要会发送给相应服务商。

API Key 当前保存在本机 Zotero 首选项中，没有由插件进行额外加密。它不会发送给本项目作者，但可访问本地 Zotero 配置的程序或人员可能读取密钥。

建议：

- 使用独立、低权限、可撤销的密钥；
- 设置费用上限；
- 不在公共或多人共用电脑中保存高权限密钥；
- 不要把 API Key、未脱敏日志或 Zotero profile 提交到 GitHub。

详细说明：

- [`PRIVACY.md`](PRIVACY.md)
- [`SECURITY.md`](SECURITY.md)

---

## 常见问题

### 安装时提示不兼容

确认：

- Zotero 为 9.0.x；
- 安装的是 `.xpi`，不是源码 ZIP；
- 浏览器没有把 XPI 改名为 ZIP；
- 旧测试版已卸载。

### 看不到中文标题列

右键条目列表表头，勾选“标题（中文）”。

### 分类右键为什么处理整个文献库

0.3.2 及更早版本存在该问题。升级到 0.3.3 或更高版本。

### 自动翻译没有执行

检查：

1. 自动翻译开关是否开启；
2. 当前翻译服务配置是否完整；
3. 导入的是普通文献还是单独附件；
4. 标题是否已经是中文；
5. 是否已有译题；
6. Zotero 是否仍在写入元数据；
7. Debug Log 中是否存在 API 错误。

### 翻译失败后会全部重来吗

不会。成功译题已经保存。再次运行默认跳过已有译题。

### 为什么不覆盖原标题

原始标题会影响引用、去重、检索、导出、元数据更新和外部数据库匹配，因此插件始终保留原标题。

更多问题见 [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md)。

---

## 开发与构建

### 环境

- Node.js 20 或更高；
- Python 3.10 或更高；
- Zotero 9 测试环境。

### 测试

```bash
npm test
```

### 构建与发布校验

```bash
npm run release:check
npm run build
npm run release:manifest
npm run release:verify
```

输出：

```text
dist/zotero-title-translator-0.3.11.xpi
dist/updates.json
```

如果仓库尚未安装 GitHub Actions 工作流，可运行一次：

```bash
npm run workflows:install
```

该命令会从 `scripts/workflow_templates/` 安装 `.github/workflows/ci.yml` 和 `.github/workflows/release.yml`。

测试覆盖：

- JavaScript 语法；
- `Extra` 译题读写；
- 中文标题识别；
- 服务商请求构造和响应解析；
- 分类范围识别；
- 菜单注册；
- 完成通知；
- Qwen-MT 限流与重试；
- 自动翻译 Notifier 观察器；
- 插件关闭时的队列清理；
- 发布元数据。

---

## 发布到 GitHub

本压缩包中的文件已经位于项目根目录。不要再把外层文件夹整体套入仓库。

正确的 GitHub 仓库根目录应直接包含：

```text
.github/
content/
docs/
icons/
scripts/
tests/
README.md
README_EN.md
manifest.json
package.json
bootstrap.js
core.js
prefs.js
```

详细步骤见 [`docs/GITHUB_UPLOAD.md`](docs/GITHUB_UPLOAD.md) 和 [`docs/RELEASING.md`](docs/RELEASING.md)。

---

## 贡献

欢迎提交：

- Bug 修复；
- Zotero 9 兼容性改进；
- 翻译服务适配；
- 限流和重试改进；
- 自动翻译优化；
- 测试；
- 中文文档；
- 隐私和安全改进。

贡献要求见 [`CONTRIBUTING.md`](CONTRIBUTING.md)。

---

## 许可证

本项目使用 [MIT License](LICENSE)。


## 0.3.6：导入外部术语集合

设置页面新增三个操作：

```text
导入一个或多个术语文件…
导出当前术语表…
保存 CSV 模板…
```

### 手动规则格式

0.3.6 起推荐使用单个等号：

```text
源术语 = 标准译法
```

例如：

```text
cholera = 霍乱
case-control study = 病例对照研究 | 病例控制研究 | 个案对照研究
airway organoid = 气道类器官
```

旧版 `=>` 仍可读取，升级时会尽量转换为 `=`；之后保存、导入和导出统一使用 `=`。

### 支持的导入格式

- `.txt`、`.terms`、`.glossary`：每行一条 `源术语 = 标准译法`；
- `.csv`：逗号分隔；
- `.tsv`：制表符分隔；
- `.json`：对象映射或术语对象数组。

CSV/TSV 推荐表头：

```text
source,target,aliases
```

其中 `aliases` 用 `|` 分隔需要纠正的旧译法。没有表头时，插件按第一列为源术语、第二列为标准译法，其余列为旧译法。

Excel `.xlsx` 不能直接导入，请在 Excel 中另存为 **CSV UTF-8** 后导入。

### 多文件和重复规则

可一次选择多个术语文件。导入时可选择：

- **合并导入**：保留当前术语表；
- **替换全部**：清空当前术语表后导入。

同一源术语重复出现时，后导入的规则覆盖较早规则。导入成功后术语表开关会自动开启。

详细格式见 [`docs/TERMINOLOGY_IMPORT.md`](docs/TERMINOLOGY_IMPORT.md)。


## PDF2zh Next 术语桥接

0.3.8 可以在不修改 PDF2zh 插件文件的前提下，把本插件的术语表用于 PDF 全文翻译。

启用后，本插件在运行时包装 PDF2zh 的“翻译 PDF”入口。每次开始全文翻译前：

1. 将当前启用的标题术语表导出为 `source,target,tgt_lng` CSV；
2. 写入 PDF2zh Server 的 `config` 文件夹；
3. 更新 `config/config.toml` 的 `[translation].glossaries`；
4. 再调用 PDF2zh 原来的翻译函数。

PDF2zh 的 XPI、右键菜单、服务端源码和翻译结果处理均不被替换。首次同步会创建配置备份与桥接状态文件，并提供恢复按钮。

当前只支持 `pdf2zh_next`。同步失败时 PDF2zh 仍会按原配置继续翻译。

完整说明见 [`docs/PDF2ZH_BRIDGE.md`](docs/PDF2ZH_BRIDGE.md)，技术设计见 [`docs/PDF2ZH_BRIDGE_DESIGN.md`](docs/PDF2ZH_BRIDGE_DESIGN.md)。


## 0.3.8：PDF2zh 桥接缓存修复与运行时验证

0.3.7 只同步术语 CSV 和 `glossaries` 配置。PDF2zh Next/BabelDOC 默认可能复用
旧的翻译缓存，因此重新翻译同一篇 PDF 时，可能继续得到术语表启用前的错误译文。

0.3.8 新增：

- “强制忽略旧翻译缓存”开关，默认开启；
- 翻译前无声桥接回执；
- 写入后重新读取 `config.toml`，确认术语路径确实生效；
- 检查术语 CSV 是否真实存在；
- 状态区显示术语文件、配置引用、缓存和自动术语提取状态；
- 恢复桥接时同时恢复原来的 `ignore_cache` 设置。

验证固定术语时建议：

1. 开启 PDF2zh 术语桥接；
2. 关闭 PDF2zh 自动术语提取；
3. 开启强制忽略旧翻译缓存；
4. 点击“立即同步术语”；
5. 确认状态区显示“配置引用术语：是”和“忽略旧缓存：已启用”；
6. 再使用 PDF2zh 翻译。


## 0.3.10：侧边栏同步与摘要翻译

- 标题译文改用 `titleTranslation`，与 Translate for Zotero 的“标题翻译”侧边栏字段同步；
- 自动迁移旧版 `ZoteroTitleTranslation` 数据；
- 新增摘要翻译、重新翻译和清除命令；
- 摘要译文保存为 `abstractTranslation`，可显示在“摘要翻译”侧边栏字段；
- 新增“导入后同时自动翻译摘要”开关，默认关闭；
- 原始标题和原始摘要均保持不变。


## 0.3.10：侧边栏译文顺序

当 Translate for Zotero 同时启用“标题翻译”和“摘要翻译”信息行时，
插件会在运行时重新注册这两个信息行，使其都位于“信息”区域顶部，并按以下顺序显示：

```text
标题翻译
摘要翻译
标题
作者
……
```

该调整只改变当前 Zotero 会话中的信息行顺序，不修改 Translate for Zotero 的 XPI、源码或设置。
禁用本插件时会恢复 Translate for Zotero 原来的信息行位置。
