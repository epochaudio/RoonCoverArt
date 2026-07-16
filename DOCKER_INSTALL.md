# Docker 安装说明（当前版本）

本文基于当前已发布镜像和当前 `docker-compose.yml` 配置编写。默认推荐直接拉取镜像使用；需要本地构建时，叠加 `docker-compose.build.yml`。

## 1. 说明（当前持久化方式）

当前容器使用两套配置/状态文件：

- `./config/local.json` -> `/app/config/local.json`
  - 用于应用配置（`node-config`）
  - 镜像内保留 `config/default.json`，宿主机只覆盖 `config/local.json`
- `./config.json` -> `/app/config.json`
  - 用于 Roon 授权与扩展状态持久化（避免重启后重复授权）

重要：
- 应用端口等参数请改 `config/local.json`
- 不要把 Roon 授权状态写进 `config/local.json`

## 2. 镜像标签

当前可用镜像（已发布）：

- `epochaudio/coverart:latest`
- `epochaudio/coverart:3.1.8`

Docker Hub 标签页：

- https://hub.docker.com/r/epochaudio/coverart/tags

## 3. 准备目录与文件

在部署目录准备以下内容：

```bash
mkdir -p images config
test -f config.json || printf '{}\n' > config.json
test -f config/local.json || printf '{\n  "server": {\n    "port": "3666"\n  }\n}\n' > config/local.json
```

说明：
- `images/` 用于保存封面图
- `config.json` 用于保存 Roon 授权/配对状态（必须保留）
- `config/local.json` 用于覆盖默认配置

如果你只想用默认端口 `3666`，保留上面的默认 `config/local.json` 即可。

## 4. 推荐方式：先拉取镜像，再用 Docker Compose 启动

先拉取官方镜像（最简单、最快）。生产部署建议固定版本 `3.1.8`：

```bash
docker pull epochaudio/coverart:3.1.8
```

当前仓库的 `docker-compose.yml` 已包含运行已发布镜像所需的挂载、持久化和基础安全设置；健康检查由镜像内的 Dockerfile 提供。

启动：

```bash
COVERART_IMAGE=epochaudio/coverart:3.1.8 docker compose up -d
```

查看日志：

```bash
docker compose logs -f
```

查看健康状态：

```bash
docker compose ps
```

停止：

```bash
docker compose down
```

## 5. 宿主机键盘控制（默认启用，无设备时 no-op）

如果键盘插在运行 Docker 的宿主机上，可以让容器读取宿主机 `/dev/input` 事件并直接控制 Roon。键盘监听默认启用；没有发现键盘或设备打开失败时只输出 warning，不影响网页和 Roon 扩展启动。需要关闭时设置 `KEYBOARD_ENABLED=false`。

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

默认不指定 `KEYBOARD_DEVICE` / `KEYBOARD_DEVICES` 时，程序会自动扫描并监听所有可识别的键盘事件设备，包括：

- `/dev/input/by-id/`
- `/dev/input/by-path/`
- `/proc/bus/input/devices` 中带 `kbd` handler 的事件设备

也可以显式指定一个或多个稳定路径：

```bash
KEYBOARD_DEVICE=/dev/input/by-id/your-keyboard-event-kbd
KEYBOARD_DEVICES=/dev/input/by-id/kbd1-event-kbd,/dev/input/by-id/kbd2-event-kbd
```

优先使用 `/dev/input/by-id/...-event-kbd` 或 `/dev/input/by-path/...-event-kbd`，不要优先使用 `/dev/input/event3` 这类编号，因为重启后编号可能变化。可用下面命令查看：

```bash
ls -l /dev/input/by-id/
ls -l /dev/input/by-path/
```

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
docker compose restart coverart
```

如果容器创建时宿主机没有 `/dev/input`，后续插入键盘后仍不可用，重新运行安装命令，让容器重新创建并挂载 input 目录。

权限说明：

- 常规 Linux 发行版通常会把 `/dev/input/event*` 设为 `root:input`，这时使用宿主机 `input` 组 GID，保持 `KEYBOARD_CONTAINER_USER=node` 即可。
- 某些精简系统会把 `/dev/input/event*` 设为 `root:root` 且权限为 `0600`，没有可用的 `input` 组。这时可在 `.env` 中使用：

```bash
INPUT_GID=0
KEYBOARD_CONTAINER_USER=root
```

此模式只读挂载 `/dev/input`，但容器进程会以 root 用户运行。仅在必须读取这类设备权限时使用。

直接使用 `docker run` 时，需要等价加入 `input` 组、`/dev/input` 只读挂载和 input 设备 cgroup 规则，例如：

```bash
docker run -d \
  --name coverart-app \
  --restart unless-stopped \
  --network host \
  --group-add "$(getent group input | cut -d: -f3)" \
  --device-cgroup-rule='c 13:* rwm' \
  -e ROON_PERSIST_PATH=/app/config.json \
  -e KEYBOARD_ENABLED=true \
  -e KEYBOARD_DEBOUNCE_MS=180 \
  -v /dev/input:/dev/input:ro \
  -v "$(pwd)/images:/app/images" \
  -v "$(pwd)/config/local.json:/app/config/local.json:ro" \
  -v "$(pwd)/config.json:/app/config.json" \
  epochaudio/coverart:3.1.8
```

如果宿主机没有 `input` 组，或 `/dev/input/event*` 是 `root:root` 且权限为 `0600`，Docker CLI 可改用 root 读取只读输入设备：

```bash
docker run -d \
  --name coverart-app \
  --restart unless-stopped \
  --network host \
  --user root \
  --device-cgroup-rule='c 13:* rwm' \
  -e ROON_PERSIST_PATH=/app/config.json \
  -e KEYBOARD_ENABLED=true \
  -e KEYBOARD_DEBOUNCE_MS=180 \
  -v /dev/input:/dev/input:ro \
  -v "$(pwd)/images:/app/images" \
  -v "$(pwd)/config/local.json:/app/config/local.json:ro" \
  -v "$(pwd)/config.json:/app/config.json" \
  epochaudio/coverart:3.1.8
```

注意：启用后容器可以读取宿主机键盘事件。仅在可信宿主机和可信容器镜像上启用。

## 6. 首次使用（Roon 授权）

首次启动后需要在 Roon 中授权扩展：

1. 打开 Roon
2. 进入 `Settings` -> `Extensions`
3. 找到 `CoverArt_Square_Docker`
4. 点击启用/授权

授权完成后，状态会写入宿主机的 `./config.json`。

后续容器重启/升级时，只要 `./config.json` 仍然挂载并可写，就不需要重新授权。

## 7. 修改端口（可选）

编辑 `config/local.json`，例如改为 `3667`：

```json
{
  "server": {
    "port": "3667"
  }
}
```

然后重启容器：

```bash
docker compose up -d
```

## 8. 升级镜像（保留授权和图片）

如果使用 `latest`：

```bash
docker pull epochaudio/coverart:latest
docker compose up -d
```

推荐固定版本（例如 `3.1.8`），用 `COVERART_IMAGE` 指定镜像标签：

```bash
docker pull epochaudio/coverart:3.1.8
COVERART_IMAGE=epochaudio/coverart:3.1.8 docker compose up -d
```

## 9. 本地构建镜像（可选）

如果需要基于当前源码构建镜像：

```bash
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

本地构建使用 Node.js 24 LTS，通过 BuildKit 缓存执行 `npm ci --omit=dev`；需要能访问 npm registry 和 GitHub 上的 Roon API 依赖。

## 10. 不使用 Compose（可选）

也可以直接先拉取镜像，再使用 `docker run`：

```bash
docker pull epochaudio/coverart:3.1.8
```

```bash
docker run -d \
  --name coverart-app \
  --restart unless-stopped \
  --network host \
  -e ROON_PERSIST_PATH=/app/config.json \
  -v "$(pwd)/images:/app/images" \
  -v "$(pwd)/config/local.json:/app/config/local.json:ro" \
  -v "$(pwd)/config.json:/app/config.json" \
  epochaudio/coverart:3.1.8
```

## 11. Compose 环境变量

可按需设置：

- `COVERART_IMAGE`: 镜像标签，默认 `epochaudio/coverart:3.1.8`
- `COVERART_CONTAINER_NAME`: 容器名，默认 `coverart-app`
- `ROON_LOG_LEVEL`: Roon SDK 日志级别，默认 `none`；排查协议问题时可临时设为 `all`
- `INPUT_GID`: 使用 `docker-compose.keyboard.yml` 时必填，宿主机 `input` 组 GID
- `KEYBOARD_ENABLED`: 宿主机键盘控制开关，默认 `true`；设为 `false` 可关闭
- `KEYBOARD_CONTAINER_USER`: 启用键盘控制时的容器用户，默认 `node`；设备为 `root:root 0600` 时可设为 `root`
- `KEYBOARD_DEVICE`: 单个键盘事件设备路径
- `KEYBOARD_DEVICES`: 多个键盘事件设备路径，逗号分隔
- `KEYBOARD_DEBOUNCE_MS`: 按键去抖时间，默认 `180`

## 12. 常见问题

### 12.1 每次重启都要重新授权

检查以下几点：

- `./config.json` 是否存在（应该是文件，不是目录）
- `docker-compose.yml` 是否挂载了 `./config.json:/app/config.json`
- 宿主机上的 `config.json` 是否可写

快速检查：

```bash
ls -l config.json
```

### 12.2 改了 `config.json` 里的端口但不生效

这是正常现象。

- `config.json` 是 Roon 授权状态文件
- 应用端口应写在 `config/local.json`

### 12.3 macOS / Windows 上 `host` 网络模式不可用

当前配置使用 `network_mode: "host"`（Linux 环境最方便）。

如果你在 Docker Desktop（macOS/Windows）上运行，需要改成端口映射方式，例如：

```yaml
ports:
  - "3666:3666"
```

并移除：

```yaml
network_mode: "host"
```
