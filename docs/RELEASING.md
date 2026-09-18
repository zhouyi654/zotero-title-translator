# 发布流程

本项目使用 GitHub Releases 分发 `.xpi`，并通过 `manifest.json` 中的 `update_url` 让 Zotero 获取最新的 `updates.json`。

## 1. 发布前检查

发布前至少确认：

1. `manifest.json` 与 `package.json` 的版本号完全一致；
2. `CHANGELOG.md` 已记录本版本的用户可见变化；
3. README 中的当前版本和示例产物名已同步；
4. `applications.zotero.strict_min_version` / `strict_max_version` 与实际测试过的 Zotero 版本范围一致；
5. 仓库中没有 API Key、私人文献标题、Zotero profile、未脱敏日志或其他敏感数据；
6. 工作区只包含准备发布的改动。

运行：

```bash
npm run release:check
npm test
npm run build
npm run release:manifest
npm run release:verify
```

`strict_max_version` 应保持为已经实际测试过的 Zotero minor 版本，例如当前 Zotero 10 发布线使用 `10.0.*`；不要为了“兼容未来版本”直接写成过宽的范围。升级到新的 Zotero minor/major 后应先测试，再更新兼容范围。

预期生成：

```text
dist/zotero-title-translator-<version>.xpi
dist/updates.json
```

`npm run release:manifest` 会计算 XPI 的 SHA-256，并从 `manifest.json` 读取插件 ID、Zotero 兼容范围和 GitHub 仓库地址。

## 2. 本地验证 `updates.json`

生成文件应包含：

```text
addons
└─ zotero-title-translator@zhouyi654.github.io
   └─ updates
      └─ version
         update_link
         update_hash
         applications.zotero
```

其中：

- `version` 必须与 `manifest.json` 一致；
- `update_link` 必须指向该版本 GitHub Release 中的 XPI；
- `update_hash` 必须以 `sha256:` 开头；
- Zotero 兼容范围应与插件清单保持一致。

## 3. 提交主分支

确认 diff 后再提交：

```bash
git status
git diff
git add -A
git commit -m "release: v<version>"
git push origin main
```

## 4. 创建发布标签

标签必须严格等于 `v` + `manifest.json` 版本，例如当前版本 `0.3.12` 对应：

```bash
git tag v0.3.12
git push origin v0.3.12
```

不要重复使用已经公开发布过的正式标签。已发布版本需要修复时，应增加版本号。

## 5. GitHub Actions 自动发布

工作流模板受版本控制保存在 `scripts/workflow_templates/`。首次配置仓库或工作流文件缺失时先运行：

```bash
npm run workflows:install
```

该命令会安装：

```text
.github/workflows/ci.yml
.github/workflows/release.yml
```

`.github/workflows/release.yml` 在 `v*` 标签推送时：

1. 检出标签对应代码；
2. 安装 Node.js 20 和 Python；
3. 检查标签与 `manifest.json` 版本一致；
4. 运行 `npm test`；
5. 运行 `npm run build`；
6. 运行 `python scripts/generate_updates.py --tag <tag>`；
7. 创建 GitHub Release；
8. 上传 `.xpi` 与 `updates.json`。

CI 工作流 `.github/workflows/ci.yml` 应在 `push` 和 `pull_request` 时执行完整测试、XPI 构建和更新清单生成，尽量在正式发布前发现问题。

## 6. Zotero 更新地址

插件清单当前使用：

```text
https://github.com/zhouyi654/zotero-title-translator/releases/latest/download/updates.json
```

因此每个正式 Release 都必须包含名为 `updates.json` 的资源。

## 7. 发布后验证

发布完成后至少检查：

1. GitHub Release 中存在 `.xpi` 和 `updates.json`；
2. 下载 XPI 后能在受支持的 Zotero 9.0.x 或 10.0.x 中安装；
3. 插件管理器显示的版本正确；
4. 从上一公开版本执行“检查更新”时能发现新版本；
5. 标题翻译、摘要翻译和设置页面各执行一次最小冒烟测试；
6. README 的 Latest Release 徽章已更新。

## 8. 回滚原则

- 未公开的错误标签可以删除后重建；
- 已有用户安装的正式版本不要移动同名标签或替换其历史；
- 出现发布缺陷时，优先发布新的补丁版本；
- 不要用 `latest` URL 指向一个缺少 `updates.json` 的 Release。
