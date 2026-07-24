# 发布流程

## 发布前检查

1. 更新 `manifest.json` 版本；
2. 更新 `package.json` 版本；
3. 更新 `CHANGELOG.md`；
4. 更新 README 中的当前版本和构建产物名称；
5. 确认没有 API Key、日志或私人数据；
6. 运行：

```bash
npm test
python build_xpi.py --check
```

## 提交主分支

```bash
git add -A
git commit -m "发布 0.3.7：新增外部术语集合导入和等号格式"
git push origin main
```

## 创建标签

标签必须与 `manifest.json` 版本一致：

```bash
git tag v0.3.7
git push origin v0.3.7
```

## GitHub Actions 自动发布

`.github/workflows/release.yml` 会：

1. 校验标签和清单版本；
2. 运行测试；
3. 构建 XPI；
4. 计算 SHA-256；
5. 生成 `updates.json`；
6. 创建 GitHub Release；
7. 上传 XPI 和更新清单。

## Zotero 更新地址

插件清单使用：

```text
https://github.com/zhouyi654/zotero-title-translator/releases/latest/download/updates.json
```

该地址会指向最新 Release 中的更新清单。

## 标签已经存在怎么办

删除本地和远程旧标签：

```bash
git tag -d v0.3.7
git push origin :refs/tags/v0.3.7
```

重新创建：

```bash
git tag v0.3.7
git push origin v0.3.7
```

不要在公开用户已经安装某个正式版本后随意移动同名标签。正式发布后应增加版本号。
