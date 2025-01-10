# Change Log

## Version 2.1.1
### 功能优化
- 新增专辑封面颜色提取功能
  - 动态设置页面背景色
  - 智能计算文字对比色
  - 平滑的颜色过渡效果
- 改进时钟显示效果
  - 基于背景亮度自动调整文字颜色
  - 优化模糊背景效果
- 提升用户体验
  - 更自然的颜色变换
  - 优化视觉层次感
  - 增强整体美感

## Version 1.0.7
### 界面优化
- 优化非触摸设备的交互体验
  - 平时自动隐藏鼠标指针
  - 移动鼠标时显示指针
  - 悬停在按钮上时保持显示
- 改进按钮交互效果
  - 悬停时按钮亮度提升
  - 更流畅的过渡动画
- 优化封面图片显示
  - 保持原生显示效果
  - 轻微的悬停放大效果
- 触摸设备适配
  - 移除不必要的悬停效果
  - 优化触摸反馈

## Version 1.0.6
### 更新内容
- 版本号统一更新到1.0.6
- 新增封面图片点击触发全屏显示功能
- 优化全屏显示体验
- 添加鼠标悬停提示效果
- 改进iOS设备的全屏支持
- 优化代码结构和性能

## Version 1.0.5
### 更新内容
- 版本号统一更新到1.0.5
- 优化性能和稳定性
- 改进代码结构
- 修复全屏模式区域选择问题，现在切换到全屏模式会保持与 nowplaying 页面相同的区域选择
- 优化了区域状态的持久化存储
- 改进了页面切换逻辑

## Version 1.0.3

### 功能优化
- 移除了全屏模式中的时钟显示功能
- 优化了全屏显示界面，使其更加简洁
- 改进了 Safari 浏览器的兼容性支持

### 界面改进
- 简化了全屏模式的视觉元素
- 优化了页面布局和显示效果

## Version 1.2.15

### 新特性

- 重命名项目为 "Roon Album Art 显示器"
- 优化了界面设计和用户体验
- 新增 Docker 容器化部署支持
- 默认端口更改为 9660
- 新增自动字体缩放功能
- 优化了响应式设计
- 优化了全屏显示模式的界面设计
- 新增翻页时钟显示功能
- 改进了主题切换效果
- 优化了页面切换按钮的交互体验

### 技术改进

- 更新了项目结构和代码组织
- 增强了代码质量控制
- 改进了错误处理机制
- 优化了 WebSocket 连接稳定性
- 增加了健康检查制
- 优化了 WebSocket 连接稳定性
- 改进了图片加载机制
- 优化了 CSS 样式结构
- 提升了代码可维护性

### 文档更新

- 完善了中文文档支持
- 更新了安装和使用说明
- 添加了详细的部署文档
- 优化了故障排除指南

### 其他改进

- 增强了安全性配置
- 优化了资源缓存策略
- 改进了断线重连机制
- 完善了日志记录系统

### 界面改进

- 重新设计了时钟显示样式，采用翻页效果
- 简化了时间显示，仅显示小时和分钟
- 优化了页面切换按钮的视觉效果
- 改进了授权等待提示的显示效果

### 功能优化

- 简化了页面切换逻辑
- 优化了主题切换的性能
- 改进了背景切换的过渡效果
- 增强了界面响应速度

## Version 1.2.14

Forked from the original repo at https://github.com/pluggemi/roon-web-controller with the following modifications done by Miemo Penttinen:

Additional setting:
- you can now toggle scrolling of longer titles and names on and off in the settings, defaults to scrolling still as earlier versions

Visual tweaks:
- changed the typeface to Lato so it's same as what Roon uses in their apps
- changed the SVG icons to use rounded variants of the Material Icons to go visually better with the smoother shape of the Lato typeface
- highlight color changed to Roon purple (or actually slightly brighter for better visibility)
- tweaks to the visual hierarchy between the elements in #containerMusicInfo
- tweaks to the album image style

Bug fixes:
- SVG icons size now much better even on newer Safari versions which had bad issues with earlier code

## Version 1.2.13.1

Forked from the original repo at https://github.com/pluggemi/roon-web-controller with the following modifications done by Miemo Penttinen:

Additional setting:
- you can now toggle scrolling of longer titles and names on and off in the settings, defaults to scrolling still as earlier versions

Visual tweaks:
- changed the typeface to Lato so it's same as what Roon uses in their apps
- changed the SVG icons to use rounded variants of the Material Icons to go visually better with the smoother shape of the Lato typeface
- highlight color changed to Roon purple (or actually slightly brighter for better visibility)
- tweaks to the visual hierarchy between the elements in #containerMusicInfo
- tweaks to the album image style

Bug fixes:
- SVG icons size now much better even on newer Safari versions which had bad issues with earlier code

## Version 1.2.13

NOTE: this is the final release of the 1.x series.

Security
- updated dependencies for security issues.

### Upgrade Notes

The package dependencies have been updated to the latest versions. It is recommended to perform an update.

If you followed the [Diet Pi installation](https://github.com/pluggemi/roon-web-controller/wiki/Diet-Pi-Installation) guide, follow these [update instructions](https://github.com/pluggemi/roon-web-controller/wiki/Diet-Pi-Installation#updating-the-web-controller-software)

Otherwise, on the Node.js server:

1. Stop the extension
1. Run `git pull`
1. Run `npm install`
1. Run `npm update`
1. Start the extension

---

# Release History

## Version 1.2.12

Accessibility

- corrected name and aria label for one of the zone list buttons

## Version 1.2.11

### New

Accessibility

- added dynamic alt text for album cover
- added names and aria labels to buttons
- added aria disabled status to buttons

## Version 1.2.10

### New

- Updated dependencies to address a potential security vulnerability

## Version 1.2.9

### New

- Updated dependencies
- Added check to show zone selection overlay if selected zone is no longer available.

## Version 1.2.8

### New

- Maintenance Release
- Addressed issue where the song seek time was not updating.

## Version 1.2.7

### New

- Maintenance Release
- Updated dependencies and updated code for compatibility with the Command Line Usage module.

## Version 1.2.6

### New

- Added option to disable the screensaver or sleep mode when a song is playing. The screensaver or sleep mode is allowed when a track is paused or stopped.
  - Known limitation - the app will not wake up a screen that is already sleeping when playback is started from another app.

## Version 1.2.5

No changes - version bump to allow registration on [npmjs.com](https://www.npmjs.com/package/roon-web-controller)

## Version 1.2.4

### New

- Added option for 4K cover images on the Now Playing screen. (Settings -> Use 4k Images)

### Fixed bugs

- Fixed compatibility issue with older versions of IOS Safari.

## Version 1.2.3

### New

### Fixed bugs

- Corrected button flow in the non-settings related overlays
- Added feedback to zonelist overlay in library to match nowplaying section
- Fixed bug where title text was not centered in the library list
- Fixed bug where very long text in library list would extend past the button size

## Version 1.2.2

### New

- OS native song notifications thanks to initial code by [jcharr1](https://github.com/jcharr1)
- Added option to use circle icons (for Play, Pause and Stop only)
- Added feedback on various overlays to show currently selected option

## Version 1.2.1

### New

- Volume up and volume down buttons for more granular control of the volume

### Misc bug fixes and behind the scenes

- Extended cookie life 7 to 365 days
- Corrected the click action for the stop button
- Removed the unused "getIcon" web endpoint
- Addressed bug where images in library did not scale correctly
- Fixed button rendering issue with Firefox
- Added browser specific CSS for opacity, blur, and drop shadow - needed for older Chromium builds
- Added "engine" field to package.json to specify the minimum required Node.js version
- Added ability to run the script from any location - better compatibility with Roon Extension Manager
- Updated package dependencies
- Miscellaneous UI tweaks

### Upgrade Notes

The package dependencies have been updated to the latest versions. It is recommended to perform an update.

On the Node.js server:

1. Stop the extension
1. Run `git pull`
1. Run `npm install`
1. Run `npm update`
1. Start the extension `node .`

## Version 1.2.0

### New

- Library Browser
- Search (Library -> Search)
- Added theme button to "Now Playing" screen
- Split "Now Playing" and "Library" into a standalone pages to allow for custom layouts (example side-by-side layout provided, http://localhost:8080/side-by-side.html)
- Removed workaround now that API loop bug (https://github.com/RoonLabs/node-roon-api/issues/5) is resolved

### Upgrade Notes

Due to the use of new Roon APIs, you must remove the old extension authorization and create a new one!

On the Node.js server:

1. Stop the extension

In an official Roon Client:

1. Go to Settings -> Extensions.
1. Click the "View" button.
1. Remove all previous instances of "Web Controller".

On the Node.js server:

1. Run `git pull`
1. Run `npm install`
1. Start the extension `node .`

In an official Roon Client:

1. Go to Settings -> Extensions.
1. Click the "Enable" button beside "Web Controller".

## Version 1.1.1

### Fixed Bugs

- Addressed issue that caused icons to be very small on high DPI monitors and devices

## Version 1.1.0

### Install Notes

See the [README.md](README.md) for installation instructions

### Upgrade notes

Please run `npm install` after upgrading due to new dependencies.

### New

- Complete rewrite of UI - now supports both Portrait and Landscape view making it more suitable for phones
- Added new theme based on the dominant color of the cover art
- Added volume controls
- Added controls for Loop, Shuffle, and Auto Radio
- Added a check to see if the extension is enabled
- Added visual feedback when clicking overlay buttons
- Switching zones is now much more responsive
- Depreciated the "Light" and "Cover Light" themes

### Implemented Feature Requests

- Added config file for server settings (config/local.json). The example file `config/local.conf.EXAMPLE` shows usage and is tracked by `git`. The `config/local.conf` is not tracked by `git` so that local settings will not be clobbered by `git pull`.
- Added command line options for help and to set the server port (`node app.js -h` for usage).

### Fixed Bugs

- After switching a zone, the zone_id did not update for the controls. This could lead to controlling the previous zone with the new zone's controls.
- Tweaked jquery.simplemarquee.js to use "span" instead of "div". Caused problems with CSS layouts.
- Rewritten zone message parser to handle multiple events per message. Caused problems with zone list improperly reflecting grouped and ungrouped zones. Likely root cause of previously reported problem with repeated listings in Zone Listings.

## Version 1.0.1

- Resolved bug that could result in repeated listings in Zone Listings
- Changed all icons to utilize SVGs from Material Design Icons (https://materialdesignicons.com/)
- Dramactically reduced the number of times the icons were being called and redrawn
- Changed default theme to "Cover Dark"
- Set default icon theme to "Circles"
- Added configuration option to select icons between icons with or without circles
- Miscellaneous aesthetic changes

## Version 1.0.0

- Initial Release
