# PDF2zh Next 术语桥接技术设计

## 设计约束

1. 不修改 PDF2zh 插件 XPI、源码和菜单。
2. 不修改 `server.py` 或重新发布 PDF2zh。
3. 只使用 PDF2zh Next/BabelDOC 已有的 glossary 配置能力。
4. 任何桥接失败都不能阻断原 PDF 翻译。
5. 对 `config.toml` 的写入必须可追踪、可恢复。

## 上游接口依据

当前 PDF2zh 插件实例名为 `pdf2zh`，翻译入口由 `hooks.onDialogEvents("translatePDF")` 分发。PDF2zh Server 使用 `config/config.toml` 调用 `pdf2zh_next`，其 `[translation]` 区域包含 `glossaries` 和 `no_auto_extract_glossary`。

BabelDOC glossary CSV 使用：

```csv
source,target,tgt_lng
```

其中 `tgt_lng` 可选。本桥接始终写入 PDF2zh 当前目标语言，避免同一术语被错误应用到其他目标语言。

## 组件

### 1. 术语转换器

输入：本插件标准术语对象。

```text
source = target | wrong alias
```

输出：

```csv
source,target,tgt_lng
```

错误译法 alias 不传入 PDF2zh，只用于标题译后校正。

### 2. TOML 最小修改器

只定位 `[translation]` 区域和两个键：

- `glossaries`
- `no_auto_extract_glossary`

不重排其他 section，不解析或重写翻译服务密钥。

### 3. 文件同步器

生成：

```text
config/zotero-title-translator-glossary.csv
config/zotero-title-translator-bridge-state.json
config/config.toml.ztt-backup
```

备份只在首次同步时创建，避免后续覆盖最初状态。

### 4. 运行时 Hook

状态：

```text
未检测到 PDF2zh
→ 检测到 hooks
→ 保存原 onDialogEvents
→ 安装包装函数
→ 翻译前同步
→ 调用原函数
```

插件关闭时，若目标函数仍是本插件包装函数，则恢复原函数；若 PDF2zh 已重载并替换函数，则不强行覆盖。

## 调用序列

```text
用户点击 PDF2zh“翻译 PDF”
        ↓
桥接开关是否开启？──否──→ 原 PDF2zh 函数
        ↓是
引擎是否 pdf2zh_next？──否──→ 提示并继续原函数
        ↓是
读取术语和 config.toml
        ↓
生成 CSV、备份、状态文件
        ↓
更新 glossaries
        ↓
调用原 PDF2zh 函数
```

## 并发与一致性

PDF2zh 的翻译请求在 Hook 同步完成后才启动。同步文件较小，采用串行写入：

1. 写/保留备份；
2. 写桥接状态；
3. 写 glossary CSV；
4. 写 config.toml；
5. 调用 PDF2zh。

多个 PDF 任务若几乎同时启动，写入内容相同，结果为幂等。未来可增加互斥锁，但当前版本不并行修改不同术语集合。

## 恢复策略

恢复时不直接用完整备份覆盖当前 `config.toml`，因为 PDF2zh 可能在桥接后更新了 API 配置。

恢复算法：

1. 从当前 `glossaries` 中移除本插件生成的路径；
2. 若没有其他路径，恢复首次记录的原始 `glossaries` 行；
3. 只有当前值仍为桥接设置的 `true` 时，才恢复 `no_auto_extract_glossary`；
4. 删除生成的 CSV 和状态文件；
5. 保留完整备份供人工处理。

## 兼容性边界

支持：

- PDF2zh 插件实例 `Zotero.pdf2zh`；
- `hooks.onDialogEvents`；
- `pdf2zh_next`；
- `[translation].glossaries`。

不支持：

- 旧 `pdf2zh` 引擎；
- PDF2zh 将入口改为闭包且不再通过 `hooks` 暴露；
- 上游删除或重命名 `glossaries`；
- Server 文件夹只读。

发生不兼容时采用 fail-open，不阻断原插件。

## 安全边界

- 不读取 PDF 内容；
- 不读取 PDF2zh API Key；
- 不把术语发送给本项目作者；
- 不记录完整 `config.toml`；
- 状态文件只保存相关键的原始行和本地路径；
- Debug Log 只记录文件路径和术语数量。
