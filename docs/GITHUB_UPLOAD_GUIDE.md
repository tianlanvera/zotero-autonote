# 把 Zotero AutoNote 上传到 GitHub：保姆级教程

这份教程假设仓库名使用 `zotero-autonote`。命令中的 `YOUR_GITHUB_USERNAME` 必须替换为你自己的 GitHub 用户名。

## 1. 发布前自检

打开终端并进入项目目录：

```bash
cd /PATH/TO/zotero-autonote
```

最简单的做法是在 Finder 中打开项目文件夹，把文件夹拖进终端窗口，终端会自动填入正确路径；在路径前输入 `cd ` 后按回车。

运行测试和构建：

```bash
npm test
npm run build
unzip -t dist/zotero-autonote-0.2.7.xpi
```

三个命令都成功后再继续。不要把任何真实 API key 写入源码、README、issue 或提交记录。

## 2. 设置 Git 提交身份

先查看是否已经配置：

```bash
git config user.name
git config user.email
```

如果没有输出，设置你希望公开显示的名字和 GitHub 已验证邮箱：

```bash
git config user.name "YOUR_NAME"
git config user.email "YOUR_EMAIL"
```

这里不加 `--global`，只影响当前插件仓库。

不想公开私人邮箱时，可以在 GitHub 的 `Settings -> Emails` 中启用隐藏邮箱，然后使用 GitHub 提供的 `noreply` 地址。

## 3. 初始化本地 Git 仓库

当前整理后的项目已经初始化为 `main` 分支，不需要重复执行 `git init`。先检查：

```bash
git branch --show-current
git status
```

`git branch --show-current` 应输出 `main`。如果你以后复制了一个不含 `.git` 的新目录，才需要在那个新目录中执行 `git init -b main`。

确认 `dist/`、`.DS_Store`、`zotero-compat-test/` 没有出现在待提交列表中。然后执行：

```bash
git add .
git diff --cached --check
git status
git commit -m "Initial public release"
```

如果 `git diff --cached --check` 报错，先修正后再提交。

## 4. 在 GitHub 网页创建空仓库

1. 登录 GitHub。
2. 点击右上角 `+`，选择 `New repository`。
3. `Repository name` 填写 `zotero-autonote`。
4. 选择 `Public`。
5. 不要勾选 `Add a README file`。
6. 不要额外选择 `.gitignore` 或 License，因为本地已经存在。
7. 点击 `Create repository`。

创建完成后，GitHub 会显示仓库地址，例如：

```text
https://github.com/YOUR_GITHUB_USERNAME/zotero-autonote.git
```

## 5. 关联远程仓库并上传

把下面命令中的用户名替换掉：

```bash
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/zotero-autonote.git
git remote -v
git push -u origin main
```

GitHub 不接受账户密码作为 Git HTTPS 密码。如果终端要求认证，可以使用以下任一方式：

- GitHub CLI：先运行 `gh auth login`，按提示选择 GitHub.com、HTTPS 和浏览器登录。
- Personal Access Token：用户名填写 GitHub 用户名，密码位置粘贴 token。
- Git Credential Manager：按弹出的浏览器登录流程操作。

上传后刷新 GitHub 仓库页面，应当能看到 `README.md`、`LICENSE`、源码、测试和 `.github/workflows/ci.yml`。

## 6. 检查 GitHub Actions

1. 打开仓库的 `Actions` 标签页。
2. 点击最新的 `CI` 工作流。
3. 确认 `Run tests`、`Build XPI` 和 `Verify XPI archive` 都显示绿色对勾。

如果失败，点击失败步骤查看日志，修复后重新提交：

```bash
git add .
git commit -m "Fix CI"
git push
```

## 7. 创建 0.2.7 Release 并上传 XPI

先确认本地安装包存在：

```bash
ls -lh dist/zotero-autonote-0.2.7.xpi
shasum -a 256 dist/zotero-autonote-0.2.7.xpi
```

然后在 GitHub 网页操作：

1. 打开仓库首页右侧的 `Releases`。
2. 点击 `Draft a new release`。
3. 点击 `Choose a tag`，输入 `v0.2.7`，选择创建新标签。
4. `Release title` 填写 `Zotero AutoNote 0.2.7`。
5. 在说明中概括时区修复、PDF 重试、隐私变化及 GitHub 发布准备。
6. 将 `dist/zotero-autonote-0.2.7.xpi` 拖到附件区域。
7. 建议先点击 `Save draft`，确认附件无误后再发布。
8. 点击 `Publish release`。

发布后，用户应下载 Release 附件里的 `.xpi`，而不是 GitHub 自动生成的 `Source code (zip)`。

## 8. 给用户的安装说明

用户下载 XPI 后：

1. 打开 Zotero。
2. 打开 `Tools -> Plugins`。
3. 将 `.xpi` 拖入插件窗口，或从齿轮菜单选择从文件安装。
4. 确认安装，必要时重启 Zotero。
5. 在 Zotero 设置中的 `Zotero AutoNote` 页面配置 endpoint、API key、model 和 prompt。

## 9. 后续版本怎么发布

每次发布都应同时更新：

- `zotero-autonote/manifest.json` 中的版本号；
- `package.json` 中的版本号；
- `CHANGELOG.md`；
- README 中展示的安装包文件名（如果出现具体版本）。

然后运行：

```bash
npm test
npm run build
git add .
git commit -m "Release 0.2.8"
git push
```

最后在 GitHub Releases 创建对应的 `v0.2.8` 标签并上传新 XPI。

## 10. 可选：配置自动更新

当前公开整理版没有写死 GitHub 地址，也没有启用自动更新。这样可以避免仓库还没创建时留下无效 URL。

等仓库地址确定后，可以再完成以下工作：

1. 在 `manifest.json` 增加真实 `homepage_url`。
2. 创建 Zotero `updates.json`。
3. 将 `applications.zotero.update_url` 指向该文件的稳定 HTTPS 地址。
4. 在 `updates.json` 中填写 Release XPI 的下载地址、版本兼容范围和 SHA-256。
5. 再发布一个新版本，不要替换已发布版本的 XPI 内容。

## 常见问题

### `remote origin already exists`

先查看当前地址：

```bash
git remote -v
```

如果地址错误，修改它：

```bash
git remote set-url origin https://github.com/YOUR_GITHUB_USERNAME/zotero-autonote.git
```

### `src refspec main does not match any`

通常表示还没有成功提交。运行：

```bash
git status
git add .
git commit -m "Initial public release"
git push -u origin main
```

### GitHub 要求输入密码但总失败

不要输入 GitHub 账户密码。改用 `gh auth login`、Personal Access Token 或 Git Credential Manager。

### 不小心提交了 API key

立即在 API 服务商后台撤销并重新生成 key。仅从最新文件中删除是不够的，因为旧 key 仍可能存在于 Git 历史中。公开仓库出现过的 key 应一律视为已经泄漏。

