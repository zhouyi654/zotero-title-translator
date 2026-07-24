# 外部术语集合导入格式

## 概览

Zotero 标题翻译 0.3.6 支持一次导入一个或多个术语文件。文件应使用 UTF-8 编码。

支持扩展名：

```text
.txt
.terms
.glossary
.csv
.tsv
.json
```

`.xlsx` 不能直接导入。请在 Excel 或 WPS 中另存为 **CSV UTF-8**。

---

## TXT / TERMS / GLOSSARY

每行一条：

```text
源术语 = 标准译法
```

可在后面列出错误译法：

```text
case-control study = 病例对照研究 | 病例控制研究 | 个案对照研究
```

注释：

```text
# 流行病学
odds ratio = 比值比 | 优势比
```

旧版 `=>` 仍兼容：

```text
cholera => 霍乱
```

导入后会统一保存为：

```text
cholera = 霍乱
```

---

## CSV

推荐表头：

```csv
source,target,aliases
```

示例：

```csv
source,target,aliases
cholera,霍乱,
case-control study,病例对照研究,病例控制研究 | 个案对照研究
"airway organoid",气道类器官,
```

字段含逗号时应使用双引号。插件支持标准 CSV 双引号转义。

也支持中文表头，例如：

```csv
源术语,标准译法,错误译法
cholera,霍乱,
```

没有表头时：

- 第一列：源术语；
- 第二列：标准译法；
- 后续列：错误译法或别名。

---

## TSV

TSV 与 CSV 结构相同，但列之间使用制表符。适合从 Excel 直接复制或导出。

推荐表头：

```text
source<TAB>target<TAB>aliases
```

---

## JSON

### 对象数组

```json
[
  {
    "source": "cholera",
    "target": "霍乱",
    "aliases": []
  },
  {
    "source": "case-control study",
    "target": "病例对照研究",
    "aliases": [
      "病例控制研究",
      "个案对照研究"
    ]
  }
]
```

### 映射对象

```json
{
  "cholera": "霍乱",
  "case-control study": {
    "target": "病例对照研究",
    "aliases": [
      "病例控制研究"
    ]
  }
}
```

也可把数组放在 `entries` 或 `terms` 属性中。

---

## 合并和替换

导入后会出现两个选项：

### 合并导入

- 保留当前术语；
- 添加新术语；
- 同源术语用导入规则覆盖旧规则。

### 替换全部

- 清空当前术语表；
- 只保留此次导入结果。

选择多个文件时，后面的文件覆盖前面文件中的同源术语。

---

## 外部术语库的注意事项

外部术语集合可能存在：

- 学科不匹配；
- 地区译法差异；
- 简繁体差异；
- 过时术语；
- 一词多义；
- 许可证限制。

建议仅导入有明确来源和使用许可的术语集合，并在批量重译前抽查。

插件不会联网下载第三方术语库，也不会自动判断术语权威性。
