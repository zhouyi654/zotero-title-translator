# 翻译服务商

## 无需商业 API

### MyMemory
无需密钥，适合少量标题。公共服务有配额和限流。

### LibreTranslate
建议自行部署。本机实例通常不需要密钥。

### Ollama
完全本地。推荐 `translategemma:4b`。

## 传统机器翻译

### Google Cloud Translation
使用 Basic v2：
`POST https://translation.googleapis.com/language/translate/v2`
通过 `X-goog-api-key` 请求头鉴权。

### DeepL
API Free：
`https://api-free.deepl.com/v2/translate`

API Pro：
`https://api.deepl.com/v2/translate`

### Microsoft Translator
默认：
`https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=zh-Hans`

## 大模型平台

### Qwen-MT
默认 Base URL：
`https://dashscope.aliyuncs.com/compatible-mode`

插件自动补全：
`/v1/chat/completions`

### SiliconFlow
默认：
`https://api.siliconflow.cn/v1/chat/completions`

### 火山方舟
默认：
`https://ark.cn-beijing.volces.com/api/v3/chat/completions`

### DeepSeek
默认：
`https://api.deepseek.com/chat/completions`

### Gemini
使用 `generateContent` REST 接口和 `x-goog-api-key` 请求头。

### OpenAI / 自定义
使用 Chat Completions 兼容接口。

## 质量建议

对于医学、生物学和学术标题：

1. Qwen-MT 通常应作为主要机器翻译方案；
2. DeepL、Google 和 Microsoft 可作为传统机器翻译对照；
3. Gemini、OpenAI、DeepSeek、SiliconFlow、火山方舟更依赖模型与提示词；
4. 本地 Ollama 的质量取决于模型和硬件；
5. MyMemory 更适合低门槛试用，不适合作为大规模高质量主方案。
