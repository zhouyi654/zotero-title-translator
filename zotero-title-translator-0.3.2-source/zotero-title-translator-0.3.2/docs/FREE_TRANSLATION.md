# 免费翻译服务

插件 0.2.0 支持三种不依赖商业付费 API 的路径。

## MyMemory 免费在线

- 无需 API Key；
- 适合少量英文论文标题；
- 标题会发送给第三方；
- 存在单段长度、每日配额和流量限制；
- 插件固定单并发，并在请求后主动等待；
- 不抓取网页，不绕过配额。

官方资料：

- https://mymemory.translated.net/doc/spec.php
- https://mymemory.translated.net/terms-and-conditions

## LibreTranslate 自托管

LibreTranslate 是自由开源机器翻译 API。可在本机运行：

```bash
pip install libretranslate
libretranslate
```

插件默认连接：

```text
http://localhost:5000/translate
```

本机自托管通常不需要 API Key；托管实例可能要求密钥、限流或收费。

官方资料：

- https://docs.libretranslate.com/
- https://docs.libretranslate.com/api/operations/translate/

## Ollama 本地模型

Ollama 默认在本机提供 API：

```text
http://localhost:11434/api
```

推荐模型：

```bash
ollama run translategemma:4b
```

TranslateGemma 是专门面向翻译的开放模型。填入其他模型时，
插件改用通用学术标题翻译提示词。

官方资料：

- https://docs.ollama.com/api/introduction
- https://docs.ollama.com/api/chat
- https://ollama.com/library/translategemma

## 选择建议

- 不希望标题离开本机：Ollama 或本机 LibreTranslate。
- 不安装软件，只偶尔翻译：MyMemory。
- 高质量、大批量、稳定性优先：正式 Qwen-MT 或其他 API。
- 第三方服务可能随时调整配额、条款和可用性，插件不保证永久无限免费。
