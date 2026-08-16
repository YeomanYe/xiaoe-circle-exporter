# 小鹅通助手商店发布 Payload

## 基本信息

- Extension name: 小鹅通助手
- Version: 0.1.0
- Category: Productivity
- Package: `store-packages/xiaoe-helper-0.1.0.zip`
- Privacy policy URL: 待填写。建议发布 `docs/privacy-policy.md` 到一个公开 HTTPS URL 后填写。

## Short Description

把鹅圈子帖子的正文、附件、评论和评论媒体完整打包为 ZIP。

## Description

小鹅通助手用于在小鹅通鹅圈子页面中，将帖子正文、附件、一级评论、回复评论和评论媒体打包下载为一个 ZIP 文件，便于本地备份、离线阅读和资料归档。

使用方式：
1. 登录并打开鹅圈子页面。
2. 在帖子列表中点击帖子卡片上的“打包下载”，或进入帖子详情页后从扩展弹窗点击“打包当前帖子”。
3. 扩展会读取帖子详情、分页获取全部评论和回复，并把附件、图片、音频、视频等资源保存到 ZIP 中。

扩展生成的 ZIP 包包含离线阅读版 `index.html`、Markdown 文档、结构化 JSON、帖子附件和评论媒体文件。数据处理过程全部在浏览器本机完成，不会上传到开发者服务器或第三方服务器。任一附件或媒体下载失败时，扩展会停止导出并显示错误，避免生成看似成功但内容不完整的压缩包。

## Chrome Web Store Assets

- Icon 128x128: `store-assets/chrome/icon-128x128.png`
- Screenshot 1280x800: `store-assets/common/screenshot-1280x800.png`
- Small promotional tile 440x280: `store-assets/chrome/small-promo-440x280.png`
- Marquee promotional tile 1400x560: `store-assets/chrome/marquee-promo-1400x560.png`

## Microsoft Edge Add-ons Assets

- Extension logo 300x300: `store-assets/edge/logo-300x300.png`
- Icon 128x128: `store-assets/edge/icon-128x128.png`
- Screenshot 1280x800: `store-assets/edge/screenshot-1280x800.png`
- Small promotional tile 440x280: `store-assets/edge/small-promo-440x280.png`
- Large promotional tile 1400x560: `store-assets/edge/large-promo-1400x560.png`

## Single Purpose

在用户主动操作时，把小鹅通鹅圈子帖子、附件、完整评论和评论媒体导出为本地 ZIP 文件。

## Permission Justifications

- `activeTab`: 用于在用户当前打开的鹅圈子页面上执行导出操作。
- `tabs`: 用于识别当前页面、打开临时帖子详情页、在导出完成后关闭临时页面，并根据当前页面更新扩展图标状态。
- `scripting`: 用于在鹅圈子帖子详情页中执行数据读取脚本。
- `downloads`: 用于把本机生成的 ZIP 文件保存到浏览器下载目录。
- `offscreen`: 用于在 Manifest V3 的离屏文档中生成 ZIP 文件。
- `https://quanzi.xiaoe-tech.com/*`: 用于读取鹅圈子帖子页面和详情数据。
- `https://*.xiaoe-tech.com/*` / `https://*.xiaoeknow.com/*`: 用于访问小鹅通相关接口和资源。
- `https://*.myqcloud.com/*` / `http://*.myqcloud.com/*`: 用于下载帖子附件和评论媒体资源。

## Remote Code

No. The extension does not load or execute remotely hosted code. All extension scripts are bundled in the submitted package.

## Data Usage

The extension reads Xiaoe Circle post content, attachments, comments, replies and media only after the user starts an export. The data is processed locally in the browser to generate a ZIP file. The extension does not collect, upload, sell, share or transfer user data.

## Edge Search Terms

- 小鹅通
- 鹅圈子
- 帖子导出
- 评论归档
- ZIP
- 社群备份
- 离线阅读

## Certification Notes

No login credentials are included. Reviewers can verify the extension after logging into a Xiaoe Circle account and opening a supported `https://quanzi.xiaoe-tech.com/` post page. The extension adds a “打包下载” button to supported post cards and provides a popup action on post detail pages. All exported data is generated locally as a ZIP file and downloaded through the browser downloads API. The extension does not use remote code.
