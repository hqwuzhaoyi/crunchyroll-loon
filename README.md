# Crunchyroll 中文字幕 · Loon

让 iPhone 上的 Crunchyroll 原生 App **优先使用官方中文字幕，没有中文时翻译英文 ASS 字幕**。支持 Google，以及自行配置接口地址、模型名和密钥的 OpenAI 兼容翻译服务。

当前分支为 **v0.2.0-beta.2 测试版**。官方字幕映射已真机确认；Google 机翻已通过自动测试和真实 ASS 样本的接口测试。大模型请求只进行了模拟接口测试，未调用付费模型。完整机翻播放链路仍需真机确认。

## 安装测试版

[一键导入 Loon 测试版](https://www.nsloon.com/openloon/import?plugin=https%3A%2F%2Fraw.githubusercontent.com%2Fhqwuzhaoyi%2Fcrunchyroll-loon%2Fv0.2.0-beta.2%2FCrunchyroll.Chinese.plugin)

也可以在 Loon 的插件管理中添加：

```text
https://raw.githubusercontent.com/hqwuzhaoyi/crunchyroll-loon/v0.2.0-beta.2/Crunchyroll.Chinese.plugin
```

先停用旧的官方中文字幕或临时诊断插件，再启用此插件。Loon 对同一响应只执行首条匹配的响应脚本，旧规则可能先处理请求。

启用 Loon MitM，并使用已经安装、受信任的 Loon 证书。重新打开 Crunchyroll 中的一集，选择 **English** 字幕。

## 官方中文和机翻怎样配合？

默认「官方优先」：

1. 接口有官方简中 `zh-CN` 时，使用官方简中。
2. 缺简中、有官方繁中 `zh-HK` 时，使用官方繁中。
3. 没有官方中文时，播放器请求原来的英文 ASS，插件提取普通对白并使用所选翻译服务。默认使用 Google；选择 OpenAI 兼容接口后使用自行填写的模型。
4. 翻译失败、限流或超时时，未完成的行继续显示英文。

播放器菜单可能仍显示 English。

Loon 插件设置提供：

- **英文机翻兜底**：默认开启；关闭后只使用官方中文。
- **字幕来源**：默认「官方优先」；「始终机翻」保留英文入口，适合比较译文或验证机翻链路。
- **机翻字幕显示**：「仅中文」或「中英双语」。此选项只影响机器翻译的字幕。
- **翻译服务**：默认 Google，也可以选择「OpenAI兼容」。

### 在插件中配置大模型

无需修改脚本，在 Loon 的插件参数页填写：

| 配置项 | 用途 |
| --- | --- |
| 翻译服务 | 选择 OpenAI兼容 后才启用大模型 |
| 大模型接口地址 | HTTPS Base URL，例如 `https://api.openai.com/v1`，也接受完整 `.../chat/completions` 地址 |
| 大模型模型名 | 你使用的接口支持的模型 ID，默认留空 |
| 大模型 API Key | 你自己的密钥，默认留空，由 Loon 保存为用户配置 |
| 大模型 JSON 模式 | 默认开启；不支持 `response_format` 的兼容服务可关闭 |
| 大模型等待上限 | 默认 15 秒，可设 5 到 40 秒 |

目前仅支持 Chat Completions 格式的兼容接口；不接受原生 Responses 或其他供应商的非兼容协议。接口地址不能包含 URL 用户名、密码、查询参数或片段。

没有选择大模型或缺少有效配置时，使用 Google。公开插件不含实际密钥；用户备份或导出的 Loon 参数可能包含自行填写的 Key。

模型按每批最多 20 条对白处理，附带前后文和说话人，以字幕 ID 回填结果。相同英文在不同语境中可得到不同译文。格式错误、缺失 ID、拒绝或请求错误时，在剩余预算允许的情况下回退 Google；否则保留原行。

验证机翻时，可在已有官方中文的作品上把「字幕来源」改为「始终机翻」，重新进入一集并选择 English。这样可以确认实际经过英文字幕翻译；验证后可改回「官方优先」。

## 字幕与性能

机翻保留 ASS 头部、时间字段和事件结构。重复对白去重，批量请求，每次字幕处理最多同时发出 3 个翻译请求。

首次加载英文字幕时需要等待翻译。Google 模式最多等待 12 秒，然后返回已完成的译文，其余行保持英文。最近最多 600 条 Google 译文保存在手机本地，重播时可直接使用缓存。

大模型模式按配置的等待上限处理，最多同时发出 2 个请求。最近 40 批模型译文按接口、模型、提示词版本及上下文隔离缓存，不与 Google 的文本缓存混用。

绘图和卡拉 OK 事件保留原文。逐字特效、行内样式及复杂排版可能无法完全复现；本版优先保证对白可读和时间轴正确。

## 网络与数据

默认机翻使用无需填写 API Key 的 Google 网页翻译接口。选择大模型后会调用自行配置的兼容接口，可能产生该服务的 API 费用。可用性与延迟取决于网络、服务及模型，也可能被限流。

Google 模式及其回退请求会把去掉 ASS 格式标签的英文对白发送至 `translate.googleapis.com`。大模型模式会把对白、说话人和少量前后文发送至你配置的 HTTPS 接口。模型请求使用填写的 API Key，并关闭重定向和自动 Cookie；Key 不放入提示词或译文缓存。

两种翻译模式都不转发 Crunchyroll 的 Cookie、Authorization、播放令牌、字幕签名 URL 或播放接口正文，也不包含诊断回传和 Mac 局域网地址。

官方中文映射不调用翻译接口。安装与更新时需要能够访问 GitHub 下载地址。

## 支持范围与验证情况

官方中文映射只匹配已测试的 iPhone 播放接口：

```text
https://www.crunchyroll.com/playback/v3/<episode>/ios/iphone/play
```

机翻当前只处理本次观察到的英文 ASS 下载路径：

```text
https://vod-fy-mod.crunchyrollcdn.com/static/.../subtitles/enus/.../subtitle.ass
```

其他字幕格式、CDN 或播放接口暂时原样放行。

- 官方字幕映射：2026-10-20 已在 iPhone 15 Pro、Loon 3.5.2、Crunchyroll 4.120.0 的测试链路中确认播放和中文显示。
- 机翻接口测试：真实 ASS 样本的 99 条对白约 2 秒完成翻译，时间字段保持不变；这只是该次测试结果。
- 自动测试：44 项检查通过，覆盖官方字幕回退、签名 URL 保留、ASS 时间轴、模型参数、鉴权隔离、字幕 ID、网络失败、限流、并发及缓存边界。
- 大模型实测：未配置真实密钥、未调用真实模型服务；当前只验证模拟请求与响应。
- 完整机翻播放链路：等待真机确认。

需要 Loon 3.5.1 (983) 或更新版本。没有验证 iPad、Apple TV、Android、Surge，也不提供语音转写。

## 下载与版本

- [v0.2.0-beta.2 测试版](https://github.com/hqwuzhaoyi/crunchyroll-loon/releases/tag/v0.2.0-beta.2)
- [v0.1.0 官方字幕版](https://github.com/hqwuzhaoyi/crunchyroll-loon/releases/tag/v0.1.0)

每版插件引用固定版本的脚本。`Crunchyroll.OfficialCN.plugin` 保留为兼容文件，与本版 `Crunchyroll.Chinese.plugin` 内容相同。

## 开发与检查

无需安装项目依赖，使用 Node.js 22 或更新版本：

```sh
npm test
npm run build
```

`src/ass.js` 负责 ASS 解析和重组，`src/translate-runtime.js` 负责 Google 翻译。`src/llm.js` 与 `src/llm-runtime.js` 负责兼容接口、按 ID 校验、缓存及回退。构建将它们合并为 Loon 可直接执行的 `Crunchyroll.Translate.js`。构建产物位于 `dist/`，附有 SHA256SUMS。

自动测试验证脚本行为，不能代替播放器的真机测试。

## 参考与许可证

思路与翻译接口选择参考 [DualSubs](https://dualsubs.github.io/)。配置语法见 [Loon Script 文档](https://nsloon.app/en/docs/Script/script_v2/)。兼容请求格式参考 [OpenAI Chat Completions 文档](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create)。

[MIT](LICENSE)
