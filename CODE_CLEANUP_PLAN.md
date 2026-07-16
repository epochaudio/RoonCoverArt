# CoverArt Square 冗余代码清理计划

制定日期：2026-07-16

## 1. 目标

在不改变当前封面展示、封面墙、浏览器键盘控制、宿主机键盘控制和 Roon 配对行为的前提下，删除旧入口与不可达资源，精简当前运行路径，并降低重复实现再次产生分叉缺陷的风险。

## 2. 支持入口

- Node 入口：`src/server.js`，由 `npm start` 和 Dockerfile 使用。
- 页面入口：`public/index.html`。
- 当前前端主逻辑：`public/js/fullscreen.js` 和 `public/js/keyboard-controller.js`。
- Roon、图片、Socket 和键盘服务：`src/services/`。

根目录 `app.js` 不再作为支持入口。删除后不再支持未记录的 `node app.js` 启动方式。

## 3. 已确认冗余

### 3.1 完全不可达

- 根目录 `app.js`。
- `utils/imageUtils.js`。
- `public/js/main.js`。
- `public/js/fullscreen-display.js`。
- `public/js/NoSleep.min.js`。
- `public/js/color-thief.js`。
- `public/js/jquery.simplemarquee.js`。
- `public/css/nowplaying.css`。

### 3.2 当前运行路径中的残留

- `public/js/app.js` 除 EventEmitter 外的显示、时钟和工具类。
- `fullscreen.js` 中不存在 DOM 对应物的时钟逻辑。
- 引用未加载缓存实现的内存清理逻辑。
- 错误已在内层吞掉、因此无法触发的恢复逻辑。
- `.clock` 过滤、未使用 theme、无效图片查询参数和未使用的第二张过渡图片。
- 仅为两次 DOM 赋值引入的 jQuery。
- `site.css` 中对应旧播放器界面的规则。
- Express 已内置功能对应的 `body-parser`、JS MIME 设置和重复首页路由。
- 手工维护但项目没有读取的 `transport._zones` 私有缓存。

## 4. 执行步骤

1. 删除完全不可达的旧文件。
2. 将最小 EventEmitter 移入键盘控制脚本，删除 `public/js/app.js`。
3. 删除 jQuery，改用原生 DOM API。
4. 删除无效时钟、内存清理、恢复包装、旧 CSS 和第二张过渡图片。
5. 用 `express.json()` 替代直接 `body-parser` 依赖，并简化静态文件服务。
6. 删除未被项目使用的 Roon transport 私有缓存镜像。
7. 更新 `package.json` 和锁文件。
8. 执行自动化测试、语法检查、HTTP 冒烟、真实 Roon 配对、Compose 校验和 Docker 构建。

## 5. 兼容性保留

以下接口即使当前页面没有调用，本轮仍保留：

- `GET /api/images`、`GET /api/status`、`GET /api/zones`。
- `POST /roonapi/goRefreshBrowse`、`POST /roonapi/goLoadBrowse`。
- Socket `changeVolume`、`changeSetting` 和 `goPlay*`/`goPause`/`goStop`/`goPrev`/`goNext` 事件。
- 对应的 RoonService browse、load、volume、settings 和 transport 方法。

## 6. 验收标准

- 当前页面加载的每个本地脚本和样式均有实际调用方。
- 不再存在两个 Node 服务端入口或两套图片保存实现。
- 浏览器不再下载 jQuery 和旧 app.js。
- 首页、Cookie 脚本、配对 API、随机封面 API 返回正常。
- 使用已有 Roon 状态副本能够完成配对并返回 zone。
- `npm test`、`npm audit --omit=dev`、生产依赖树和三套 Compose 配置通过。
- Docker 镜像可以从干净锁文件完成构建。

## 7. 本轮不处理

- 已接受的本地可信网络鉴权策略。
- README 已公开兼容 API 的版本化移除。

## 8. 实施结果

- 删除 10 个不可达旧入口、脚本、样式和工具文件。
- 当前页面仅加载 Socket.IO、js-cookie、键盘控制器和封面主脚本。
- 删除 jQuery、body-parser、command-line-args 和 command-line-usage 直接依赖，直接依赖由 14 个降到 10 个。
- 删除无 DOM 对应物的时钟、非标准内存监控、无效恢复包装、第二封面节点和 Roon transport 私有缓存镜像。
- 精简浏览器键盘控制和 Socket 事件处理，并修复小图库随机更新可能请求无效图片的问题。
- Roon 上报版本、npm 版本和 Docker 默认镜像标签统一升级到 3.1.8。
- Docker 升级到 Node.js 24 LTS，增加 npm 缓存，并删除 Compose 重复健康检查。
- JavaScript 语法、并发保存测试、生产依赖树、安全审计、三套 Compose、HTTP、真实 Roon 配对、SIGTERM 和 Docker 健康检查全部通过。
