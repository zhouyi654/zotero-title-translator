# 免费翻译方案

本项目中的“免费”包括无需密钥的公共服务、自托管服务、本地模型、免费套餐和免费额度。第三方服务的规则可能变化。

## MyMemory

优点：

- 无需 API Key；
- 无需安装；
- 开箱即用。

限制：

- 有长度和每日配额；
- 有流量限制；
- 不适合大型文献库；
- 标题会发送给第三方。

适合少量试用。

## LibreTranslate 自托管

LibreTranslate 是开源机器翻译服务，可在本机运行：

```bash
pip install libretranslate
libretranslate
```

插件连接：

```text
http://localhost:5000
```

本机运行通常不需要 API Key，也不产生云端调用费用。

## Ollama 本地模型

安装并运行：

```bash
ollama run translategemma:4b
```

插件连接：

```text
http://localhost:11434
```

优点：

- 标题可留在本机；
- 不按请求收费；
- 可离线运行。

成本：

- 占用本机算力、内存和显存；
- 首次下载模型需要网络和磁盘空间；
- 质量和速度取决于模型与硬件。

## 商业服务的免费层

Google、Microsoft、DeepL、SiliconFlow、火山方舟、Gemini 等平台可能提供：

- 免费套餐；
- 月度免费额度；
- 注册赠送余额；
- 部分免费模型。

这些规则可能随时间、地区、账户和模型变化。插件不会保证永久免费。

## 推荐选择

- 少量、无需安装：MyMemory；
- 重视隐私：本机 Ollama；
- 开源机器翻译：本机 LibreTranslate；
- 学术标题质量和稳定性：正式机器翻译 API 或 Qwen-MT；
- 已有大模型账户：使用相应平台，但设置费用上限。
