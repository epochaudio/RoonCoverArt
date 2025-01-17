"use strict";

// 全局变量和常量定义
const socket = io();
let currentImageKey = null;
let mouseTimer;
const imageCache = new Map();  // 图片缓存池
const maxPoolSize = 30;       // 最大缓存数量
const IMAGE_TIMEOUT = 10000;  // 图片加载超时时间（10秒）
let updateInterval = null;
let playbackTimer = null;
const GRID_UPDATE_INTERVAL = 60000; // 60秒更新周期
const IMAGES_TO_UPDATE = 3; // 每次更新3张图片

// 设置相关
const settings = {
  theme: readCookie("settings['theme']") || 'dark',
  zoneID: readCookie("settings['zoneID']") || null
};

// 样式相关
const css = {
  backgroundColor: '#232629',
  foregroundColor: '#eff0f1',
  colorBackground: '#000000'
};

// 图片加载优化函数
function loadImage(url) {
    if (imageCache.has(url)) {
        console.log('从缓存加载图片:', url);
        return Promise.resolve(imageCache.get(url));
    }

    return new Promise((resolve, reject) => {
        const img = new Image();
        const timeout = setTimeout(() => {
            img.src = '';
            reject(new Error('图片加载超时'));
        }, IMAGE_TIMEOUT);

        img.onload = () => {
            clearTimeout(timeout);
            imageCache.set(url, img);
            cleanImagePool();
            resolve(img);
        };

        img.onerror = () => {
            clearTimeout(timeout);
            reject(new Error(`加载图片失败: ${url}`));
        };

        img.src = url;
    });
}

// 清理图片缓存池
function cleanImagePool() {
    if (imageCache.size > maxPoolSize) {
        console.log('清理图片缓存池');
        const entries = Array.from(imageCache.entries());
        const toRemove = entries.slice(0, entries.length - maxPoolSize);
        toRemove.forEach(([url]) => {
            console.log('从缓存池移除:', url);
            imageCache.delete(url);
        });
    }
}

// 内存监控
function monitorMemory() {
    if (window.performance && window.performance.memory) {
        const memory = window.performance.memory;
        console.log('内存使用情况:', {
            限制: Math.round(memory.jsHeapSizeLimit / 1024 / 1024) + 'MB',
            已分配: Math.round(memory.totalJSHeapSize / 1024 / 1024) + 'MB',
            已使用: Math.round(memory.usedJSHeapSize / 1024 / 1024) + 'MB'
        });

        if (memory.usedJSHeapSize / memory.jsHeapSizeLimit > 0.8) {
            console.log('内存使用过高，开始清理');
            cleanImagePool();
        }
    }
}

// 错误恢复机制
function attemptRecovery() {
    console.log('开始执行恢复程序');
    cleanImagePool();
    if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
    }
    setTimeout(() => {
        console.log('尝试重新初始化显示');
        initializeGridDisplay();
    }, 5000);
}

// 设备检测
function isTouchDevice() {
    return (('ontouchstart' in window) ||
        (navigator.maxTouchPoints > 0) ||
        (navigator.msMaxTouchPoints > 0));
}

function isIOS() {
    return [
        'iPad Simulator',
        'iPhone Simulator',
        'iPod Simulator',
        'iPad',
        'iPhone',
        'iPod'
    ].includes(navigator.platform)
    || (navigator.userAgent.includes("Mac") && "ontouchend" in document);
}

// 时钟功能
function updateTime() {
    const clockContent = document.querySelector('.clock-content');
    if (!clockContent) {
        console.error('找不到时钟元素');
        return;
    }
    
    const now = new Date();
    const dateStr = now.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'long'
    });
    
    const timeStr = now.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
    
    const dateElement = clockContent.querySelector('.date');
    const timeElement = clockContent.querySelector('.time');
    
    if (dateElement) {
        dateElement.textContent = dateStr;
    }
    
    if (timeElement) {
        const [hours, minutes, seconds] = timeStr.split(':');
        timeElement.innerHTML = `${hours}:${minutes}<span class="seconds">${seconds}</span>`;
    }
}

// 显示模式切换
function toggleDisplayMode(isPlaying) {
    console.log('切换显示模式, isPlaying:', isPlaying);
    const gridContainer = document.getElementById('gridContainer');
    const playingContainer = document.getElementById('playingContainer');
    
    if (isPlaying) {
        console.log('切换到播放显示模式');
        gridContainer.classList.add('hidden');
        playingContainer.classList.remove('hidden');
        if (updateInterval) {
            clearInterval(updateInterval);
            updateInterval = null;
        }
    } else {
        console.log('切换到网格显示模式');
        playingContainer.classList.add('hidden');
        gridContainer.classList.remove('hidden');
        initializeGridDisplay();
    }
}

// 图片更新相关函数
async function initializeGridDisplay() {
    if (updateInterval) {
        clearInterval(updateInterval);
    }

    try {
        console.log('开始获取图片列表');
        const response = await fetch('/api/images');
        if (!response.ok) {
            throw new Error('获取图片列表失败');
        }
        const images = await response.json();
        console.log('获取到的图片列表:', images);
        
        if (images.length === 0) {
            console.log('没有可用的图片');
            return;
        }
        
        // 获取所有非时钟格子的图片元素
        const gridItems = document.querySelectorAll('.grid-item:not(.clock) img');
        console.log('找到的网格图片元素数量:', gridItems.length);
        
        // 随机选择8张不重复的图片
        const selectedImages = [];
        const usedIndices = new Set();
        
        while (selectedImages.length < 8 && usedIndices.size < images.length) {
            const randomIndex = Math.floor(Math.random() * images.length);
            if (!usedIndices.has(randomIndex)) {
                usedIndices.add(randomIndex);
                selectedImages.push(images[randomIndex]);
            }
        }
        
        // 将选中的图片应用到网格
        const loadPromises = Array.from(gridItems).map(async (img, index) => {
            try {
                if (index < selectedImages.length) {
                    const imageUrl = `/images/${selectedImages[index]}`;
                    console.log('加载图片:', imageUrl);
                    const loadedImg = await loadImage(imageUrl);
                    img.src = loadedImg.src;
                } else {
                    img.src = '/img/transparent.png';
                }
            } catch (error) {
                console.error('加载图片失败:', error);
                img.src = '/img/transparent.png';
            }
        });

        await Promise.all(loadPromises);
        updateInterval = setInterval(updateRandomImages, GRID_UPDATE_INTERVAL);
        console.log('设置了定时更新，间隔:', GRID_UPDATE_INTERVAL);
        setInterval(monitorMemory, 60000);
    } catch (error) {
        console.error('初始化网格显示失败:', error);
        attemptRecovery();
    }
}

async function updateRandomImages() {
    try {
        const response = await fetch('/api/images');
        if (!response.ok) {
            throw new Error('获取图片列表失败');
        }
        const images = await response.json();
        if (images.length === 0) return;

        // 获取当前显示的所有图片
        const gridImages = Array.from(document.querySelectorAll('.grid-item:not(.clock) img'));
        const currentImages = gridImages.map(img => {
            const path = img.src.split('/').pop();
            return path === 'transparent.png' ? null : path;
        });

        // 选择3个不同位置进行更新
        const positions = Array.from({ length: gridImages.length }, (_, i) => i);
        const updatePositions = [];
        for (let i = 0; i < IMAGES_TO_UPDATE && positions.length > 0; i++) {
            const randomIndex = Math.floor(Math.random() * positions.length);
            updatePositions.push(positions.splice(randomIndex, 1)[0]);
        }

        // 为每个位置选择一个新图片（避免重复）
        for (const position of updatePositions) {
            const imgElement = gridImages[position];
            const gridItem = imgElement.parentElement;
            
            // 选择一个不在当前显示列表中的图片
            let newImage;
            do {
                const randomIndex = Math.floor(Math.random() * images.length);
                newImage = images[randomIndex];
            } while (currentImages.includes(newImage));
            
            // 应用3D翻转效果
            gridItem.classList.add('flip');
            
            const imageUrl = `/images/${newImage}`;
            try {
                const loadedImg = await loadImage(imageUrl);
                // 更新当前图片列表
                currentImages[position] = newImage;
                // 应用新图片
                setTimeout(() => {
                    imgElement.src = loadedImg.src;
                    setTimeout(() => {
                        gridItem.classList.remove('flip');
                    }, 300);
                }, 300);
            } catch (error) {
                console.error('更新图片失败:', error);
                imgElement.src = '/img/transparent.png';
                gridItem.classList.remove('flip');
            }
        }
    } catch (error) {
        console.error('更新随机图片失败:', error);
        attemptRecovery();
    }
}

// 图片更新函数
function updateImage(imageKey, albumName) {
    console.log('开始更新图片:', { imageKey, albumName });
    if (!imageKey) {
        console.log('无图片key，使用默认图片');
        $('#coverImage').attr('src', '/img/transparent.png');
        $('#coverBackground').css('background-image', 'none');
        $('#colorBackground').css('background-color', '#000000');
        return;
    }

    const imageUrl = '/roonapi/getImage?image_key=' + imageKey + 
        '&albumName=' + encodeURIComponent(albumName || '') +
        '&scale=full&format=image/jpeg&quality=100';
    console.log('图片URL:', imageUrl);
    
    $('#coverImage').attr('src', imageUrl);
    $('#coverBackground').css({
        'background-image': `url(${imageUrl})`,
        'opacity': '0.2',
        'filter': 'blur(30px)',
        'transition': 'all 1s ease'
    }).show();
    
    const colorThief = new ColorThief();
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = function() {
        const dominantColor = colorThief.getColor(img);
        const [r, g, b] = dominantColor;
        const backgroundColor = `rgba(${r}, ${g}, ${b}, 0.95)`;
        $('#colorBackground').css({
            'background': backgroundColor,
            'transition': 'background 1s ease'
        }).show();
    };
    img.src = imageUrl;
}

// Cookie 相关函数
function readCookie(name) {
    return Cookies.get(name);
}

function setCookie(name, value) {
    Cookies.set(name, value, { expires: 365 });
}

// 主题设置
function setTheme(theme) {
    settings.theme = theme;
    if (theme === 'dark') {
        $('body').css('background-color', '#232629');
        $('#colorBackground').show().css('background-color', '#232629');
        $('#coverBackground').hide();
    }
    updateImage(currentImageKey);
}

// 事件监听器设置
document.addEventListener('DOMContentLoaded', function() {
    const isTouch = isTouchDevice();
    updateTime();
    setInterval(updateTime, 1000);
    initializeGridDisplay();
});

// Socket.IO 事件处理
socket.on('pairStatus', function(payload) {
    console.log('收到配对状态:', payload);
    const pairDisabled = document.getElementById('pairDisabled');
    if (payload && payload.pairEnabled === true) {
        if (pairDisabled) pairDisabled.style.display = 'none';
        console.log('发送getZone请求:', settings.zoneID || true);
        socket.emit("getZone", settings.zoneID || true);
    } else {
        if (pairDisabled) pairDisabled.style.display = 'flex';
    }
});

socket.on('zoneStatus', function(payload) {
    console.log('收到区域状态:', payload);
    if (payload && payload.length > 0) {
        if (!settings.zoneID) {
            settings.zoneID = payload[0].zone_id;
            console.log('设置新的zoneID:', settings.zoneID);
            setCookie("settings['zoneID']", settings.zoneID);
        }
        
        const zone = payload.find(z => z.zone_id === settings.zoneID) || payload[0];
        console.log('当前zone:', zone);
        if (zone.now_playing && zone.now_playing.image_key !== currentImageKey) {
            const nowPlaying = zone.now_playing;
            console.log('更新图片key:', nowPlaying.image_key);
            currentImageKey = nowPlaying.image_key;
            
            // 获取专辑名称
            const albumName = nowPlaying.three_line?.line3 || nowPlaying.album;
            
            console.log('专辑信息:', {
                albumName,
                来源: nowPlaying.three_line?.line3 ? 'three_line.line3' : 'album字段',
                原始数据: {
                    three_line: nowPlaying.three_line,
                    album: nowPlaying.album
                }
            });
            
            if (albumName) {
                updateImage(currentImageKey, albumName);
            } else {
                console.warn('警告：无法获取专辑名称，完整数据:', nowPlaying);
                updateImage(currentImageKey);
            }
        }
    }
});

socket.on('notPlaying', function(data) {
    console.log('收到非播放状态事件:', data);
    try {
        if (playbackTimer) {
            console.log('清除现有定时器');
            clearTimeout(playbackTimer);
        }
        
        console.log('设置15秒切换定时器');
        playbackTimer = setTimeout(() => {
            console.log('切换到网格显示');
            toggleDisplayMode(false);
        }, 15000);
    } catch (error) {
        console.error('处理非播放状态事件时出错:', error);
    }
});

socket.on('nowplaying', function(data) {
    console.log('收到开始播放事件:', {
        完整数据: data,
        播放状态: data.state,
        图片Key: data.image_key,
        三行信息: data.three_line,
        其他元数据: {
            艺术家: data.artist,
            专辑: data.album,
            标题: data.title
        }
    });
    
    try {
        if (data && data.image_key) {
            console.log('保存封面key到localStorage:', data.image_key);
            localStorage.setItem('lastImageKey', data.image_key);
            currentImageKey = data.image_key;
            
            // 获取专辑名称
            const albumName = data.three_line?.line3 || data.album;
            
            console.log('专辑信息:', {
                albumName,
                来源: data.three_line?.line3 ? 'three_line.line3' : 'album字段',
                原始数据: {
                    three_line: data.three_line,
                    album: data.album
                }
            });
            
            if (albumName) {
                updateImage(data.image_key, albumName);
            } else {
                console.warn('警告：无法获取专辑名称，完整数据:', data);
                updateImage(data.image_key);
            }
            toggleDisplayMode(true);
        }
        
        if (playbackTimer) {
            console.log('取消切换定时器');
            clearTimeout(playbackTimer);
            playbackTimer = null;
        }
    } catch (error) {
        console.error('处理播放事件时出错:', error);
    }
});
