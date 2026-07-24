# 翻译服务商配置指南

插件支持多种服务。只需配置当前实际使用的服务，不需要填写所有服务。

## 选择建议

| 需求 | 推荐方案 |
|---|---|
| 不想申请密钥，只翻译少量标题 | MyMemory |
| 希望完全本地运行 | Ollama |
| 希望使用开源机器翻译服务 | 本机 LibreTranslate |
| 学术标题专用机器翻译 | Qwen-MT |
| 传统机器翻译 | DeepL、Google、Microsoft |
| 使用已有大模型账户 | SiliconFlow、火山方舟、DeepSeek、Gemini、OpenAI |
| 连接其他兼容平台 | 自定义 OpenAI-compatible API |

“免费”可能是免费层、免费额度、赠送余额或本机运行，不等于永久无限调用。

---

## MyMemory

### 特点

- 无需 API Key；
- 无需本地安装；
- 适合少量标题和初次试用；
- 公共服务有长度、每日配额和流量限制；
- 标题会发送给 MyMemory。

### 配置

```text
当前服务：MyMemory 免费在线
默认源语言代码：en
联系邮箱：可选
```

插件对 MyMemory 固定单并发并主动降速。

---

## LibreTranslate

### 本机部署

```bash
pip install libretranslate
libretranslate
```

默认地址：

```text
http://localhost:5000
```

### 插件配置

```text
当前服务：LibreTranslate 自托管
服务地址：http://localhost:5000
API Key：本机实例通常留空
```

公共或托管实例可能要求 API Key、限流或收费。不要使用来源不明的公共实例。

---

## Ollama

### 安装模型

```bash
ollama run translategemma:4b
```

### 插件配置

```text
当前服务：Ollama 本地模型
Ollama 地址：http://localhost:11434
本地模型：translategemma:4b
默认源语言名称：English
默认源语言代码：en
```

使用其他模型时，插件会切换到通用学术标题翻译提示词。

### 资源要求

本地翻译速度取决于：

- CPU；
- 内存；
- 显卡和显存；
- 模型大小；
- 同时运行的其他任务。

---

## Google Cloud Translation

### 准备

1. 创建 Google Cloud 项目；
2. 启用 Cloud Translation API；
3. 创建 API Key；
4. 根据当前平台规则配置结算和 API 限制。

### 插件配置

```text
当前服务：Google Cloud Translation
API Key：你的 Google Cloud API Key
```

插件使用官方 Basic v2 翻译接口并自动检测源语言。

---

## DeepL

### 插件配置

```text
当前服务：DeepL API Free / Pro
套餐：API Free 或 API Pro
API Key：你的 DeepL API Key
```

端点：

```text
API Free：https://api-free.deepl.com/v2/translate
API Pro：https://api.deepl.com/v2/translate
```

---

## Microsoft Translator

### 插件配置

```text
当前服务：Microsoft Translator
Endpoint：https://api.cognitive.microsofttranslator.com
Subscription Key：你的密钥
Region：区域资源或多服务资源按实际情况填写
```

如果出现 401 或 403，应检查 Key、Region 和资源类型是否匹配。

---

## 阿里云百炼 Qwen-MT

### 插件配置

```text
当前服务：阿里云百炼 Qwen-MT
Base URL：https://dashscope.aliyuncs.com/compatible-mode
模型：qwen-mt-plus
API Key：你的百炼 API Key
```

### 批量保护

插件默认：

- 单并发；
- 请求间隔约 1.2 秒；
- `X-DashScope-Wait-Timeout: 30`；
- HTTP 429 指数退避重试。

这些机制不能突破账户的 RPM、TPM 或余额限制。

---

## SiliconFlow（硅基流动）

```text
当前服务：SiliconFlow
Base URL：https://api.siliconflow.cn/v1
模型：账户中可调用的模型 ID
API Key：你的 API Key
```

插件默认关闭思考模式，以减少翻译任务中的冗余内容和 token 消耗。

模型可用性、免费状态和价格以账户控制台为准。

---

## 火山方舟

```text
当前服务：火山方舟
Base URL：https://ark.cn-beijing.volces.com/api/v3
模型 / Endpoint ID：模型 ID 或 ep-... 推理接入点
API Key：你的 API Key
```

若请求返回“模型不存在”或“无权访问”，应检查模型 ID、接入点状态、地域和 API Key 权限。

---

## DeepSeek

```text
当前服务：DeepSeek
Base URL：https://api.deepseek.com
模型：账户当前支持的模型名称
API Key：你的 API Key
```

模型名称可能随平台更新，应以官方控制台和文档为准。

---

## Google Gemini

```text
当前服务：Google Gemini
Base URL：https://generativelanguage.googleapis.com/v1beta
模型：账户当前支持的 Gemini 模型
API Key：你的 Gemini API Key
```

插件使用 `generateContent` REST 接口。

---

## OpenAI

```text
当前服务：OpenAI
Base URL：https://api.openai.com/v1
模型：支持 Chat Completions 的模型
API Key：你的 OpenAI API Key
```

模型、接口支持和价格可能变化，应以 OpenAI 当前文档为准。

---

## 自定义 OpenAI-compatible API

适用于提供 OpenAI Chat Completions 兼容接口的平台。

```text
当前服务：自定义 OpenAI-compatible API
Base URL：https://example.com/v1
模型：服务商要求的模型 ID
API Key：如服务需要则填写
```

兼容要求：

- `POST /chat/completions`；
- Bearer Token 鉴权或无需鉴权；
- 响应包含 `choices[0].message.content`。

部分平台虽然宣称 OpenAI-compatible，但可能使用不同字段，需单独适配。

---

## 远程服务隐私

除本机 Ollama 和本机 LibreTranslate 外，标题会发送给相应服务商。

插件不会主动发送 PDF、摘要、笔记、批注或整个数据库。服务商的数据保留、地区处理和隐私政策由服务商负责。
