# GitHub 仓库维护说明

正式仓库：

```text
https://github.com/zhouyi654/zotero-title-translator
```

仓库根目录应直接包含插件源码和发布配置，不要再套一层版本目录或压缩包目录。

建议根目录至少包含：

```text
.github/
content/
docs/
icons/
scripts/
tests/
.gitignore
README.md
README_EN.md
manifest.json
package.json
bootstrap.js
core.js
prefs.js
```

## 日常更新

修改完成后先检查：

```bash
git status
git diff
npm run release:check
npm test
npm run build
npm run release:manifest
npm run release:verify
```

首次配置或 `.github/workflows/` 缺失时，先运行 `npm run workflows:install` 安装受版本控制的 CI/Release 模板。

确认没有敏感信息、临时文件或错误构建产物后再提交。

推荐提交信息描述实际改动，例如：

```text
feat: improve abstract translation
fix: correct title translation sync
chore: harden release workflow
```

然后：

```bash
git add -A
git commit -m "<message>"
git push origin main
```

## 不要提交的内容

至少应忽略：

```text
dist/
node_modules/
__pycache__/
*.pyc
*.xpi
*.zip
.env
.env.*
```

另外不要提交：

- API Key 或访问令牌；
- 私人文献标题或摘要；
- Zotero profile；
- 未脱敏日志；
- PDF2zh 本机配置备份；
- 临时测试输出。

## 发布版本

发布版本不要直接手工上传一个随意命名的 ZIP。应按 [`RELEASING.md`](RELEASING.md) 的流程：

1. 更新版本号和更新日志；
2. 运行完整测试与构建；
3. 推送主分支；
4. 推送 `v<version>` 标签；
5. 让 GitHub Actions 创建 Release；
6. 确认 Release 同时包含 `.xpi` 和 `updates.json`。

## GitHub 仓库首页检查

公开发布前确认：

- README 首屏清楚说明插件用途；
- Releases 中存在可直接安装的 `.xpi`；
- CI 徽章正常；
- 中英文 README 可以互相跳转；
- Issues 已开启，便于用户报告问题；
- About/Description 使用清晰的英文描述；
- Topics 建议包含 `zotero`、`zotero-plugin`、`translation`、`research-tools`、`pdf-translation`；
- README 明确标注支持的 Zotero 版本与隐私边界。

如果 GitHub 首页只显示一个额外的项目文件夹，而不是上述根目录文件，说明仓库仍然多套了一层目录。
