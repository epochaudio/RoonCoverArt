# Roon Cover Art Extension

一个用于展示 Roon 专辑封面的扩展程序，支持实时播放显示和艺术墙展示模式。

## 功能特点

1. **实时播放显示**
   - 显示当前播放曲目的专辑封面
   - 自动提取封面主色调作为背景色
   - 支持全屏显示

2. **艺术墙模式**
   - 在停止播放15秒后自动切换到艺术墙模式
   - 3x3网格布局展示
   - 中央显示时钟
   - 其他8个位置随机显示专辑封面
   - 每60秒自动更新3张图片
   - 平滑的3D翻转动画效果

3. **自动保存功能**
   - 自动保存播放过的专辑封面
   - 支持自定义保存目录
   - 智能文件命名（艺术家_专辑名）

## 安装方法

### 方法1：使用 Docker（推荐）

#### 选项A：直接使用 Docker

从 Docker Hub 拉取镜像：
```bash
docker pull epochaudio/coverart:latest
```

运行容器：
```bash
docker run -d \
  --name roon-coverart \
  --network host \
  --restart unless-stopped \
  -v $(pwd)/images:/app/images \
  epochaudio/coverart:latest
```

#### 选项B：使用 Docker Compose
1. 创建 `docker-compose.yml` 文件：
```yaml
version: '3'
services:
  coverart:
    image: epochaudio/coverart:latest
    network_mode: "host"
    restart: unless-stopped
    volumes:
      - ./images:/app/images
```

2. 运行容器：
```bash
docker-compose up -d
```

### 重要：设置权限

在运行 Docker 容器之前，必须正确设置 `images` 目录的权限。这是因为容器内的进程使用 UID 1000（node 用户）运行，需要对 `images` 目录有读写权限。

1. 创建 images 目录（如果不存在）：
```bash
mkdir -p images
```

2. 设置目录权限（选择以下方案之一）：

方案一（推荐 - 更安全）：
```bash
sudo chown -R 1000:1000 images
sudo chmod -R 755 images
```

方案二（如果方案一不工作）：
```bash
sudo chmod -R 777 images
```

注意：
- 这些权限命令需要在宿主机上执行，而不是在容器内
- UID 1000 对应容器内的 node 用户
- 建议使用方案一，方案二虽然更宽松但安全性较低
- 如果遇到权限问题，容器日志中会显示相关错误信息

### 方法2：手动安装

1. 克隆或下载本仓库
2. 进入项目目录
3. 安装依赖：
```bash
npm install
```
4. 启动服务：
```bash
node app.js
```

## 配置说明

默认端口为3666，可通过以下方式修改：

1. 命令行参数：
```bash
node app.js -p 3000
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

2. Docker 安装时请确保正确映射配置文件和图片目录
3. 建议使用 Chrome 或基于 Chromium 的浏览器以获得最佳体验

