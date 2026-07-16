# CoverArt Square 代码评审与修复说明

评审日期：2026-07-16

## 1. 项目与部署假设

本项目通过 Docker 在本地 Linux 主机运行，使用 host 网络发现 Roon Core，并向同一可信局域网中的专用浏览器或 WebView 展示当前封面和历史封面墙。

本轮接受以下安全边界：

- 端口 `3666` 不做公网端口转发，也不经公网反向代理暴露。
- 局域网和显示设备可信，宿主机防火墙负责限制访问范围。
- 为保持现有部署和控制方式，本轮不增加登录、控制 token 或 Socket.IO 鉴权。
- 任意 Origin 和无鉴权控制仍属于已知风险；部署环境变化时必须重新评估。

## 2. 已确认问题

### 2.1 图片索引并发覆盖

`ImageService` 首次并发加载 `image_info.json` 时会创建多个独立缓存对象，之后多个异步任务直接覆盖同一个索引文件。复现结果为 20 张图片成功落盘，但索引最终只有 1 条记录。

影响：

- 图片数量和最旧图片统计不准确。
- 内容去重失效，已有图片可能被反复写入。
- 清理图片后，索引与实际文件更容易不一致。

修复方案：将图片保存和索引更新串行化，并通过临时文件加 rename 原子替换索引。

### 2.2 zone 显示与控制目标错位

浏览器 cookie 保存的 zone 不存在时，页面会显示列表中的第一个 zone，但控制命令继续发送旧的 zone ID。

影响：键盘或 Media Session 控制可能作用于错误区域，或者完全无效。

修复方案：发生回退时同步更新内存设置和 cookie。

### 2.3 致命异常后进程继续运行

`uncaughtException` 和 `unhandledRejection` 当前只记录日志。发生不可恢复错误后，HTTP 健康检查仍可能通过，Docker 因进程未退出而不会重启服务。

修复方案：统一执行服务清理并以非零状态退出；同时处理 `SIGTERM` 和 `SIGINT`，让容器正常停止。

### 2.4 生产依赖漏洞

评审时 `npm audit --omit=dev` 报告 8 个漏洞（4 high、4 moderate），其中公开 Socket.IO 链路使用的 `ws@8.18.3` 存在内存耗尽风险。

修复方案：更新可兼容升级的依赖和锁文件，升级后重新执行审计。本轮升级到的 `node-roon-api@1.2.3` 已移除存在问题的 `ip` 间接依赖。

## 3. 本轮修复范围

1. 修复图片与索引的并发写入。
2. 添加图片并发保存回归测试。
3. 修复 zone 回退后的控制 ID。
4. 增加进程关闭和致命异常退出流程。
5. 升级可直接修复的生产依赖并复审。
6. 验证 JavaScript 语法、测试、生产依赖树、Docker Compose 配置和短启动。

## 4. 暂缓事项

- REST 和 Socket.IO token 鉴权。
- Origin 白名单。
- 将 host 网络替换为端口映射；Roon Core 发现依赖当前网络模式。

## 5. 验收标准

- 并发保存不同封面后，图片文件数量与索引条目数量一致。
- zone cookie 失效时，显示目标和控制目标使用同一个 zone ID。
- `SIGTERM` 能清理键盘读取器和 Roon zone 订阅后退出。
- 未捕获异常或 Promise rejection 会触发非零退出，交由 Docker 重启。
- `npm test`、`npm ls --omit=dev` 和 Compose 配置校验通过。
- `npm audit --omit=dev` 不再报告本项目可直接修复的 `ws`、`qs` 等漏洞。

## 6. 实施结果

- 20 个并发图片保存测试得到 20 个图片文件、20 条索引和一致统计。
- zone 回退会同步更新内存设置和 cookie。
- `SIGTERM` 和 `SIGINT` 实测均以状态 0 退出，未遗留 Node 进程。
- `npm audit --omit=dev` 报告 0 个漏洞。
- 主页、配对 API 和 `js-cookie` 浏览器脚本实测返回 200。
- 基础、构建和键盘三套 Compose 配置校验通过。
- `epochaudio/coverart:3.1.8` 镜像完成全量构建，镜像内版本为 `3.1.8`，容器健康状态为 `healthy`。
- Roon 注册请求实测上报 `display_version: 3.1.8`，并完成真实 Core 配对和 zone 订阅。

## 7. Docker 构建优化

- 构建和运行阶段由已 EOL 的 Node.js 20 升级到 Node.js 24 LTS。
- `npm ci` 使用 BuildKit cache mount，依赖层失效时复用 npm 下载缓存。
- `.dockerignore` 排除测试目录，测试保留为本地和发布前独立校验。
- 健康检查只在 Dockerfile 中维护，Compose 继承镜像默认配置。
- Roon SDK 协议日志默认关闭，Compose 的 json-file 日志限制为 10 MiB × 3。
- 后续发布可固定 Node 基础镜像 digest，进一步提高可复现性。
