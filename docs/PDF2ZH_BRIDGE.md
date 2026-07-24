# PDF2zh Next 术语桥接

## 目标

让“Zotero 标题翻译”的术语集合同时用于 PDF2zh Next 的全文翻译，同时不修改 PDF2zh 插件 XPI、源码、菜单或服务端程序。

## 工作机制

PDF2zh Zotero 插件最终通过其 `hooks.onDialogEvents("translatePDF")` 入口启动翻译。本插件在 Zotero 运行时包装该入口：

1. 检查桥接开关；
2. 检查 PDF2zh 当前引擎是否为 `pdf2zh_next`；
3. 读取本插件当前启用的术语表；
4. 生成 BabelDOC 术语 CSV；
5. 更新 PDF2zh Server 的 `config/config.toml`；
6. 调用 PDF2zh 原始函数。

包装只存在于当前 Zotero 进程中。关闭本插件时会恢复原始函数引用。

## 不会修改的内容

- PDF2zh 插件 XPI；
- PDF2zh JavaScript/TypeScript 源码；
- PDF2zh 的右键菜单和设置页；
- `server.py`；
- PDF2zh 的翻译服务配置；
- PDF 输出、附件和命名逻辑。

## 会写入的文件

在 PDF2zh Server 的 `config` 文件夹中：

```text
zotero-title-translator-glossary.csv
zotero-title-translator-bridge-state.json
config.toml.ztt-backup
```

同时会修改：

```text
config.toml
```

修改范围限于 `[translation]` 下的：

```toml
glossaries = "..."
no_auto_extract_glossary = true  # 仅在用户选择关闭自动术语提取时
```

## 路径选择

可以选择：

- 直接包含 `server.py` 的 `server` 文件夹；
- 包含 `server/config/config.toml` 的项目根目录；
- `config` 文件夹本身。

插件会自动寻找 `config/config.toml`。

## 术语 CSV

生成格式：

```csv
source,target,tgt_lng
cholera,霍乱,zh-CN
case-control study,病例对照研究,zh-CN
```

标题术语中 `|` 后面的错误译法只用于标题译后校正，不会作为正确译法写入 PDF2zh CSV。

## 与已有术语文件的关系

### 追加模式

保留 `config.toml` 中已有的 glossary 路径，并追加本插件生成的 CSV。该模式默认启用。

### 替换模式

`glossaries` 只指向本插件生成的 CSV。恢复桥接时会恢复首次同步前记录的值。

## 自动术语提取

默认不改变 PDF2zh/BabelDOC 的自动术语提取设置。

勾选“关闭 PDF2zh 自动术语提取”后，将写入：

```toml
no_auto_extract_glossary = true
```

## 失败策略

桥接采用 fail-open：

- 同步成功：使用自定义术语后启动 PDF2zh；
- 同步失败：显示无声提示并记录日志，然后继续调用 PDF2zh 原始翻译函数。

这样桥接故障不会阻断 PDF 翻译。

## 恢复

点击“恢复桥接前配置”后：

- 从 `glossaries` 中移除本插件管理的 CSV 路径；
- 在安全条件下恢复首次记录的 `no_auto_extract_glossary`；
- 删除生成的术语 CSV 和状态文件；
- 保留 `.ztt-backup` 供人工恢复。

恢复不会卸载或修改 PDF2zh 插件。


## 缓存与重复测试

PDF2zh Next/BabelDOC 会缓存已经翻译过的文本。若同一篇 PDF 在术语表启用前已经翻译，
再次翻译时可能直接读取旧译文。

0.3.8 默认在桥接时写入：

```toml
[translation]
ignore_cache = true
```

测试完成后可以关闭“强制忽略旧翻译缓存”，减少重复 API 请求和费用。

固定术语测试时，状态区必须同时显示：

```text
术语 CSV：已生成
配置引用术语：是
忽略旧缓存：已启用
```

若源术语在 PDF 中因断行、软连字符、连字或不同拼写而不再是精确文本，术语仍可能无法命中。
