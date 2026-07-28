# 将本文件夹更新到 GitHub 仓库

本文件夹已经按照 GitHub 仓库根目录结构整理。解压后应直接看到：

```text
.github/
content/
docs/
icons/
tests/
README.md
manifest.json
bootstrap.js
core.js
prefs.js
```

不要把整个外层文件夹再复制为仓库中的一个子目录。

## 使用 GitHub Desktop

1. 在 GitHub Desktop 中克隆：
   `https://github.com/zhouyi654/zotero-title-translator`
2. 打开本压缩包；
3. 将压缩包根目录中的全部文件复制到本地仓库根目录；
4. 允许覆盖旧文件；
5. 确认 `.github` 和 `.gitignore` 也被复制；
6. 在 GitHub Desktop 中检查 Changes；
7. 提交说明填写：
   `发布 0.3.9：新增侧边栏译题同步和摘要翻译`
8. 点击 Commit to main；
9. 点击 Push origin。

## 使用 PowerShell

先进入本地仓库：

```powershell
cd 你的仓库路径\zotero-title-translator
```

将本压缩包根目录中的全部文件覆盖到该目录，然后：

```powershell
git status
git add -A
git commit -m "发布 0.3.9：新增侧边栏译题同步和摘要翻译"
git push origin main
```

## 发布 0.3.9

```powershell
git tag v0.3.9
git push origin v0.3.9
```

标签推送后，打开 GitHub 仓库的 Actions 页面检查 Release 工作流。

## 检查仓库首页

仓库首页文件列表应直接出现：

```text
.github
content
docs
icons
tests
README.md
manifest.json
```

若首页只显示一个版本文件夹，说明仍然多套了一层目录。
