# Zotero 标题翻译

[![CI](https://github.com/zhouyi654/zotero-title-translator/actions/workflows/ci.yml/badge.svg)](https://github.com/zhouyi654/zotero-title-translator/actions/workflows/ci.yml)
[![GitHub release](https://img.shields.io/github/v/release/zhouyi654/zotero-title-translator)](https://github.com/zhouyi654/zotero-title-translator/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

一个面向 **Zotero 9** 的标题翻译插件。它不会覆盖原始标题，而是在条目列表新增
**“标题（中文）”** 列：

- 中文原标题直接显示；
- 非中文标题翻译后显示中文译题；
- 支持单篇、多篇和整个文献库批量翻译；
- 译题保存到条目的 `Extra` 字段；
- 默认跳过中文标题和已有译题；
- 支持无声完成通知，可在设置中关闭；
- 支持多种在线、本地和自托管翻译服务。

> 当前版本仍处于早期阶段。发布前已经过静态测试和 Zotero 9.0.6 实机使用，
> 但不同操作系统、服务商账户与模型可能存在差异。

## 安装

1. 打开 [Releases](https://github.com/zhouyi654/zotero-title-translator/releases)；
2. 下载最新的 `zotero-title-translator-*.xpi`；
3. 在 Zotero 中进入 **工具 → 插件**；
4. 点击齿轮，选择 **Install Add-on From File…**；
5. 选择 XPI 文件。

从本仓库 Release 安装的版本可通过 `updates.json` 检查后续更新。

## 使用

### 翻译所选条目

在条目列表中选择一个或多个普通文献条目，右键选择：

- **翻译标题（跳过已有译题）**
- **重新翻译标题（覆盖已有译题）**
- **清除标题译文**

### 翻译整个文献库

可以使用任一入口：

- 左侧文献库或分类右键 → **翻译所属文献库全部未翻译标题**
- 工具菜单 → **翻译当前文献库全部未翻译标题**

开始前插件会显示实际需要调用服务的条目数量及费用、配额或隐私提示。

### 显示中文标题列

右键条目列表表头，勾选 **“标题（中文）”**。

## 数据保存

非中文标题的译文保存在条目 `Extra` 字段：

```text
ZoteroTitleTranslation: 中文译题
```

这样可以：

- 保留原始 `title`；
- 避免修改 Zotero 数据库结构；
- 避免将完整译题污染为标签；
- 让译题随条目元数据保存和同步。

## 支持的翻译服务

### 无需商业 API 或可本地运行

- MyMemory
- LibreTranslate
- Ollama

### 传统机器翻译 API

- Google Cloud Translation
- DeepL API Free / Pro
- Microsoft Translator

### 大模型平台

- 阿里云百炼 Qwen-MT
- SiliconFlow
- 火山方舟
- DeepSeek
- Google Gemini
- OpenAI
- 自定义 OpenAI-compatible API

“免费”可能表示免费套餐、免费额度、赠送余额或本地运行，并不等同于永久无限调用。
具体配置见 [`docs/PROVIDERS.md`](docs/PROVIDERS.md)。

## Qwen-MT 批量限流

插件对 Qwen-MT 默认采用以下保护：

- 单并发；
- 请求间隔约 1.2 秒；
- `X-DashScope-Wait-Timeout: 30`；
- HTTP 429 指数退避重试；
- 再次运行时自动跳过已成功条目。

这些机制用于降低触发 RPM 和突发限流的概率，不能突破服务商账户的绝对配额。

## 隐私与 API Key

- 插件只发送待翻译的标题文本，不发送 PDF、摘要、笔记或整个 Zotero 数据库；
- 本机 Ollama 和本机 LibreTranslate 可不将标题发送到互联网；
- 其他远程服务会接收标题；
- API Key 目前保存在当前设备的 Zotero 本地配置中，未进行额外加密；
- 请勿在公共或多人共用设备中保存高权限密钥。

完整说明见 [`PRIVACY.md`](PRIVACY.md) 和 [`SECURITY.md`](SECURITY.md)。

## 开发

要求：

- Node.js 20 或更高版本；
- Python 3.10 或更高版本。

运行测试：

```bash
npm test
```

构建 XPI：

```bash
python build_xpi.py
```

产物位于：

```text
dist/zotero-title-translator-0.3.2.xpi
```

## 发布

推送与 `manifest.json` 版本一致的标签，例如：

```bash
git tag v0.3.2
git push origin v0.3.2
```

GitHub Actions 会：

1. 运行测试；
2. 构建 XPI；
3. 计算 SHA-256；
4. 生成 Zotero `updates.json`；
5. 创建 GitHub Release 并上传 XPI 与更新清单。

详细流程见 [`docs/RELEASING.md`](docs/RELEASING.md)。

## 贡献

参见 [`CONTRIBUTING.md`](CONTRIBUTING.md)。

## 许可证

[MIT License](LICENSE)
