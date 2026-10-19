# Crunchyroll 中文字幕 · Loon

让 iPhone 上的 Crunchyroll 原生 App **优先使用官方中文字幕，没有中文时翻译英文 ASS 字幕**。

当前分支为 **v0.2.0-beta.1 测试版**。官方字幕映射已真机确认；机翻已通过自动测试和真实 ASS 样本的接口测试，完整机翻播放链路仍需真机确认。

## 安装测试版

[一键导入 Loon 测试版](https://www.nsloon.com/openloon/import?plugin=https%3A%2F%2Fraw.githubusercontent.com%2Fhqwuzhaoyi%2Fcrunchyroll-loon%2Fv0.2.0-beta.1%2FCrunchyroll.Chinese.plugin)

也可以在 Loon 的插件管理中添加：

```text
https://raw.githubusercontent.com/hqwuzhaoyi/crunchyroll-loon/v0.2.0-beta.1/Crunchyroll.Chinese.plugin
```

先停用旧的官方中文字幕或临时诊断插件，再启用此插件。Loon 对同一响应只执行首条匹配的响应脚本，旧规则可能先处理请求。

启用 Loon MitM，并使用已经安装、受信任的 Loon 证书。重新打开 Crunchyroll 中的一集，选择 **English** 字幕。

## 官方中文和机翻怎样配合？

默认「官方优先」：

1. 接口有官方简中 `zh-CN` 时，使用官方简中。
2. 缺简中、有官方繁中 `zh-HK` 时，使用官方繁中。
3. 没有官方中文时，播放器请求原来的英文 ASS，插件提取普通对白并调用 Google 翻译。
4. 翻译失败、限流或超时时，未完成的行继续显示英文。

播放器菜单可能仍显示 English。

Loon 插件设置提供：

- **英文机翻兜底**：默认开启；关闭后只使用官方中文。
- **字幕来源**：默认「官方优先」；「始终机翻」保留英文入口，适合比较译文或验证机翻链路。
- **机翻字幕显示**：「仅中文」或「中英双语」。此选项只影响机器翻译的字幕。

验证机翻时，可在已有官方中文的作品上把「字幕来源」改为「始终机翻」，重新进入一集并选择 English。这样可以确认实际经过英文字幕翻译；验证后可改回「官方优先」。

## 字幕与性能

机翻保留 ASS 头部、时间字段和事件结构。重复对白去重，批量请求，每次字幕处理最多同时发出 3 个翻译请求。

首次加载英文字幕时需要等待翻译。脚本最多等待 12 秒，然后返回已完成的译文，其余行保持英文。最近最多 600 条译文保存在手机本地，重播时可直接使用缓存。

绘图和卡拉 OK 事件保留原文。逐字特效、行内样式及复杂排版可能无法完全复现；本版优先保证对白可读和时间轴正确。

## 网络与数据

机翻使用无需填写 API Key 的 Google 网页翻译接口。接口可用性取决于网络与 Google 的服务状态，也可能被限流。

启用机翻时，去掉 ASS 格式标签的英文对白会发送至 `translate.googleapis.com`。脚本不转发 Crunchyroll 的 Cookie、Authorization、播放令牌、字幕签名 URL 或播放接口正文，也不包含诊断回传和 Mac 局域网地址。

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
- 自动测试：检查官方字幕回退、签名 URL 保留、ASS 时间轴、批次对应关系、网络失败、限流、并发和缓存边界。
- 完整机翻播放链路：等待真机确认。

需要 Loon 3.5.1 (983) 或更新版本。没有验证 iPad、Apple TV、Android、Surge，也不提供语音转写。

## 下载与版本

- [v0.2.0-beta.1 测试版](https://github.com/hqwuzhaoyi/crunchyroll-loon/releases/tag/v0.2.0-beta.1)
- [v0.1.0 官方字幕版](https://github.com/hqwuzhaoyi/crunchyroll-loon/releases/tag/v0.1.0)

每版插件引用固定版本的脚本。`Crunchyroll.OfficialCN.plugin` 保留为兼容文件，与本版 `Crunchyroll.Chinese.plugin` 内容相同。

## 开发与检查

无需安装项目依赖，使用 Node.js 22 或更新版本：

```sh
npm test
npm run build
```

`src/ass.js` 负责 ASS 解析和重组，`src/translate-runtime.js` 负责翻译请求、缓存和回退。构建将两者合并为 Loon 可直接执行的 `Crunchyroll.Translate.js`。构建产物位于 `dist/`，附有 SHA256SUMS。

自动测试验证脚本行为，不能代替播放器的真机测试。

## 参考与许可证

思路与翻译接口选择参考 [DualSubs](https://dualsubs.github.io/)。配置语法见 [Loon Script 文档](https://nsloon.app/en/docs/Script/script_v2/)。

[MIT](LICENSE)
