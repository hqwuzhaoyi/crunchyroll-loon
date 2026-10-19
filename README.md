# Crunchyroll 官方中文字幕 · Loon

让 iPhone 上的 Crunchyroll 原生 App，通过 **English 字幕选项显示已有的官方中文字幕**。

**这版不提供机器翻译。** 如果某一集没有官方简中或繁中，插件会保留原字幕。

## 安装

[一键导入 Loon](https://www.nsloon.com/openloon/import?plugin=https%3A%2F%2Fraw.githubusercontent.com%2Fhqwuzhaoyi%2Fcrunchyroll-loon%2Fmain%2FCrunchyroll.OfficialCN.plugin)

也可以在 Loon 的插件管理中添加：

```text
https://raw.githubusercontent.com/hqwuzhaoyi/crunchyroll-loon/main/Crunchyroll.OfficialCN.plugin
```

启用插件及 Loon 的 MitM，并使用已经安装、受信任的 Loon 证书。进入 Crunchyroll，重新打开一集，在播放器中选择 **English** 字幕。

如果之前安装过「Crunchyroll 字幕诊断（临时）」，先停用旧插件，再使用此插件。Loon 对同一响应只执行首条匹配的响应脚本，避免旧规则先处理请求。

## “复用官方简中”是什么意思？

真机测试时，Crunchyroll 的播放接口同时返回了英文、简体中文和繁体中文的字幕地址。这个插件把 `en-US` 条目的字幕地址和格式改为现有的 `zh-CN` 条目，让原播放器下载并显示官方中文字幕。

播放器菜单仍可能显示 English。字幕文件由 Crunchyroll 提供，插件没有把英文机器翻译成中文，也不会生成新的字幕。

- 优先使用官方简中 `zh-CN`。
- 没有简中时，使用官方繁中 `zh-HK`。
- 没有合适的中文或英文条目时，原样返回。
- 保留完整的字幕签名 URL 和其他播放信息。

## 支持范围

目前只匹配已测试的 iPhone 播放接口：

```text
https://www.crunchyroll.com/playback/v3/<episode>/ios/iphone/play
```

2026-10-20 已在 **iPhone 15 Pro、Loon 3.5.2、Crunchyroll 4.120.0** 的测试链路中确认正常播放和中文显示。该测试不能代表整个片库或所有设备。

本插件使用 Loon 3.5.1 (983) 起的脚本语法。没有验证 iPad、Apple TV、Android 或 Surge，也不提供中英双语合成、语音转写或缺失字幕的翻译。

## 下载与更新

- [最新 Release](https://github.com/hqwuzhaoyi/crunchyroll-loon/releases/latest)
- [插件下载](https://github.com/hqwuzhaoyi/crunchyroll-loon/releases/latest/download/Crunchyroll.OfficialCN.plugin)
- [脚本下载](https://github.com/hqwuzhaoyi/crunchyroll-loon/releases/latest/download/Crunchyroll.OfficialCN.js)

主分支的插件地址用于订阅更新。每版插件引用固定版本的脚本，避免插件与脚本版本不一致。发布新版本后，在 Loon 中更新插件。

脚本执行时没有网络请求，不包含诊断回传、Mac 局域网地址、API Key 或翻译服务。安装和更新时仍需能够访问 GitHub 下载地址。

## 开发与检查

无需安装项目依赖，使用 Node.js 22 或更新版本：

```sh
npm test
npm run build
```

测试检查实际 Loon 响应脚本的输入输出，包括签名 URL 保留、其他播放字段保留、繁中回退、异常数据原样返回，以及发布地址的一致性。构建输出位于 `dist/`，包括插件、脚本、说明和校验和。

自动测试验证脚本行为，播放器兼容性仍需真机确认。

## 参考

思路参考 [DualSubs](https://dualsubs.github.io/)。当前实现只映射现有的官方字幕条目，和 DualSubs 的字幕翻译、双语合成是不同的功能范围。

配置语法与脚本匹配规则见 [Loon Script 文档](https://nsloon.app/en/docs/Script/script_v2/)。

## 许可证

[MIT](LICENSE)
