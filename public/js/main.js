class AppManager {
    constructor() {
        this.eventEmitter = new app.EventEmitter();
        this.displayManager = new app.DisplayManager();
        this.clockManager = new app.ClockManager();
        
        this.settings = {
            theme: app.utils.cookie.get("settings['theme']") || 'dark',
            zoneID: app.utils.cookie.get("settings['zoneID']") || null
        };
        
        this.pollInterval = null;
        this.currentImageKey = null;
        
        this.initializeApp();
    }

    initializeApp() {
        // 初始化主题
        this.setTheme(this.settings.theme);
        
        // 开始轮询播放状态
        this.startPolling();
        
        // 检查设备类型
        if (app.utils.device.isTouch()) {
            document.body.classList.add('touch-device');
        }
        
        // 监听配对状态
        this.checkPairStatus();
    }

    async startPolling() {
        // 立即检查一次状态
        await this.checkPlaybackStatus();
        
        // 设置轮询间隔（每5秒检查一次）
        this.pollInterval = setInterval(() => this.checkPlaybackStatus(), 5000);
    }

    async checkPlaybackStatus() {
        try {
            const response = await fetch('/api/status');
            if (!response.ok) {
                throw new Error('获取状态失败');
            }
            
            const status = await response.json();
            
            if (status.is_playing) {
                this.handleNowPlaying(status);
            } else {
                this.handleNotPlaying();
            }
        } catch (error) {
            console.error('检查播放状态失败:', error);
        }
    }

    async checkPairStatus() {
        try {
            const response = await fetch('/api/pair');
            if (!response.ok) {
                throw new Error('获取配对状态失败');
            }
            
            const status = await response.json();
            const pairDisabled = app.utils.dom.$('#pairDisabled');
            
            if (status && status.pairEnabled === true) {
                if (pairDisabled) pairDisabled.style.display = 'none';
                await this.getZoneStatus();
            } else {
                if (pairDisabled) pairDisabled.style.display = 'flex';
            }
        } catch (error) {
            console.error('检查配对状态失败:', error);
        }
    }

    async getZoneStatus() {
        try {
            const response = await fetch('/api/zones');
            if (!response.ok) {
                throw new Error('获取区域状态失败');
            }
            
            const zones = await response.json();
            
            if (zones && zones.length > 0) {
                if (!this.settings.zoneID) {
                    this.settings.zoneID = zones[0].zone_id;
                    app.utils.cookie.set("settings['zoneID']", this.settings.zoneID);
                }
                
                const zone = zones.find(z => z.zone_id === this.settings.zoneID) || zones[0];
                
                if (zone.now_playing && zone.now_playing.image_key !== this.currentImageKey) {
                    const nowPlaying = zone.now_playing;
                    this.currentImageKey = nowPlaying.image_key;
                    
                    const albumName = nowPlaying.three_line?.line3 || nowPlaying.album;
                    
                    this.eventEmitter.emit('imageUpdate', {
                        imageKey: this.currentImageKey,
                        albumName
                    });
                }
            }
        } catch (error) {
            console.error('获取区域状态失败:', error);
        }
    }

    handleNowPlaying(data) {
        if (data && data.image_key) {
            localStorage.setItem('lastImageKey', data.image_key);
            this.currentImageKey = data.image_key;
            
            const albumName = data.three_line?.line3 || data.album;
            
            this.eventEmitter.emit('imageUpdate', {
                imageKey: data.image_key,
                albumName
            });
            
            this.eventEmitter.emit('playStateChange', true);
        }
    }

    handleNotPlaying() {
        setTimeout(() => {
            this.eventEmitter.emit('playStateChange', false);
        }, 15000);
    }

    setTheme(theme) {
        this.settings.theme = theme;
        if (theme === 'dark') {
            document.body.style.backgroundColor = '#232629';
            app.utils.dom.$('#colorBackground').style.display = 'block';
            app.utils.dom.$('#colorBackground').style.backgroundColor = '#232629';
            app.utils.dom.$('#coverBackground').style.display = 'none';
        }
        app.utils.cookie.set("settings['theme']", theme);
    }

    destroy() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
        this.clockManager.destroy();
    }
}

// 等待 DOM 加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
    window.appManager = new AppManager();
}); 