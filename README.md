# Roon Cover Art Extension

一个用于展示 Roon 专辑封面的扩展程序，支持实时播放显示和艺术墙展示模式。

## 功能特点

1. **实时播放显示**
   - 显示当前播放曲目的专辑封面
   - 使用等比缩放适配方形画屏
   - 向浏览器 Media Session 提供标准和 4K 封面元数据

2. **艺术墙模式**
   - 暂停或停止播放 15 秒后自动切换到艺术墙
   - 使用 4x4 网格展示 16 张已保存封面
   - 每 120 秒随机更新 3 个位置
   - 使用淡入淡出切换并预加载图片

3. **专用画屏优化**
   - 面向 1920x1920 等方形显示设备
   - 页面固定全屏布局并隐藏鼠标指针
   - 浏览器端最多缓存 25 张已加载图片

4. **自动保存功能**
   - 自动保存播放过的专辑封面
   - 支持自定义保存目录
   - 使用专辑名生成文件名
   - 使用内容哈希避免重复写入
   - 支持 JPG/PNG 格式配置

5. **键盘快捷键控制**
   - 浏览器页面获得焦点时支持快捷键控制
   - 空格键 - 播放/暂停切换
   - ←/→箭头键 - 上一曲/下一曲  
   - P键 - 播放
   - ESC键 - 停止
   - 媒体键 - 支持键盘上的媒体控制键
   - MediaSession API集成，支持操作系统级媒体控制
   - 宿主机键盘控制：Docker 容器可读取宿主机 `/dev/input` 键盘事件；没有设备时自动 no-op，可用 `KEYBOARD_ENABLED=false` 关闭

6. **连接管理**
   - 自动重连机制
   - 健康状态监控
   - 连接状态实时反馈
   - 优化的订阅管理

## 安装方法

### 方法1：使用 Docker（推荐）

当前版本（含授权持久化与 `config/local.json` 配置方式）的完整安装说明请查看：

- `DOCKER_INSTALL.md`

镜像仓库：

- https://hub.docker.com/r/epochaudio/coverart/tags

推荐方式：先拉取官方镜像，再按文档使用 `docker compose` 或 `docker run` 启动。生产部署建议固定版本 `3.1.8`：

```bash
docker pull epochaudio/coverart:3.1.8
# 或始终使用最新标签
docker pull epochaudio/coverart:latest
```

#### Docker CLI 简化版：
```bash
# 创建必要的配置目录
mkdir -p /cache/Roonart/images /cache/Roonart/config
cd /cache/Roonart
# 创建配置文件（如果不存在）
test -f config.json || printf '{}\n' > config.json
test -f config/local.json || printf '{\n  "server": {\n    "port": "3666"\n  }\n}\n' > config/local.json

docker run -d \
  --name roon-coverart \
  --network host \
  --restart unless-stopped \
  -v $(pwd)/config.json:/app/config.json \
  -v $(pwd)/config/local.json:/app/config/local.json:ro \
  -v $(pwd)/images:/app/images \
  epochaudio/coverart:3.1.8
```

`config.json` 用于保存 Roon 授权/配对状态，属于本地运行态文件，不应提交到 Git。

如需在 Docker CLI 方式下使用宿主机键盘控制，需要额外加入宿主机 `input` 组、`/dev/input` 只读挂载和 input 设备 cgroup 规则。`KEYBOARD_ENABLED` 默认就是 `true`，下面显式写出便于覆盖：

```bash
docker run -d \
  --name roon-coverart \
  --network host \
  --restart unless-stopped \
  --group-add "$(getent group input | cut -d: -f3)" \
  --device-cgroup-rule='c 13:* rwm' \
  -e KEYBOARD_ENABLED=true \
  -e KEYBOARD_DEBOUNCE_MS=180 \
  -v /dev/input:/dev/input:ro \
  -v $(pwd)/config.json:/app/config.json \
  -v $(pwd)/config/local.json:/app/config/local.json:ro \
  -v $(pwd)/images:/app/images \
  epochaudio/coverart:3.1.8
```

如果宿主机没有 `input` 组，或 `/dev/input/event*` 是 `root:root` 且权限为 `0600`，上面的 `--group-add` 不会生效。此时可让容器以 root 用户读取只读输入设备：

```bash
docker run -d \
  --name roon-coverart \
  --network host \
  --restart unless-stopped \
  --user root \
  --device-cgroup-rule='c 13:* rwm' \
  -e KEYBOARD_ENABLED=true \
  -e KEYBOARD_DEBOUNCE_MS=180 \
  -v /dev/input:/dev/input:ro \
  -v $(pwd)/config.json:/app/config.json \
  -v $(pwd)/config/local.json:/app/config/local.json:ro \
  -v $(pwd)/images:/app/images \
  epochaudio/coverart:3.1.8
```

#### Docker Compose 简化版：
```yaml
services:
  coverart:
    image: ${COVERART_IMAGE:-epochaudio/coverart:3.1.8}
    container_name: roon-coverart
    init: true
    pull_policy: missing
    environment:
      NODE_ENV: production
      ROON_PERSIST_PATH: /app/config.json
    network_mode: "host"
    restart: unless-stopped
    security_opt:
      - no-new-privileges:true
    volumes:
      - ./images:/app/images:rw
      - ./config/local.json:/app/config/local.json:ro
      - ./config.json:/app/config.json:rw
```

#### 宿主机键盘控制（默认启用，无设备时 no-op）

如果键盘插在运行 Docker 的宿主机上，容器读取 `/dev/input` 事件后可以直接控制 Roon。键盘监听默认启用；没有发现键盘或设备打开失败时只输出 warning，不影响网页和 Roon 扩展启动。需要关闭时设置 `KEYBOARD_ENABLED=false`。

先查询宿主机 `input` 组 GID：

```bash
getent group input
```

例如输出 `input:x:106:`，则在部署目录创建 `.env`：

```bash
INPUT_GID=106
KEYBOARD_ENABLED=true
KEYBOARD_CONTAINER_USER=node
KEYBOARD_DEVICE=
KEYBOARD_DEVICES=
KEYBOARD_DEBOUNCE_MS=180
```

启动时叠加键盘控制配置：

```bash
docker compose -f docker-compose.yml -f docker-compose.keyboard.yml up -d
```

默认不指定 `KEYBOARD_DEVICE` / `KEYBOARD_DEVICES` 时，会自动扫描 `/dev/input/by-id/`、`/dev/input/by-path/` 和 `/proc/bus/input/devices` 中可识别的键盘事件设备。也可以显式指定稳定路径，例如：

```bash
KEYBOARD_DEVICE=/dev/input/by-id/your-keyboard-event-kbd
KEYBOARD_DEVICES=/dev/input/by-id/kbd1-event-kbd,/dev/input/by-id/kbd2-event-kbd
```

优先使用 `/dev/input/by-id/...-event-kbd` 或 `/dev/input/by-path/...-event-kbd`，不要优先使用 `/dev/input/event3` 这类编号，因为重启后编号可能变化。

默认按键映射：

- `KEY_RIGHT` / `KEY_NEXTSONG`: 下一曲
- `KEY_LEFT` / `KEY_PREVIOUSSONG`: 上一曲
- `KEY_SPACE` / `KEY_PLAYPAUSE`: 播放/暂停
- `KEY_UP` / `KEY_PLAY`: 播放
- `KEY_DOWN` / `KEY_STOP` / `KEY_STOPCD`: 停止
- `KEY_PAUSE`: 暂停
- `KEY_VOLUMEUP`: 音量加
- `KEY_VOLUMEDOWN`: 音量减
- `KEY_MUTE`: 静音/取消静音

运行中插拔键盘时，如果没有自动识别新设备，执行：

```bash
docker restart roon-coverart
```

如果宿主机没有 `input` 组，或 `/dev/input/event*` 是 `root:root` 且权限为 `0600`，可以在 `.env` 中改用：

```bash
INPUT_GID=0
KEYBOARD_CONTAINER_USER=root
```

#### 🎯 优势

1. **普通部署无需手动权限设置** - Dockerfile已处理应用目录权限
2. **简化部署流程** - 减少用户操作步骤
3. **安全性增强** - 以非root用户运行
4. **一致性保证** - 消除环境差异导致的权限问题

### 方法2：手动安装

1. 克隆或下载本仓库
2. 进入项目目录
3. 安装依赖：
```bash
npm install
```
4. 启动服务：
```bash
npm start
```

## 配置说明

默认端口为3666，可通过以下方式修改：

1. 命令行参数：
```bash
PORT=3000 npm start
```

2. 配置文件：
编辑 `config/default.json`：
```json
{
  "server": {
    "port": 3666
  },
  "artwork": {
    "saveDir": "./images",
    "autoSave": true,
    "format": "jpg"
  }
}
```

### 配置项说明

- `server.port`: 服务器监听端口
- `artwork.saveDir`: 专辑封面保存目录
- `artwork.autoSave`: 是否自动保存专辑封面
- `artwork.format`: 保存图片的格式（jpg/png）


## API 端点

项目提供了以下API端点：

- `GET /roonapi/getImage?image_key=xxx&albumName=xxx` - 获取专辑封面图片（标准分辨率1080x1080）
- `GET /roonapi/getImage4k?image_key=xxx` - 获取4K高清专辑封面（2160x2160）
- `GET /api/images/random?count=16` - [新增] 随机获取指定数量的封面图片（性能优化）
- `GET /api/status` - 获取当前播放状态
- `GET /api/pair` - 获取Roon Core配对状态
- `GET /api/zones` - 获取所有可用的播放区域
- `GET /api/images` - 获取已保存的专辑封面列表
- `GET /roonapi/artworkStatus` - 获取图片保存状态和统计信息

## 使用说明

1. 访问 `http://localhost:3666`（或您配置的端口）
2. 在 Roon 中启用扩展
3. 选择要显示的播放区域
4. 开始使用！

## 显示要求

- 屏幕：22寸竖屏（1920x1920）
- 环境：专用WebView，全屏显示
- 运行：支持7x24小时稳定运行

## 注意事项

1. 确保 images 目录具有正确的读写权限
   ```bash
   # 进入项目目录
   cd /path/to/coverart
   
   # 设置正确的所有权和权限
   sudo chown -R 1000:1000 images
   sudo chmod 755 images
   ```
   注意：这些命令需要在宿主机上执行，而不是在容器内。用户ID 1000对应容器内的node用户。

2. Docker 安装时请确保正确映射 `config.json`、`config/local.json` 和图片目录
3. 建议使用 Chrome 或基于 Chromium 的浏览器以获得最佳体验

## 图片保存机制

### 工作原理

1. **触发条件**
- 图片保存是通过 `/roonapi/getImage` API 端点触发的
- 当有设备请求图片时，服务器会：
  1. 从 Roon Core 获取图片
  2. 检查自动保存设置
  3. 如果启用了自动保存，则保存图片

2. **重要说明**
- 如果没有设备访问网页界面，不会触发图片保存
- 即使 Roon 正在播放音乐，如果没有设备访问网页，也不会保存图片
- 图片保存是在设备请求图片时才会触发

3. **解决方案**
如果需要在没有设备访问的情况下也保存图片，可以：
- 修改代码，在接收到 `nowplaying` 事件时直接保存图片
- 使用一个始终运行的轻量级客户端（如 headless browser）来访问页面
- 或者创建一个独立的保存服务，直接监听 Roon 事件并保存图片

4. **配置说明**
可以在 `config/default.json` 中配置自动保存行为：
```json
{
  "artwork": {
    "saveDir": "./images",
    "autoSave": true,
    "format": "jpg"
  }
}
```

## 更新记录

### 3.1.8 (2026-07-16) 代码清理与稳定性修复
- 修复封面索引并发覆盖、zone 回退控制错位和容器退出流程
- 移除未加载的旧入口、旧前端资源、jQuery 和无效内存/时钟逻辑
- 精简浏览器键盘控制、Express 中间件和重复 Roon zone 缓存
- 升级生产依赖并将安全审计结果收敛到 0 个漏洞
- Roon 扩展上报版本和 Docker 默认镜像标签升级到 3.1.8
- Docker 构建升级到 Node.js 24 LTS，并增加依赖缓存

### 3.1.7 (2026-05-09) 宿主机键盘音量控制
- 宿主机物理键新增音量控制：`KEY_VOLUMEUP`、`KEY_VOLUMEDOWN`、`KEY_MUTE`
- 版本号升级到 3.1.7

### 3.1.6 (2026-05-05) 宿主机键盘控制
- 增加宿主机键盘控制，可从 Docker 容器读取 `/dev/input` 键盘事件控制 Roon；没有设备时自动 no-op，可用 `KEYBOARD_ENABLED=false` 关闭

### 3.1.5 (2026-05-02) 安全与部署优化
- 移除本地 Roon 授权状态文件的版本控制，避免误提交配对 token
- 升级生产依赖并降低主要 Express / Socket.IO 依赖风险
- 加强 Socket 控制消息校验和 Roon zone 订阅清理
- 修复图片格式配置和特殊文件名加载问题
- 优化 Dockerfile、Docker Compose 与 Docker 安装文档

### 3.1.3 (2025-12) 代码重构与优化
- **后端重构**：将单体应用拆分为模块化服务（Server, Roon, Image, Socket），提升代码可维护性
- **性能优化**：
  - 新增 `/api/images/random` 接口，按需加载随机图片
  - 艺术墙模式不再下载全量图片列表，大幅降低网络和内存开销
- **Docker 优化**：
  - 修复 Token 持久化配置，确保重启不丢失配对信息
  - 优化 Dockerfile 入口点和目录权限
- **现代化**：全面升级为 Async/Await 异步处理

### 3.1.1 (2024-07)
- 添加专用画屏显示优化功能
- 新增高性能图片预加载和缓存机制
- 实现交叉淡入淡出图片切换效果
- 添加性能监控和内存管理
- 优化4K图片显示支持（2160x2160）
- 改进艺术墙网格布局为4x4（16个位置）
- 增强连接管理和自动重连机制
- 优化图片保存功能，避免重复保存
- 提升长时间运行稳定性


### 3.0.8 (2024-03)
- 优化图片切换动画效果
- 实现渐变式明暗过渡
- 提升视觉体验流畅度

### 3.0.7 (2024-03)
- 优化定时器管理机制
- 改进图片翻转动画性能
- 提升内存使用效率
- 修复长时间运行可能导致卡死的问题

### 3.0.6 (2024-03)
- 优化网格显示的图片翻转效果
  - 实现从右向左的书页翻转动画
  - 优化翻转时的图片加载和切换
  - 改进多图片连续翻转的视觉体验
