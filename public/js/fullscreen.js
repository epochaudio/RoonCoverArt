"use strict";
var socket = io();
var currentImageKey = null;
var settings = {
  theme: readCookie("settings['theme']") || 'dark',
  zoneID: readCookie("settings['zoneID']") || null
};
var css = {
  backgroundColor: '#232629',
  foregroundColor: '#eff0f1',
  colorBackground: '#000000'
};

$(document).ready(function() {
  setTheme(settings.theme);

  socket.on("pairStatus", function(payload) {
    console.log('收到配对状态:', payload);
    if (payload && payload.pairEnabled === true) {
      $('#pairDisabled').hide();
      console.log('发送getZone请求:', settings.zoneID || true);
      socket.emit("getZone", settings.zoneID || true);
    } else {
      $('#pairDisabled').show();
    }
  });

  socket.on("zoneStatus", function(payload) {
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
        console.log('更新图片key:', zone.now_playing.image_key);
        currentImageKey = zone.now_playing.image_key;
        updateImage(currentImageKey);
      }
    }
  });
});

function updateImage(imageKey) {
  console.log('开始更新图片:', imageKey);
  if (!imageKey) {
    console.log('无图片key，使用默认图片');
    $('#coverImage').attr('src', '/img/transparent.png');
    $('#coverBackground').css('background-image', 'none');
    $('#colorBackground').css('background-color', '#000000');
    $('#clock').css('color', '#ffffff');
    return;
  }

  const imageUrl = '/roonapi/getImage?image_key=' + imageKey + '&scale=full&format=image/jpeg&quality=100';
  console.log('图片URL:', imageUrl);
  $('#coverImage').attr('src', imageUrl);
  
  const colorThief = new ColorThief();
  const img = new Image();
  img.crossOrigin = 'Anonymous';
  img.onload = function() {
    // 获取主色调
    const dominantColor = colorThief.getColor(img);
    const [r, g, b] = dominantColor;
    
    // 计算对比色
    const contrastColor = getContrastColor(r, g, b);
    
    // 计算亮度
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    
    // 设置背景色，使用rgba以增加一点透明度
    const backgroundColor = `rgba(${r}, ${g}, ${b}, 0.95)`;
    
    // 应用颜色变化
    $('#colorBackground').css({
      'background': backgroundColor,
      'transition': 'background 1s ease'
    });
    
    // 设置时钟颜色为对比色
    $('#clock').css({
      'color': contrastColor,
      'transition': 'color 1s ease'
    });
    
    // 设置模糊背景
    $('#coverBackground').css({
      'background-image': `url(${imageUrl})`,
      'opacity': '0.2',
      'filter': 'blur(30px)',
      'transition': 'all 1s ease'
    }).show();
  };
  img.src = imageUrl;
}

// 计算对比色函数
function getContrastColor(r, g, b) {
  // 计算亮度
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  
  // 如果背景色偏暗，返回浅色文字；如果背景色偏亮，返回深色文字
  if (brightness < 128) {
    return 'rgba(255, 255, 255, 0.95)';
  } else {
    return 'rgba(0, 0, 0, 0.95)';
  }
}

function setTheme(theme) {
  settings.theme = theme;
  if (theme === 'dark') {
    $('body').css('background-color', '#232629');
    $('#colorBackground').show().css('background-color', '#232629');
    $('#coverBackground').hide();
    $('#clock').css('color', '#eff0f1');
  }
  updateImage(currentImageKey);
}

function readCookie(name) {
  return Cookies.get(name);
}

// Cookie 辅助函数
function setCookie(name, value) {
  Cookies.set(name, value, { expires: 365 });
}
