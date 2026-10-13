# Zotero AutoNote

Zotero AutoNote 是一个面向 Zotero 10.0.x 的开源插件。它会在新条目拥有可读取的 PDF 全文后，调用用户自行配置的 OpenAI Chat Completions 兼容接口，并把生成结果保存为该条目的子笔记。

## 功能

- 新增条目含 PDF 时自动生成阅读笔记。
- PDF 尚未下载或全文索引未完成时，按 30 秒、1、2、4、8 分钟自动重试；PDF 下载或索引状态变化时也会立即重新检查。
- 自动生成只使用 PDF 附件文本，不会在 PDF 全文为空时发送生成请求。
- 支持从条目右键菜单或 Tools 菜单手动生成；手动模式不要求存在 PDF。
- 自动跳过已经包含 AutoNote 笔记的条目。
- 支持自定义 endpoint、API key、model、输出语言、提示词和最大全文字符数。
- 不记录 token 用量，不上传独立遥测数据。

## 系统要求

- Zotero 10.0.x
- 可访问的 OpenAI Chat Completions 兼容 API
- API 服务商提供的有效 API key

## 安装

### 从 GitHub Release 安装

1. 打开仓库右侧的 `Releases`。
2. 下载最新版本的 `zotero-autonote-*.xpi` 附件。不要下载 GitHub 自动生成的 Source code ZIP。
3. 在 Zotero 中打开 `Tools -> Plugins`。
4. 将 XPI 拖入插件窗口，或从齿轮菜单选择从文件安装。
5. 确认安装，必要时重启 Zotero。

### 从源码构建

需要 Node.js 20+、`zip` 和 `unzip`：

```bash
npm test
npm run build
unzip -t dist/zotero-autonote-0.2.9.xpi
```

生成的安装包位于 `dist/zotero-autonote-0.2.9.xpi`。

## 自动更新

从 0.2.8 开始，插件会通过仓库根目录的 `updates.json` 检查 GitHub Release。安装 0.2.7 或更早版本的用户需要手动安装 0.2.8 一次；之后发布更高版本时，Zotero 才能自动发现更新。

每次发布都必须上传 `npm run prepare-release` 生成的同一份 XPI，不能重新构建后换一个文件，否则 SHA-256 将不匹配。

## 配置

在 Zotero 设置中打开 `Zotero AutoNote` 页面：

- Endpoint：默认 `https://api.openai.com/v1/chat/completions`
- API key：对应服务商提供的密钥
- Model：默认 `gpt-4o-mini`
- Delay：导入后首次检查的等待时间，默认 30 秒
- Maximum automatic item age：允许自动处理的最大条目年龄，默认 180 分钟
- Maximum indexed attachment characters：发送给模型的最大附件字符数，默认 12000
- Output language：笔记输出语言
- Prompt：笔记结构与写作要求

## 自动与手动模式

自动模式只有在条目下存在 PDF 且 Zotero 可以读取其索引全文时才调用 AI。PDF 未就绪时插件会重试；重试结束后仍未就绪的条目可以稍后手动生成。

手动模式面向当前选中的普通条目，不要求 PDF。存在可读取的 PDF、HTML 或纯文本附件时会使用附件内容，否则根据题录和摘要生成。

## 隐私与安全

生成笔记时，插件会把题录元数据、摘要和可用附件文本发送到用户配置的 API endpoint。请确认你有权处理相关文献，并阅读服务商的隐私政策。

API key 当前保存在本机 Zotero profile 的偏好设置中，并未使用操作系统凭据保险库。建议使用独立、有限额的 key；一旦泄漏应立即撤销。更多信息见 [SECURITY.md](SECURITY.md)。

仓库源码和构建包不包含用户本机配置的 API key。

## 开发

```bash
npm test
npm run build
npm run check
npm run prepare-release
```

GitHub Actions 会在 push 和 pull request 时自动运行测试、构建并检查 XPI。

## 上传与发布

第一次上传 GitHub 和创建 Release 的完整中文教程见 [docs/GITHUB_UPLOAD_GUIDE.md](docs/GITHUB_UPLOAD_GUIDE.md)。

## License

[MIT](LICENSE)

