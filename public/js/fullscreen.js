"use strict";

// 全局变量和常量定义
const socket = io();
let currentImageKey = null;
let updateInterval = null;
let playbackTimer = null;
const GRID_UPDATE_INTERVAL = 120000; // 120秒更新周期
const GRID_FALLBACK_DELAY_MS = 15000; // 暂停/停止15秒后切回封面墙
const IMAGES_TO_UPDATE = 3; // 每次更新3张图片

// 设置相关
const settings = {
    zoneID: readCookie("settings['zoneID']") || null
};

// 图片加载和缓存管理
class ImageLoader {
    constructor() {
        this.imagePool = new Map();
        this.maxPoolSize = 25;  // 降低缓存数量，16个网格+9个预留
        this.loadTimeout = 8000;  // 8秒超时
    }

    loadImage(url) {
        if (this.imagePool.has(url)) {
            return Promise.resolve(this.imagePool.get(url));
        }

        return new Promise((resolve, reject) => {
            const img = new Image();
            const timeout = setTimeout(() => {
                img.src = '';
                reject(new Error('图片加载超时'));
            }, this.loadTimeout);

            img.onload = () => {
                clearTimeout(timeout);
                this.imagePool.set(url, img);
                this.cleanImagePool();
                resolve(img);
            };

            img.onerror = () => {
                clearTimeout(timeout);
                reject(new Error(`加载图片失败: ${url}`));
            };

            img.src = url;
        });
    }

    cleanImagePool() {
        if (this.imagePool.size > this.maxPoolSize) {
            const entries = Array.from(this.imagePool.entries());
            const toRemove = entries.slice(0, entries.length - this.maxPoolSize);
            toRemove.forEach(([url, img]) => {
                // 显式清理图片资源
                img.src = '';
                img.onload = null;
                img.onerror = null;
                this.imagePool.delete(url);
            });
        }
    }
}

// 创建全局图片加载器实例
const imageLoader = new ImageLoader();

// 创建键盘控制器实例
let keyboardController = null;

function imageFileUrl(filename) {
    return `/images/${encodeURIComponent(filename)}`;
}

// 显示模式切换
function toggleDisplayMode(isPlaying) {
    const gridContainer = document.getElementById('gridContainer');
    const playingContainer = document.getElementById('playingContainer');

    if (!gridContainer || !playingContainer) {
        console.error('找不到必要的DOM元素:', {
            gridContainer: !!gridContainer,
            playingContainer: !!playingContainer
        });
        return;
    }

    if (isPlaying) {
        gridContainer.classList.add('hidden');
        playingContainer.classList.remove('hidden');
        if (updateInterval) {
            clearInterval(updateInterval);
            updateInterval = null;
        }
    } else {
        playingContainer.classList.add('hidden');
        gridContainer.classList.remove('hidden');
        initializeGridDisplay();
    }
}

function clearPlaybackFallbackTimer() {
    if (!playbackTimer) return;
    clearTimeout(playbackTimer);
    playbackTimer = null;
}

function scheduleGridDisplayFallback(delayMs) {
    clearPlaybackFallbackTimer();
    playbackTimer = setTimeout(() => {
        toggleDisplayMode(false);
        playbackTimer = null;
    }, delayMs);
}

function resolveCurrentZone(payload) {
    if (!payload || payload.length === 0) return null;

    const selectedZone = settings.zoneID
        ? payload.find(zone => zone.zone_id === settings.zoneID)
        : null;
    const resolvedZone = selectedZone || payload[0];

    if (settings.zoneID !== resolvedZone.zone_id) {
        settings.zoneID = resolvedZone.zone_id;
        setCookie("settings['zoneID']", settings.zoneID);
    }

    return resolvedZone;
}

// 图片更新相关函数
async function initializeGridDisplay() {
    if (updateInterval) {
        clearInterval(updateInterval);
    }

    await updateGridImages();
    updateInterval = setInterval(updateRandomImages, GRID_UPDATE_INTERVAL);
}

async function updateGridImages() {
    try {
        const response = await fetch('/api/images/random?count=16');
        if (!response.ok) throw new Error('Failed to fetch images');

        const images = await response.json();

        if (images.length === 0) return;

        const gridItems = document.querySelectorAll('.grid-item');

        // We might get fewer than 16 images if the library is small
        // Duplicate if necessary to fill grid? Or just leave empty/transparent?
        // Current logic fills sequentially.

        const loadPromises = Array.from(gridItems).map(async (gridItem, index) => {
            try {
                // Handle cases where we have fewer images than grid slots
                const image = images[index % images.length];

                if (image) {
                    const imageUrl = imageFileUrl(image);
                    const loadedImg = await imageLoader.loadImage(imageUrl);
                    const frontImg = gridItem.querySelector('.front');
                    const backImg = gridItem.querySelector('.back');
                    if (frontImg) frontImg.src = loadedImg.src;
                    if (backImg) backImg.src = '/img/transparent.png';
                }
            } catch (error) {
                console.error('Failed to load image for grid:', error);
            }
        });

        await Promise.all(loadPromises);
    } catch (error) {
        console.error('Error updating grid images:', error);
    }
}

async function updateRandomImages() {
    try {
        // Request more than needed (10) to allow for filtering duplicates
        const response = await fetch('/api/images/random?count=10');
        if (!response.ok) throw new Error('Failed to fetch images');

        const newImages = await response.json();
        if (newImages.length === 0) return;

        const gridItems = document.querySelectorAll('.grid-item');

        // Get currently displayed images to avoid immediate duplicates if possible
        const currentImages = Array.from(gridItems).map(item => {
            const frontImg = item.querySelector('.front');
            const src = frontImg.src;
            return src.includes('/images/') ? decodeURIComponent(src.split('/images/')[1]) : null;
        });

        const positions = Array.from({ length: gridItems.length }, (_, index) => index);
        const updatePositions = [];
        for (let i = 0; i < IMAGES_TO_UPDATE && positions.length > 0; i++) {
            const randomIndex = Math.floor(Math.random() * positions.length);
            updatePositions.push(positions.splice(randomIndex, 1)[0]);
        }

        const candidates = newImages.filter(image => !currentImages.includes(image));
        const updates = await Promise.all(updatePositions.map(async position => {
            let selectedImage;
            if (candidates.length > 0) {
                const candidateIndex = Math.floor(Math.random() * candidates.length);
                selectedImage = candidates.splice(candidateIndex, 1)[0];
            } else {
                selectedImage = newImages[Math.floor(Math.random() * newImages.length)];
            }

            const imageUrl = imageFileUrl(selectedImage);
            try {
                const loadedImg = await imageLoader.loadImage(imageUrl);
                return { position, loadedImg };
            } catch (error) {
                console.error(`Preload failed for position ${position}:`, error);
                return { position, error: true };
            }
        }));

        // Execute flips
        for (let i = 0; i < updates.length; i++) {
            const update = updates[i];
            if (update.error) continue;

            const gridItem = gridItems[update.position];
            const backImg = gridItem.querySelector('.back');

            if (i > 0) await new Promise(resolve => setTimeout(resolve, 3000));

            backImg.src = update.loadedImg.src;
            gridItem.classList.add('flip');

            await new Promise(resolve => {
                setTimeout(() => {
                    const frontImg = gridItem.querySelector('.front');
                    frontImg.src = update.loadedImg.src;
                    backImg.src = '/img/transparent.png';
                    gridItem.classList.remove('flip');
                    resolve();
                }, 500);
            });
        }
    } catch (error) {
        console.error('Error updating random images:', error);
    }
}

// 图片更新函数
function updateImage(imageKey, albumName) {
    const coverImage = document.getElementById('coverImage');
    if (!coverImage) return;

    if (!imageKey) {
        coverImage.src = '/img/transparent.png';
        return;
    }

    const params = new URLSearchParams({ image_key: imageKey });
    if (albumName) {
        params.set('albumName', albumName);
    }
    coverImage.src = '/roonapi/getImage?' + params.toString();
}

// Cookie 相关函数
function readCookie(name) {
    return Cookies.get(name);
}

function setCookie(name, value) {
    Cookies.set(name, value, { expires: 365 });
}

// 传输控制处理函数
function handleTransportCommand(data) {
    if (socket && socket.connected) {
        socket.emit('transport', {
            zoneID: settings.zoneID,
            command: data.command
        });
    } else {
        console.warn('Socket 未连接，无法发送传输控制命令');
    }
}

// 更新MediaSession信息
function updateMediaSessionInfo(nowPlaying) {
    if (keyboardController && nowPlaying) {
        const metadata = {
            title: nowPlaying.three_line?.line1 || '未知标题',
            artist: nowPlaying.three_line?.line2 || '未知艺术家',
            album: nowPlaying.three_line?.line3 || nowPlaying.album || '未知专辑',
            artwork: nowPlaying.image_key ? [
                {
                    src: `/roonapi/getImage4k?image_key=${encodeURIComponent(nowPlaying.image_key)}`,
                    sizes: '2160x2160',
                    type: 'image/jpeg'
                },
                {
                    src: `/roonapi/getImage?image_key=${encodeURIComponent(nowPlaying.image_key)}`,
                    sizes: '1080x1080',
                    type: 'image/jpeg'
                }
            ] : []
        };

        keyboardController.updateMediaSession(metadata);
    }
}

// 事件监听器设置
document.addEventListener('DOMContentLoaded', function () {
    initializeGridDisplay();

    if (typeof KeyboardController !== 'undefined') {
        keyboardController = new KeyboardController();
        keyboardController.on('transport', handleTransportCommand);
    } else {
        console.warn('KeyboardController 类未找到');
    }
});

// Socket.IO 事件处理
socket.on('pairStatus', function (payload) {
    const pairDisabled = document.getElementById('pairDisabled');
    if (payload && payload.pairEnabled === true) {
        if (pairDisabled) pairDisabled.style.display = 'none';
        socket.emit('getZone', settings.zoneID || true);
    } else if (pairDisabled) {
        pairDisabled.style.display = 'flex';
    }
});

socket.on('zoneStatus', function (payload) {
    const zone = resolveCurrentZone(payload);
    if (!zone) return;

    if (zone.now_playing && zone.now_playing.image_key !== currentImageKey) {
        const nowPlaying = zone.now_playing;
        currentImageKey = nowPlaying.image_key;
        const albumName = nowPlaying.three_line?.line3 || nowPlaying.album;
        updateImage(currentImageKey, albumName);
        updateMediaSessionInfo(nowPlaying);
    }

    if (zone.state === 'playing') {
        clearPlaybackFallbackTimer();
        toggleDisplayMode(true);
    } else if (zone.state) {
        scheduleGridDisplayFallback(GRID_FALLBACK_DELAY_MS);
    }

    if (keyboardController) {
        const playbackState = zone.state === 'playing'
            ? 'playing'
            : zone.state === 'paused' ? 'paused' : 'none';
        keyboardController.setPlaybackState(playbackState);
    }
});

socket.on('notPlaying', function () {
    scheduleGridDisplayFallback(GRID_FALLBACK_DELAY_MS);
});

socket.on('nowplaying', function (data) {
    if (!data || !data.image_key) return;

    currentImageKey = data.image_key;
    const albumName = data.three_line?.line3 || data.album;
    updateImage(data.image_key, albumName);
    updateMediaSessionInfo(data);

    if (keyboardController) {
        keyboardController.setPlaybackState('playing');
    }

    clearPlaybackFallbackTimer();
    toggleDisplayMode(true);
});
