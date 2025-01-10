# ArtFrame for Roon

ArtFrame is an album artwork display extension designed for Roon music system, version 2.1.2.

## Features

- 4K Ultra HD album artwork display
- Adaptive fullscreen display
- Touch screen support
- Smart mouse hiding
- iOS device fullscreen support
- Automatic background blur effect
- Clock display with album art background
- Enhanced zone pairing mechanism with persistent settings

## System Requirements

- Node.js 12.0 or higher (for manual installation)
- Roon Core 1.8 or higher
- Modern browser (HTML5 support)
- Docker (for Docker installation)

## Installation

### Method 1: Docker Installation (Recommended)

#### Option A: Using Docker Hub Image (Simplest)
```bash
docker run -d \
  --network host \
  --restart unless-stopped \
  epochaudio/artframe:latest
```

#### Option B: Using Docker Compose
1. Create a `docker-compose.yml` file with the following content:
```yaml
version: '3'
services:
  roonalbumart:
    image: epochaudio/artframe:latest
    network_mode: "host"
    restart: unless-stopped
    volumes:
      - ./config:/app/config
```
2. Run the container:
```bash
docker-compose up -d
```

The service will be available at `http://localhost:3666`

### Method 2: Manual Installation

1. Clone or download this repository
2. Navigate to the project directory
3. Install dependencies:
```bash
npm install
```
4. Start the service:
```bash
node app.js
```

## Configuration

Default port is 3666, which can be modified by:

1. Command line argument:
```bash
node app.js -p 3000
```

2. Configuration file:
Edit `config/default.json`:
```json
{
  "server": {
    "port": 3000
  }
}
```

## Usage

1. Start Roon Core
2. Run ArtFrame
3. Enable ArtFrame extension in Roon settings
4. Visit `http://localhost:3666` (or your configured port)
5. Select your preferred zone in the settings
   - Zone selection is now persistent across sessions
   - Only the selected zone's artwork will be displayed
   - Zone settings can be changed anytime through the settings menu

## Touch Screen Operations

- Click cover: Toggle fullscreen mode
- Operation tips will be shown on first visit

## Keyboard Shortcuts

- ESC: Exit fullscreen mode

## New Features in 2.1.2

- Enhanced zone pairing mechanism
  - Persistent zone selection across sessions
  - Improved zone state management
  - Better handling of zone changes
- Enhanced album art color extraction for dynamic background
- Improved contrast calculation for clock display
- Smoother color transitions
- Better visual experience with optimized blur effects
- Auto-adjusting text colors based on background brightness

## Technical Support

- Website: http://www.epochaudio.cn/
- Made by MenErduo Studio

## License

Copyright © 2024 MenErduo Studio

